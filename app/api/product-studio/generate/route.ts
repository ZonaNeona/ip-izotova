import { NextResponse } from "next/server";
import { openRouterJson } from "@/lib/openrouter";
import { supabaseInsert, supabaseSelect } from "@/lib/supabase-rest";
import {
  dataUriToBytes,
  uploadBytesToPublicBucket,
} from "@/lib/supabase-storage";

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

type SourceMetadata = {
  researchSummary?: string;
  researchSources?: Array<{
    title?: string;
    url?: string;
    verifiedFact?: string;
  }>;
  benefits?: string[];
  model?: string;
};

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  brand: string;
  category: string;
  warranty_months: number;
  specs: Record<string, string | number | boolean>;
  thumbnail_path: string | null;
  source: string;
  source_url: string | null;
  source_metadata: SourceMetadata | null;
  wb_subject_id: number | null;
  wb_subject_name: string | null;
  wb_characteristics: Array<{
    name?: string;
    value?: string;
    sourceUrl?: string;
  }> | null;
};

type StudioRequest = {
  sku?: string;
  researchEnabled?: boolean;
  sourceImage?: string | null;
  sourceMode?: "catalog" | "scratch";
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
      maxItems: 28,
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
      maxItems: 8,
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
  const source: Attribute["source"] =
    product.source === "web_discovery" ? "Интернет" : "Каталог";

  const rows = Object.entries(product.specs ?? {}).map(([name, value]) => ({
    name,
    value: String(value),
    source,
  }));

  if (
    product.warranty_months &&
    !rows.some((item) => item.name.toLowerCase().includes("гаран")) &&
    product.source !== "web_discovery"
  ) {
    rows.push({
      name: "Гарантия",
      value: `${product.warranty_months} мес.`,
      source: "Каталог",
    });
  }

  return rows;
}

function metadataSources(product: ProductRow): ResearchSource[] {
  const rows = product.source_metadata?.researchSources ?? [];

  return rows
    .filter((item) => Boolean(item.url))
    .slice(0, 8)
    .map((item) => ({
      title: item.title?.trim() || "Источник",
      url: item.url!.trim(),
      verifiedFact: item.verifiedFact?.trim() || "Характеристики товара",
    }));
}

function fallbackAnswer(product: ProductRow): CardAnswer {
  const attributes = catalogAttributes(product);
  const featureText = attributes
    .slice(0, 5)
    .map((item) => `${item.name.toLowerCase()} — ${item.value}`)
    .join(", ");

  const benefits =
    product.source_metadata?.benefits?.filter(Boolean).slice(0, 6) ?? [];
  const sources = metadataSources(product);

  return {
    title: product.name,
    description:
      `${product.name} — товар категории «${product.category}». ` +
      `Ключевые подтверждённые характеристики: ${featureText}. ` +
      "Описание сформировано только по проверенным данным товара.",
    bullets:
      benefits.length >= 4
        ? benefits
        : attributes
            .slice(0, 6)
            .map((item) => `${item.name}: ${item.value}`),
    category: product.category,
    searchPhrases: [
      product.name.toLowerCase(),
      product.brand.toLowerCase(),
      product.category.toLowerCase(),
      `${product.brand} ${product.category}`.toLowerCase(),
    ].filter(Boolean),
    attributes,
    researchSummary:
      product.source_metadata?.researchSummary ||
      (product.source === "web_discovery"
        ? "Характеристики собраны и проверены по открытым источникам."
        : "Использованы подтверждённые характеристики из внутреннего каталога."),
    researchSources: sources,
    visualStyle: {
      background:
        "яркий современный градиент Wildberries: насыщенный фиолетовый, маджента, розовый и светлые контрастные зоны",
      lighting:
        "чистый премиальный рекламный свет на товаре, объёмные блики, чёткое отделение товара от яркой инфографики",
      palette:
        "Wildberries vibe: фиолетовый, маджента, розовый, белый и графитовый с контрастными акцентами",
      mood:
        "готовая яркая продающая карточка Wildberries с крупной мобильной типографикой, инфографикой и коммерческим wow-эффектом",
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

  const uploaded = await uploadBytesToPublicBucket({
    bucket: "product-studio-media",
    path: `sources/${productId}/manual-${Date.now()}.${extension}`,
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
  const discovered = product.source === "web_discovery";
  const shouldSearchWeb = Boolean(body.researchEnabled && !discovered);

  const result = await openRouterJson<CardAnswer>({
    schemaName: "wildberries_product_studio_card",
    schema,
    fallback,
    webSearch: shouldSearchWeb,
    webFetch: shouldSearchWeb,
    system:
      "Ты senior e-commerce контент-редактор Wildberries. Создай профессиональный контент карточки товара на русском языке. " +
      "Работаем именно для Wildberries: короткий мобильный заголовок, сильные тезисы и конкретные характеристики. " +
      "Главный принцип — ни одного выдуманного факта. catalogSpecs и discoveryContext являются источником истины. " +
      "Если web search включён, интернет можно использовать только для подтверждения или заполнения отсутствующих характеристик ТОЧНОЙ модели. " +
      "Не придумывай размеры, материалы, мощность, комплектацию, совместимость, гарантию, сертификаты или функции. " +
      "bullets должны быть короткими и пригодными как текстовые тезисы для инфографики на изображении Wildberries. " +
      "Каждый тезис желательно 2–6 слов + конкретное значение, если оно подтверждено. " +
      "visualStyle должен описывать единый яркий дизайн-сет из трёх вертикальных 3:4 слайдов Wildberries: насыщенный цвет, крупная инфографика, мобильная читаемость, один визуальный язык.",
    user: JSON.stringify({
      marketplace: "Wildberries",
      product: {
        sku: product.sku,
        name: product.name,
        brand: product.brand,
        category: product.category,
        wbSubjectId: product.wb_subject_id,
        wbSubjectName: product.wb_subject_name,
      },
      catalogSpecs: product.specs ?? {},
      wbMappedCharacteristics: product.wb_characteristics ?? [],
      discoveryContext: product.source_metadata ?? {},
      researchRequested: shouldSearchWeb,
    }),
  });

  const sourceImageUrl = await persistSourceImage(
    product.id,
    body.sourceImage ||
      (product.thumbnail_path
        ? `${process.env.SUPABASE_URL}/storage/v1/object/public/product-thumbnails/${encodeURIComponent(product.thumbnail_path)}`
        : null),
  );

  const finalContent: CardAnswer = {
    ...result.data,
    researchSummary:
      discovered && !result.data.researchSummary
        ? fallback.researchSummary
        : result.data.researchSummary,
    researchSources:
      discovered && result.data.researchSources.length === 0
        ? fallback.researchSources
        : result.data.researchSources,
  };

  const inserted = await supabaseInsert<{
    id: string;
    product_id: string;
  }>("product_card_drafts", {
    product_id: product.id,
    target_channel: "wb",
    source_mode: body.sourceMode ?? (discovered ? "scratch" : "catalog"),
    status: "draft",
    title: finalContent.title,
    description: finalContent.description,
    bullets: finalContent.bullets,
    attributes: finalContent.attributes,
    search_phrases: finalContent.searchPhrases,
    research_enabled: discovered || Boolean(body.researchEnabled),
    research_summary: finalContent.researchSummary,
    research_sources: finalContent.researchSources,
    visual_style: finalContent.visualStyle,
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
      wbSubjectId: product.wb_subject_id,
      wbSubjectName: product.wb_subject_name,
      sourceImageUrl,
    },
    content: finalContent,
  });
}
