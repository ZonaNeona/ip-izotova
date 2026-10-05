import { NextResponse } from "next/server";
import { supabaseInsert, supabaseSelect } from "@/lib/supabase-rest";
import {
  dataUriToBytes,
  persistRemoteAsset,
  uploadBytesToPublicBucket,
} from "@/lib/supabase-storage";

type MediaKind = "main" | "secondary" | "technical";

type DraftRow = {
  id: string;
  product_id: string;
  title: string | null;
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
    size: "1024x1024",
    ratio: "1:1",
    title: "Главная",
    direction:
      "Главное изображение карточки. Один товар полностью в кадре, центрирован, крупный масштаб, чистый светлый фон, естественная мягкая тень. Никаких надписей, плашек, дополнительных предметов и людей.",
  },
  secondary: {
    size: "1024x1536",
    ratio: "2:3",
    title: "Вспомогательная",
    direction:
      "Вспомогательный lifestyle-кадр. Тот же самый товар в аккуратной реалистичной среде использования, но товар остаётся главным объектом и хорошо читается. Без людей, без текста, без лишнего декора и без изменения конструкции товара.",
  },
  technical: {
    size: "1024x1024",
    ratio: "1:1",
    title: "Техническая",
    direction:
      "Технический коммерческий кадр. Тот же товар на нейтральном фоне, основной ракурс три четверти и 1-2 аккуратных detail-inset фрагмента реально видимых деталей. Без подписей и чисел: характеристики будут наложены интерфейсом отдельно. Не показывай скрытые внутренности и не придумывай конструкцию.",
  },
};

function promptFor(
  kind: MediaKind,
  product: ProductRow,
  draft: DraftRow,
) {
  const role = roleConfig[kind];
  const facts = Object.entries(product.specs ?? {})
    .slice(0, 12)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join("; ");

  const style = draft.visual_style ?? {};

  return [
    "Create a premium marketplace product photograph.",
    `Exact product: ${product.name}. Brand: ${product.brand}. Category: ${product.category}.`,
    `Verified product facts: ${facts}.`,
    draft.source_image_url
      ? "Use the supplied source image as the strict visual source of truth. Preserve exact geometry, proportions, color, material appearance, controls, visible logo placement and all identifiable details. Do not redesign or beautify the product into a different model."
      : "Do not invent visible functions, controls, accessories, labels or construction details not supported by the verified facts.",
    `Shared visual system for all three images: background — ${style.background ?? "light neutral"}; lighting — ${style.lighting ?? "soft premium studio light"}; palette — ${style.palette ?? "neutral premium"}; mood — ${style.mood ?? "clean high-end e-commerce"}.`,
    role.direction,
    "Photorealistic, premium commercial photography, physically believable materials, realistic shadow and reflections, no watermark, no UI, no badges, no promotional text.",
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

  if (item?.url) {
    return persistRemoteAsset({
      sourceUrl: item.url,
      bucket: "product-studio-media",
      path,
      fallbackContentType: "image/webp",
    });
  }

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
  const model = process.env.IMAGEROUTER_MODEL ?? "openai/gpt-image-2";
  const config = roleConfig[body.kind];
  const prompt = promptFor(body.kind, product, draft);

  let mode: "live" | "demo" = "demo";
  let imageUrl = draft.source_image_url;
  let storagePath: string | null = null;
  let cost: number | null = null;
  let latency: number | null = null;
  let warning: string | null = null;

  if (apiKey) {
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
            quality: "auto",
            size: config.size,
            response_format: "url",
            output_format: "webp",
            ...(draft.source_image_url
              ? { image: draft.source_image_url }
              : {}),
          }),
          cache: "no-store",
        },
      );

      if (response.ok) {
        const payload = (await response.json()) as ImageRouterResponse;
        const persisted = await persistImage(
          product.id,
          draft.id,
          body.kind,
          payload,
        );

        if (persisted) {
          imageUrl = persisted.publicUrl;
          storagePath = persisted.path;
          mode = "live";
          cost = payload.cost ?? null;
          latency = payload.latency ?? null;
        } else {
          warning =
            "Изображение сгенерировано, но не удалось сохранить его в хранилище.";
        }
      } else {
        warning = "ImageRouter не выполнил генерацию. Показан исходный кадр.";
        console.error(
          "Product studio image generation failed",
          response.status,
          await response.text(),
        );
      }
    } catch (error) {
      console.error("Product studio image request failed", error);
      warning = "Ошибка генерации. Показан исходный кадр.";
    }
  } else {
    warning = "ImageRouter не подключён. Показан исходный кадр.";
  }

  const inserted = await supabaseInsert<{ id: string }>(
    "product_studio_media",
    {
      draft_id: draft.id,
      product_id: product.id,
      media_kind: body.kind,
      aspect_ratio: config.ratio,
      storage_path: storagePath,
      public_url: imageUrl,
      prompt,
      model,
      mode,
      cost,
      latency_ms: latency,
      metadata: {
        roleTitle: config.title,
        size: config.size,
      },
    },
  );

  return NextResponse.json({
    ok: true,
    mediaId: inserted?.[0]?.id ?? null,
    kind: body.kind,
    title: config.title,
    aspectRatio: config.ratio,
    image: imageUrl,
    mode,
    cost,
    latency,
    warning,
  });
}
