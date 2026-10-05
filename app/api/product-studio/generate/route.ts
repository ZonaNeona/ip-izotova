import { NextResponse } from "next/server";
import { openRouterJson } from "@/lib/openrouter";
import { supabaseInsert, supabaseSelect } from "@/lib/supabase-rest";
import {
  dataUriToBytes,
  uploadBytesToPublicBucket,
} from "@/lib/supabase-storage";

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  brand: string;
  category: string;
  warranty_months: number;
  specs: Record<string, string | number | boolean>;
  thumbnail_path: string | null;
};

type StudioRequest = {
  sku?: string;
  targetChannel?: "both" | "wb" | "ozon";
  researchEnabled?: boolean;
  sourceImage?: string | null;
};

type Attribute = {
  name: string;
  value: string;
  source: "Каталог" | "Интернет";
};

type ResearchSource = {
  title: string;
  url: string;
  verifiedFact: string;
};

type CardAnswer = {
  title: string;
  description: string;
  bullets: string[];
  category: string;
  searchPhrases: string[];
  attributes: Attribute[];
  researchSummary: string;
  researchSources: ResearchSource[];
  visualStyle: {
    background: string;
    lighting: string;
    palette: string;
    mood: string;
  };
};

const schema = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "description",
    "bullets",
    "category",
    "searchPhrases",
    "attributes",
    "researchSummary",
    "researchSources",
    "visualStyle",
  ],
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    bullets: {
      type: "array",
      minItems: 4,
      maxItems: 7,
      items: { type: "string" },
    },
    category: { type: "string" },
    searchPhrases: {
      type: "array",
      minItems: 4,
      maxItems: 10,
      items: { type: "string" },
    },
    attributes: {
      type: "array",
      minItems: 1,
      maxItems: 24,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "value", "source"],
        properties: {
          name: { type: "string" },
          value: { type: "string" },
          source: { type: "string", enum: ["Каталог", "Интернет"] },
        },
      },
    },
    researchSummary: { type: "string" },
    researchSources: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "url", "verifiedFact"],
        properties: {
          title: { type: "string" },
          url: { type: "string" },
          verifiedFact: { type: "string" },
        },
      },
    },
    visualStyle: {
      type: "object",
      additionalProperties: false,
      required: ["background", "lighting", "palette", "mood"],
      properties: {
        background: { type: "string" },
        lighting: { type: "string" },
        palette: { type: "string" },
        mood: { type: "string" },
      },
    },
  },
};

function catalogAttributes(product: ProductRow): Attribute[] {
  const rows = Object.entries(product.specs ?? {}).map(([name, value]) => ({
    name,
    value: String(value),
    source: "Каталог" as const,
  }));

  if (
    product.warranty_months &&
    !rows.some((item) => item.name.toLowerCase().includes("гаран"))
  ) {
    rows.push({
      name: "Гарантия",
      value: `${product.warranty_months} мес.`,
      source: "Каталог",
    });
  }

  return rows;
}

function fallbackAnswer(product: ProductRow): CardAnswer {
  const attributes = catalogAttributes(product);
  const featureText = attributes
    .slice(0, 5)
    .map((item) => `${item.name.toLowerCase()} — ${item.value}`)
    .join(", ");

  return {
    title: product.name,
    description:
      `${product.name} — товар категории «${product.category}». ` +
      `Ключевые характеристики из каталога: ${featureText}. ` +
      "Описание сформировано только по подтверждённым данным товара.",
    bullets: attributes.slice(0, 6).map(
      (item) => `${item.name}: ${item.value}`,
    ),
    category: product.category,
    searchPhrases: [
      product.name.toLowerCase(),
      product.brand.toLowerCase(),
      product.category.toLowerCase(),
      `${product.brand} ${product.category}`.toLowerCase(),
    ],
    attributes,
    researchSummary:
      "Использованы подтверждённые характеристики из внутреннего каталога.",
    researchSources: [],
    visualStyle: {
      background:
        "светлый нейтральный фон с едва заметным холодно-лиловым градиентом",
      lighting:
        "мягкий премиальный студийный свет, естественные блики и аккуратная тень",
      palette:
        "белый, графитовый, натуральные материалы товара и очень деликатный ягодно-лиловый акцент",
      mood:
        "современная премиальная коммерческая съёмка маркетплейса без визуального шума",
    },
  };
}

async function persistSourceImage(
  productId: string,
  sourceImage?: string | null,
) {
  if (!sourceImage) return null;
  if (!sourceImage.startsWith("data:")) return sourceImage;

  const parsed = dataUriToBytes(sourceImage);
  if (!parsed) return null;

  const extension = parsed.contentType.includes("png")
    ? "png"
    : parsed.contentType.includes("jpeg")
      ? "jpg"
      : "webp";
  const path = `sources/${productId}/${Date.now()}.${extension}`;

  const uploaded = await uploadBytesToPublicBucket({
    bucket: "product-studio-media",
    path,
    bytes: parsed.bytes,
    contentType: parsed.contentType,
  });

  return uploaded?.publicUrl ?? null;
}

export async function POST(request: Request) {
  const body = (await request.json()) as StudioRequest;

  if (!body.sku) {
    return NextResponse.json(
      { error: "Не выбран товар для генерации." },
      { status: 400 },
    );
  }

  const products = await supabaseSelect<ProductRow>("products", {
    filters: { sku: body.sku },
  });
  const product = products?.[0];

  if (!product) {
    return NextResponse.json({ error: "Товар не найден." }, { status: 404 });
  }

  const fallback = fallbackAnswer(product);
  const researchEnabled = Boolean(body.researchEnabled);

  const result = await openRouterJson<CardAnswer>({
    schemaName: "marketplace_product_studio_card",
    schema,
    fallback,
    webSearch: researchEnabled,
    system:
      "Ты senior e-commerce контент-редактор маркетплейса. Создай карточку товара на русском языке. " +
      "Внутренний каталог — главный источник истины. Никогда не меняй и не опровергай факты из catalogSpecs. " +
      "Если web search включён, используй интернет только для подтверждения или заполнения отсутствующих характеристик конкретной модели. " +
      "Добавляй интернет-факт только если источник явно относится к этой модели и не противоречит каталогу. " +
      "Не придумывай сертификаты, комплектацию, материалы, размеры, совместимость, мощность, гарантию или функции. " +
      "Если надёжного факта нет — не добавляй его. researchSources должны содержать только реально использованные URL. " +
      "Стиль текста: профессионально, спокойно, без крикливых обещаний. visualStyle должен описывать единый премиальный стиль для серии из трёх изображений.",
    user: JSON.stringify({
      targetChannel: body.targetChannel ?? "both",
      product: {
        sku: product.sku,
        name: product.name,
        brand: product.brand,
        category: product.category,
        warrantyMonths: product.warranty_months,
      },
      catalogSpecs: product.specs ?? {},
      webResearchRequested: researchEnabled,
    }),
  });

  const sourceImageUrl = await persistSourceImage(
    product.id,
    body.sourceImage ||
      (product.thumbnail_path
        ? `${process.env.SUPABASE_URL}/storage/v1/object/public/product-thumbnails/${encodeURIComponent(product.thumbnail_path)}`
        : null),
  );

  const inserted = await supabaseInsert<{
    id: string;
    product_id: string;
  }>("product_card_drafts", {
    product_id: product.id,
    target_channel: body.targetChannel ?? "both",
    status: "draft",
    title: result.data.title,
    description: result.data.description,
    bullets: result.data.bullets,
    attributes: result.data.attributes,
    search_phrases: result.data.searchPhrases,
    research_enabled: researchEnabled,
    research_summary: result.data.researchSummary,
    research_sources: result.data.researchSources,
    visual_style: result.data.visualStyle,
    source_image_url: sourceImageUrl,
    generated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const draft = inserted?.[0];
  if (!draft) {
    return NextResponse.json(
      { error: "Не удалось сохранить черновик карточки." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    mode: result.mode,
    draftId: draft.id,
    product: {
      id: product.id,
      sku: product.sku,
      name: product.name,
      brand: product.brand,
      category: product.category,
      specs: product.specs ?? {},
      sourceImageUrl,
    },
    content: result.data,
  });
}
