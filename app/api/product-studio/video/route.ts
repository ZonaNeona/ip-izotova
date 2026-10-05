import { NextResponse } from "next/server";
import { supabaseInsert, supabaseSelect } from "@/lib/supabase-rest";
import { persistRemoteAsset } from "@/lib/supabase-storage";

type MediaRow = {
  id: string;
  draft_id: string;
  product_id: string;
  media_kind: string;
  public_url: string | null;
};

type DraftRow = {
  id: string;
  title: string | null;
  visual_style: {
    background?: string;
    lighting?: string;
    palette?: string;
    mood?: string;
  };
};

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  brand: string;
  category: string;
  specs: Record<string, string | number | boolean>;
};

type VideoResponse = {
  data?: Array<{
    url?: string;
    b64_json?: string;
  }>;
  cost?: number;
  latency?: number;
};

type VideoFormat = "vertical" | "horizontal" | "square";

const formatPrompt: Record<VideoFormat, string> = {
  vertical:
    "Vertical short product video, 9:16 composition suitable for marketplace mobile viewing.",
  horizontal:
    "Horizontal premium product video, 16:9 composition with restrained camera movement.",
  square:
    "Square product video, 1:1 composition optimized for a marketplace product card.",
};

export async function POST(request: Request) {
  const body = (await request.json()) as {
    mediaId?: string;
    format?: VideoFormat;
  };

  if (!body.mediaId) {
    return NextResponse.json(
      { error: "Не выбрано изображение для видео." },
      { status: 400 },
    );
  }

  const mediaRows = await supabaseSelect<MediaRow>("product_studio_media", {
    filters: { id: body.mediaId },
  });
  const media = mediaRows?.[0];

  if (!media?.public_url) {
    return NextResponse.json(
      { error: "У выбранного изображения нет доступного файла." },
      { status: 404 },
    );
  }

  const [draftRows, productRows] = await Promise.all([
    supabaseSelect<DraftRow>("product_card_drafts", {
      filters: { id: media.draft_id },
    }),
    supabaseSelect<ProductRow>("products", {
      filters: { id: media.product_id },
    }),
  ]);

  const draft = draftRows?.[0];
  const product = productRows?.[0];

  if (!draft || !product) {
    return NextResponse.json(
      { error: "Не удалось найти карточку товара." },
      { status: 404 },
    );
  }

  const format = body.format ?? "vertical";
  const model = process.env.IMAGEROUTER_VIDEO_MODEL;
  const apiKey = process.env.IMAGEROUTER_API_KEY;
  const facts = Object.entries(product.specs ?? {})
    .slice(0, 10)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join("; ");

  const prompt = [
    `Create a short premium commercial video for ${product.name} by ${product.brand}.`,
    "The supplied image is the strict visual source of truth. Preserve exact product geometry, proportions, color, controls, visible materials and branding. Do not morph, redesign or add accessories.",
    `Verified facts: ${facts}.`,
    formatPrompt[format],
    "Motion: very slow elegant camera push-in and subtle parallax only. Product remains stable and readable. No hands, no people, no text, no UI, no logos appearing or changing, no dramatic transformations.",
    `Maintain the same visual style as the card: ${draft.visual_style?.mood ?? "premium clean e-commerce"}, ${draft.visual_style?.lighting ?? "soft studio light"}.`,
    "Duration about five seconds. Natural commercial sound is optional; no music and no narration.",
  ].join(" ");

  if (!apiKey || !model) {
    return NextResponse.json({
      ok: true,
      mode: "demo",
      video: null,
      sourceImage: media.public_url,
      warning:
        "Модель видео не настроена. Исходное изображение готово к генерации после подключения модели.",
    });
  }

  try {
    const response = await fetch(
      "https://api.imagerouter.io/v1/openai/videos/generations",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          model,
          size: "auto",
          seconds: 5,
          response_format: "url",
          image: media.public_url,
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Product studio video generation failed", response.status, errorText);
      return NextResponse.json(
        {
          ok: false,
          error: "ImageRouter не выполнил генерацию видео.",
          details: errorText.slice(0, 500),
        },
        { status: 502 },
      );
    }

    const payload = (await response.json()) as VideoResponse;
    const generatedUrl = payload.data?.[0]?.url;

    if (!generatedUrl) {
      return NextResponse.json(
        { error: "ImageRouter не вернул видеофайл." },
        { status: 502 },
      );
    }

    const path = `generated/${product.id}/${draft.id}/video-${Date.now()}.mp4`;
    const persisted = await persistRemoteAsset({
      sourceUrl: generatedUrl,
      bucket: "product-studio-media",
      path,
      fallbackContentType: "video/mp4",
    });

    if (!persisted) {
      return NextResponse.json(
        { error: "Видео создано, но не удалось сохранить его в Supabase." },
        { status: 502 },
      );
    }

    const inserted = await supabaseInsert<{ id: string }>(
      "product_studio_media",
      {
        draft_id: draft.id,
        product_id: product.id,
        media_kind: "video",
        aspect_ratio:
          format === "vertical" ? "9:16" : format === "horizontal" ? "16:9" : "1:1",
        storage_path: persisted.path,
        public_url: persisted.publicUrl,
        source_media_id: media.id,
        prompt,
        model,
        mode: "live",
        cost: payload.cost ?? null,
        latency_ms: payload.latency ?? null,
        metadata: {
          format,
          seconds: 5,
        },
      },
    );

    return NextResponse.json({
      ok: true,
      mode: "live",
      mediaId: inserted?.[0]?.id ?? null,
      video: persisted.publicUrl,
      sourceImage: media.public_url,
      format,
      cost: payload.cost ?? null,
      latency: payload.latency ?? null,
    });
  } catch (error) {
    console.error("Product studio video request failed", error);
    return NextResponse.json(
      { error: "Не удалось выполнить генерацию видео." },
      { status: 500 },
    );
  }
}
