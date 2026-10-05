import { NextResponse } from "next/server";
import { supabaseInsert, supabaseSelect } from "@/lib/supabase-rest";
import {
  dataUriToBytes,
  persistRemoteAsset,
  uploadBytesToPublicBucket,
} from "@/lib/supabase-storage";
import { clientMediaUrl } from "@/lib/media-url";

type MediaKind = "main" | "secondary" | "technical";

type DraftRow = {
  id: string;
  product_id: string;
  title: string | null;
  bullets: string[];
  attributes: Array<{ name: string; value: string; source: string }>;
  visual_style: {
    background?: string;
    lighting?: string;
    palette?: string;
    mood?: string;
  };
  source_image_url: string | null;
};

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  brand: string;
  category: string;
  specs: Record<string, string | number | boolean>;
};

type ImageRouterResponse = {
  data?: Array<{
    b64_json?: string;
    url?: string;
  }>;
  cost?: number;
  latency?: number;
};

const roleConfig: Record<
  MediaKind,
  {
    size: string;
    ratio: string;
    title: string;
    direction: string;
  }
> = {
  main: {
    size: "896x1200",
    ratio: "3:4",
    title: "Главная",
    direction:
      "MAIN WB SLIDE. Make the product very large and instantly recognizable, occupying roughly 55–70% of the composition. Create a bold colorful background with depth, gradients, abstract shapes and clean visual hierarchy. Put the product name/headline in a strong top zone and 2–3 strongest verified selling points as large infographic callouts or badges. The first slide must stop the scroll and remain readable on a phone screen.",
  },
  secondary: {
    size: "896x1200",
    ratio: "3:4",
    title: "Вспомогательная",
    direction:
      "SECONDARY WB SLIDE. Show the exact same product in a believable usage context or expressive commercial environment. Keep the product dominant. Explain practical value with 3 concise infographic callouts, icons and visual cues. Make this slide more lifestyle-oriented than the main slide, but still clearly a finished Wildberries product card, not a lifestyle photo.",
  },
  technical: {
    size: "896x1200",
    ratio: "3:4",
    title: "Техническая",
    direction:
      "TECHNICAL WB SLIDE. Create a clean but vivid technical infographic card. Show the exact product large, plus several neat detail callouts/crops of visible parts. Arrange 4–6 verified characteristics as large readable labels with values. Use icons, lines and structured blocks. Never show internal construction, dimensions or accessories unless explicitly present in verified facts.",
  },
};

function compact(value: string, max = 42) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= max
    ? normalized
    : normalized.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

function uniqueText(values: string[], max: number) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = compact(value, 48);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= max) break;
  }

  return result;
}

function roleCopy(kind: MediaKind, product: ProductRow, draft: DraftRow) {
  const bullets = uniqueText(draft.bullets ?? [], 5);
  const attributes = (draft.attributes ?? [])
    .filter((item) => item.name && item.value)
    .slice(0, 8)
    .map((item) => compact(`${item.name}: ${item.value}`, 48));

  if (kind === "technical") {
    return {
      headline: "Характеристики",
      lines: attributes.slice(0, 6),
    };
  }

  if (kind === "secondary") {
    return {
      headline: bullets[0] || compact(product.name, 38),
      lines: (bullets.length > 1 ? bullets.slice(1) : attributes).slice(0, 3),
    };
  }

  return {
    headline: compact(draft.title || product.name, 42),
    lines: (bullets.length ? bullets : attributes).slice(0, 3),
  };
}

function promptFor(
  kind: MediaKind,
  product: ProductRow,
  draft: DraftRow,
) {
  const role = roleConfig[kind];
  const copy = roleCopy(kind, product, draft);
  const facts = Object.entries(product.specs ?? {})
    .slice(0, 18)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join("; ");
  const mappedFacts = (draft.attributes ?? [])
    .slice(0, 18)
    .map((item) => `${item.name}: ${item.value}`)
    .join("; ");
  const style = draft.visual_style ?? {};

  return [
    "Create a COMPLETE FINISHED vertical 3:4 product card slide specifically for WILDBERRIES marketplace.",
    "This is NOT a plain product photo and NOT a minimalist studio shot. It must look like a high-performing modern Wildberries listing image: colorful, energetic, polished, conversion-focused, with professional Russian infographic typography integrated into the design.",
    `Exact product: ${product.name}. Brand: ${product.brand}. Category: ${product.category}.`,
    `Verified facts only: ${mappedFacts || facts}.`,
    draft.source_image_url
      ? "Use the supplied source image as the STRICT visual source of truth. Preserve the exact model, geometry, proportions, color, materials, buttons, controls, openings, handles, visible logo placement and identifiable details. Never morph it into a different model."
      : "Do not invent visible controls, accessories, materials, functions or construction details that are not supported by verified facts.",
    "ALL THREE SLIDES belong to one visual set. Keep the same product identity, same visual language, same palette family, same typography character and same infographic system.",
    `Shared style: background — ${style.background ?? "rich Wildberries-like purple/magenta gradient with bright contrasting zones"}; lighting — ${style.lighting ?? "premium commercial light with crisp product separation"}; palette — ${style.palette ?? "purple, magenta, pink, white, graphite, high contrast"}; mood — ${style.mood ?? "bright premium Wildberries marketplace infographic"}.`,
    role.direction,
    "TYPOGRAPHY RULES: all visible copy must be in Russian, large, highly legible on a mobile screen, with correct spelling. Avoid tiny paragraphs. Use short headlines, large numbers, icons, badges, ribbons or clean infographic cards. Never add random text, fake discounts, fake ratings, fake awards, fake guarantees or unverifiable claims.",
    `Render this headline exactly or as close as typography allows: «${copy.headline}».`,
    copy.lines.length
      ? `Use ONLY these verified callouts as infographic copy, without inventing new factual claims: ${copy.lines.map((line) => `«${line}»`).join("; ")}.`
      : "If there are not enough verified callouts, use fewer infographic blocks rather than inventing claims.",
    "COMPOSITION: premium commercial design, layered depth, clean negative space around text, strong hierarchy, product remains dominant, no watermark, no marketplace logo, no fake UI screenshot.",
    "Output one finished card image, ready to upload as a Wildberries listing slide.",
  ].join(" ");
}

async function persistImage(
  productId: string,
  draftId: string,
  kind: MediaKind,
  payload: ImageRouterResponse,
) {
  const item = payload.data?.[0];
  const path = `generated/${productId}/${draftId}/${kind}-${Date.now()}.webp`;

  if (item?.b64_json) {
    const parsed = dataUriToBytes(
      `data:image/webp;base64,${item.b64_json}`,
    );
    if (!parsed) return null;

    return uploadBytesToPublicBucket({
      bucket: "product-studio-media",
      path,
      bytes: parsed.bytes,
      contentType: parsed.contentType,
    });
  }

  if (item?.url) {
    return persistRemoteAsset({
      sourceUrl: item.url,
      bucket: "product-studio-media",
      path,
      fallbackContentType: "image/webp",
    });
  }

  return null;
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    draftId?: string;
    kind?: MediaKind;
  };

  if (
    !body.draftId ||
    !body.kind ||
    !["main", "secondary", "technical"].includes(body.kind)
  ) {
    return NextResponse.json(
      { error: "Не указаны черновик и тип изображения." },
      { status: 400 },
    );
  }

  const drafts = await supabaseSelect<DraftRow>("product_card_drafts", {
    filters: { id: body.draftId },
  });
  const draft = drafts?.[0];

  if (!draft) {
    return NextResponse.json({ error: "Черновик не найден." }, { status: 404 });
  }

  const products = await supabaseSelect<ProductRow>("products", {
    filters: { id: draft.product_id },
  });
  const product = products?.[0];

  if (!product) {
    return NextResponse.json({ error: "Товар не найден." }, { status: 404 });
  }

  const apiKey = process.env.IMAGEROUTER_API_KEY;
  const model = "google/nano-banana-2";
  const config = roleConfig[body.kind];
  const prompt = promptFor(body.kind, product, draft);

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "ImageRouter не подключён.",
        kind: body.kind,
      },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(
      "https://api.imagerouter.io/v1/openai/images/generations",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          model,
          size: config.size,
          response_format: "b64_json",
          output_format: "webp",
          ...(draft.source_image_url
            ? { image: draft.source_image_url }
            : {}),
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(150_000),
      },
    );

    if (!response.ok) {
      const details = await response.text();
      console.error(
        "Product studio image generation failed",
        response.status,
        details,
      );

      return NextResponse.json(
        {
          error: "ImageRouter не выполнил генерацию изображения.",
          details: details.slice(0, 500),
          kind: body.kind,
        },
        { status: 502 },
      );
    }

    const payload = (await response.json()) as ImageRouterResponse;
    const persisted = await persistImage(
      product.id,
      draft.id,
      body.kind,
      payload,
    );

    if (!persisted) {
      console.error(
        "Generated image could not be persisted",
        draft.id,
        body.kind,
      );
      return NextResponse.json(
        {
          error:
            "Изображение создано, но хранилище не подтвердило сохранение после повторных попыток.",
          kind: body.kind,
          retryable: true,
        },
        { status: 502 },
      );
    }

    const inserted = await supabaseInsert<{ id: string }>(
      "product_studio_media",
      {
        draft_id: draft.id,
        product_id: product.id,
        media_kind: body.kind,
        aspect_ratio: config.ratio,
        storage_path: persisted.path,
        public_url: persisted.publicUrl,
        prompt,
        model,
        mode: "live",
        cost: payload.cost ?? null,
        latency_ms: payload.latency ?? null,
        metadata: {
          roleTitle: config.title,
          size: config.size,
          marketplace: "Wildberries",
          promptVersion: "wb-infographic-v2",
        },
      },
    );

    if (!inserted?.[0]) {
      return NextResponse.json(
        {
          error: "Файл сохранён, но не удалось записать медиа в проект карточки.",
          kind: body.kind,
          retryable: true,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      mediaId: inserted[0].id,
      kind: body.kind,
      title: config.title,
      aspectRatio: config.ratio,
      image: clientMediaUrl(persisted.publicUrl),
      mode: "live",
      model,
      cost: payload.cost ?? null,
      latency: payload.latency ?? null,
      warning: null,
    });
  } catch (error) {
    console.error("Product studio image request failed", error);
    return NextResponse.json(
      {
        error: "Не удалось выполнить генерацию изображения.",
        kind: body.kind,
        retryable: true,
      },
      { status: 500 },
    );
  }
}
