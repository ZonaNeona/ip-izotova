import { NextResponse } from "next/server";
import { openRouterJson } from "@/lib/openrouter";
import {
  supabaseInsert,
  supabasePatch,
} from "@/lib/supabase-rest";
import { uploadBytesToPublicBucket } from "@/lib/supabase-storage";

const WB_BASE = "https://content-api-sandbox.wildberries.ru";

type IdentitySpec = {
  name: string;
  value: string;
  sourceUrl: string;
};

type SearchSource = {
  title: string;
  url: string;
};

type IdentityResult = {
  resolvedName: string;
  brand: string;
  model: string;
  category: string;
  wbSearchTerm: string;
  sourcePageUrl: string;
  primaryImageUrl: string;
  alternateImageUrls: string[];
  observedSpecs: IdentitySpec[];
  sources: SearchSource[];
  confidence: "Высокая" | "Средняя" | "Низкая";
};

type WbSubject = {
  subjectID?: number;
  subjectName?: string;
  parentID?: number;
  parentName?: string;
};

type WbCharacteristic = {
  charcID: number;
  name: string;
  required?: boolean;
  isRequiredForCreate?: boolean;
  hasFilter?: boolean;
  existNamedField?: boolean;
  charcType?: number;
};

type MappedAttribute = {
  wbCharacteristicId: number;
  name: string;
  value: string;
  sourceUrl: string;
  confidence: "Высокая" | "Средняя";
  evidence: string;
};

type ResearchResult = {
  attributes: MappedAttribute[];
  benefits: string[];
  summary: string;
  sources: SearchSource[];
};

const identitySchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "resolvedName",
    "brand",
    "model",
    "category",
    "wbSearchTerm",
    "sourcePageUrl",
    "primaryImageUrl",
    "alternateImageUrls",
    "observedSpecs",
    "sources",
    "confidence",
  ],
  properties: {
    resolvedName: { type: "string" },
    brand: { type: "string" },
    model: { type: "string" },
    category: { type: "string" },
    wbSearchTerm: { type: "string" },
    sourcePageUrl: { type: "string" },
    primaryImageUrl: { type: "string" },
    alternateImageUrls: {
      type: "array",
      maxItems: 5,
      items: { type: "string" },
    },
    observedSpecs: {
      type: "array",
      maxItems: 30,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "value", "sourceUrl"],
        properties: {
          name: { type: "string" },
          value: { type: "string" },
          sourceUrl: { type: "string" },
        },
      },
    },
    sources: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "url"],
        properties: {
          title: { type: "string" },
          url: { type: "string" },
        },
      },
    },
    confidence: {
      type: "string",
      enum: ["Высокая", "Средняя", "Низкая"],
    },
  },
};

const mappedSchema = {
  type: "object",
  additionalProperties: false,
  required: ["attributes", "benefits", "summary", "sources"],
  properties: {
    attributes: {
      type: "array",
      maxItems: 30,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "wbCharacteristicId",
          "name",
          "value",
          "sourceUrl",
          "confidence",
          "evidence",
        ],
        properties: {
          wbCharacteristicId: { type: "number" },
          name: { type: "string" },
          value: { type: "string" },
          sourceUrl: { type: "string" },
          confidence: {
            type: "string",
            enum: ["Высокая", "Средняя"],
          },
          evidence: { type: "string" },
        },
      },
    },
    benefits: {
      type: "array",
      maxItems: 8,
      items: { type: "string" },
    },
    summary: { type: "string" },
    sources: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "url"],
        properties: {
          title: { type: "string" },
          url: { type: "string" },
        },
      },
    },
  },
};

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return Math.abs(result >>> 0).toString(36).toUpperCase();
}

function safeUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;

    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "::1" ||
      host.startsWith("127.") ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

function htmlImage(html: string, pageUrl: URL) {
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;
    try {
      return new URL(match[1], pageUrl).toString();
    } catch {
      // keep trying
    }
  }

  return null;
}

async function downloadImage(candidate: string) {
  const url = safeUrl(candidate);
  if (!url) return null;

  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; MarketplaceStudio/1.0; +https://vercel.app)",
        Accept: "image/avif,image/webp,image/png,image/jpeg,text/html;q=0.8,*/*;q=0.5",
      },
    });

    if (!response.ok) return null;

    const type = response.headers.get("content-type")?.split(";")[0] ?? "";

    if (type.startsWith("image/")) {
      const length = Number(response.headers.get("content-length") ?? 0);
      if (length > 15 * 1024 * 1024) return null;

      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength < 2_000 || bytes.byteLength > 15 * 1024 * 1024) {
        return null;
      }

      return {
        bytes,
        contentType: type,
        originalUrl: response.url,
      };
    }

    if (type.includes("text/html")) {
      const html = await response.text();
      const discovered = htmlImage(html.slice(0, 800_000), new URL(response.url));
      if (discovered && discovered !== candidate) {
        return downloadImage(discovered);
      }
    }
  } catch (error) {
    console.error("Source image download failed", candidate, error);
  }

  return null;
}

async function saveDiscoveredImage(
  productId: string,
  candidates: string[],
) {
  for (const candidate of candidates) {
    const image = await downloadImage(candidate);
    if (!image) continue;

    const extension = image.contentType.includes("png")
      ? "png"
      : image.contentType.includes("jpeg") ||
          image.contentType.includes("jpg")
        ? "jpg"
        : "webp";

    const uploaded = await uploadBytesToPublicBucket({
      bucket: "product-studio-media",
      path: `sources/web/${productId}/source-${Date.now()}.${extension}`,
      bytes: image.bytes,
      contentType: image.contentType,
    });

    if (uploaded) {
      return {
        publicUrl: uploaded.publicUrl,
        originalUrl: image.originalUrl,
      };
    }
  }

  return null;
}

async function wbJson<T>(path: string): Promise<T | null> {
  const token = process.env.WB_SANDBOX_TOKEN;
  if (!token || (process.env.WB_API_MODE ?? "sandbox") !== "sandbox") {
    return null;
  }

  try {
    const response = await fetch(`${WB_BASE}${path}`, {
      headers: {
        Authorization: token,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch (error) {
    console.error("WB taxonomy lookup failed", path, error);
    return null;
  }
}

function subjectScore(subject: WbSubject, terms: string[]) {
  const name = (subject.subjectName ?? "").toLowerCase();
  const parent = (subject.parentName ?? "").toLowerCase();
  let score = 0;

  for (const term of terms) {
    const normalized = term.toLowerCase().trim();
    if (!normalized) continue;
    if (name === normalized) score += 10;
    else if (name.includes(normalized) || normalized.includes(name)) score += 5;
    if (parent.includes(normalized)) score += 2;
  }

  return score;
}

async function findWbSchema(identity: IdentityResult) {
  const queries = [
    identity.wbSearchTerm,
    identity.category,
    identity.resolvedName
      .split(/[\s,–—-]+/)
      .slice(-3)
      .join(" "),
  ].filter(Boolean);

  const subjects: WbSubject[] = [];

  for (const query of queries) {
    const params = new URLSearchParams({
      name: query,
      limit: "100",
      offset: "0",
    });
    const payload = await wbJson<{ data?: WbSubject[] }>(
      `/content/v2/object/all?${params.toString()}`,
    );
    for (const item of payload?.data ?? []) {
      if (
        item.subjectID &&
        !subjects.some((subject) => subject.subjectID === item.subjectID)
      ) {
        subjects.push(item);
      }
    }
    if (subjects.length) break;
  }

  const subject = [...subjects].sort(
    (a, b) =>
      subjectScore(b, queries) - subjectScore(a, queries),
  )[0];

  if (!subject?.subjectID) {
    return { subject: null, characteristics: [] as WbCharacteristic[] };
  }

  const chars = await wbJson<{ data?: WbCharacteristic[] }>(
    `/content/v2/object/charcs/${subject.subjectID}`,
  );

  const characteristics = (chars?.data ?? [])
    .filter(
      (item) =>
        !item.existNamedField &&
        item.charcType !== 0 &&
        Boolean(item.name),
    )
    .sort((a, b) => {
      const aPriority =
        Number(Boolean(a.required || a.isRequiredForCreate)) * 3 +
        Number(Boolean(a.hasFilter));
      const bPriority =
        Number(Boolean(b.required || b.isRequiredForCreate)) * 3 +
        Number(Boolean(b.hasFilter));
      return bPriority - aPriority;
    })
    .slice(0, 30);

  return { subject, characteristics };
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    url?: string | null;
  };

  const query = body.name?.trim();
  if (!query) {
    return NextResponse.json(
      { error: "Введите название товара." },
      { status: 400 },
    );
  }

  const providedUrl = safeUrl(body.url?.trim())?.toString() ?? "";

  const identityFallback: IdentityResult = {
    resolvedName: query,
    brand: "Не определён",
    model: "",
    category: "Товар",
    wbSearchTerm: query,
    sourcePageUrl: providedUrl,
    primaryImageUrl: "",
    alternateImageUrls: [],
    observedSpecs: [],
    sources: providedUrl
      ? [{ title: "Ссылка пользователя", url: providedUrl }]
      : [],
    confidence: "Низкая",
  };

  let identity;
  try {
    identity = await openRouterJson<IdentityResult>({
      schemaName: "product_web_identity",
      schema: identitySchema,
      fallback: identityFallback,
      webSearch: true,
      webFetch: false,
      strict: true,
    system:
      "Ты товарный исследователь для seller-команды Wildberries. Найди ТОЧНО тот товар/модель, которую указал пользователь. " +
      "Если дана ссылка, сначала используй её как приоритетный источник и проверь модель. Затем при необходимости ищи официальный сайт производителя и крупные надёжные магазины. " +
      "Нужно определить точное название, бренд, модель, товарную категорию, подходящий русский поисковый термин для предмета Wildberries, одну основную исходную фотографию товара и характеристики. " +
      "primaryImageUrl должен быть URL максимально чистого фото конкретной модели без водяного знака; предпочитай официальный сайт производителя, CDN производителя или крупный магазин. " +
      "Если не уверен, не подменяй товар похожей моделью. observedSpecs включай только с явным источником. URLs должны быть реальными URL, полученными из поиска/страниц, а не придуманными.",
      user: JSON.stringify({
        query,
        preferredUrl: providedUrl || null,
        task:
          "Обязательно выполни веб-поиск. Найди точную модель, минимум 2 реальных источника, исходное фото/страницу с фото, категорию и проверяемые характеристики для создания карточки Wildberries.",
      }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          "Веб-поиск OpenRouter не выполнился. Пустой товар не создан.",
        details:
          error instanceof Error ? error.message.slice(0, 700) : "Unknown error",
      },
      { status: 502 },
    );
  }

  const hasEvidence =
    identity.data.sources.some((item) => Boolean(safeUrl(item.url))) ||
    identity.data.observedSpecs.some(
      (item) => Boolean(item.value?.trim()) && Boolean(safeUrl(item.sourceUrl)),
    );

  if (
    !hasEvidence ||
    !identity.data.resolvedName.trim() ||
    identity.data.confidence === "Низкая"
  ) {
    return NextResponse.json(
      {
        error:
          "Поиск не смог надёжно идентифицировать точную модель. Попробуйте уточнить название или добавьте ссылку на товар.",
        search: {
          resolvedName: identity.data.resolvedName,
          confidence: identity.data.confidence,
          sources: identity.data.sources.length,
          specs: identity.data.observedSpecs.length,
        },
      },
      { status: 422 },
    );
  }

  const { subject, characteristics } = await findWbSchema(identity.data);

  const allowedById = new Map(
    characteristics.map((item) => [item.charcID, item]),
  );

  let research: ResearchResult = {
    attributes: identity.data.observedSpecs.slice(0, 24).map((item, index) => ({
      wbCharacteristicId: -(index + 1),
      name: item.name,
      value: item.value,
      sourceUrl: item.sourceUrl,
      confidence: "Средняя",
      evidence: item.value,
    })),
    benefits: [],
    summary:
      "Характеристики собраны из открытых источников. Справочник WB не удалось сопоставить.",
    sources: identity.data.sources,
  };

  if (characteristics.length) {
    const result = await openRouterJson<ResearchResult>({
      schemaName: "product_wb_characteristics",
      schema: mappedSchema,
      fallback: {
        attributes: [],
        benefits: [],
        summary:
          "Не удалось автоматически подтвердить характеристики по полям WB.",
        sources: identity.data.sources,
      },
      webSearch: true,
      webFetch: true,
      system:
        "Ты заполняешь характеристики карточки Wildberries только подтверждёнными данными конкретной модели. " +
        "Во входных данных дан официальный список полей WB с charcID. Ищи значения именно для этих полей. " +
        "Нельзя переносить данные от похожих моделей, нельзя угадывать. Если конкретное поле не подтверждено источником — пропусти его. " +
        "Для каждого заполненного поля укажи реальный sourceUrl и короткое evidence. " +
        "benefits — только практические преимущества, прямо следующие из подтверждённых характеристик. " +
        "Не придумывай рекламные обещания, сертификаты или комплектацию.",
      user: JSON.stringify({
        product: {
          name: identity.data.resolvedName,
          brand: identity.data.brand,
          model: identity.data.model,
          category: identity.data.category,
        },
        preferredUrl: providedUrl || identity.data.sourcePageUrl || null,
        alreadyObserved: identity.data.observedSpecs,
        wbSubject: {
          id: subject?.subjectID ?? null,
          name: subject?.subjectName ?? null,
        },
        wbFields: characteristics.map((item) => ({
          id: item.charcID,
          name: item.name,
          required: Boolean(item.required || item.isRequiredForCreate),
          filter: Boolean(item.hasFilter),
          type: item.charcType ?? null,
        })),
      }),
    });

    research = {
      ...result.data,
      attributes: result.data.attributes.filter((item) => {
        const meta = allowedById.get(item.wbCharacteristicId);
        return Boolean(meta && item.value.trim());
      }),
    };
  }

  const specs =
    research.attributes.length > 0
      ? Object.fromEntries(
          research.attributes.map((item) => [item.name, item.value]),
        )
      : Object.fromEntries(
          identity.data.observedSpecs.map((item) => [item.name, item.value]),
        );

  const sku = `WEB-${Date.now().toString(36).toUpperCase()}-${hash(
    identity.data.resolvedName,
  ).slice(0, 6)}`;

  const inserted = await supabaseInsert<{
    id: string;
    sku: string;
  }>("products", {
    sku,
    name: identity.data.resolvedName || query,
    brand: identity.data.brand || "Не определён",
    category:
      subject?.subjectName ||
      identity.data.category ||
      "Товар",
    price: 0,
    base_cost: 0,
    status: "draft",
    source: "web_discovery",
    image_source: "web_discovery",
    catalog_index: null,
    specs,
    source_url:
      providedUrl ||
      identity.data.sourcePageUrl ||
      research.sources[0]?.url ||
      null,
    source_metadata: {
      query,
      model: identity.data.model,
      confidence: identity.data.confidence,
      identitySources: identity.data.sources,
      researchSummary: research.summary,
      researchSources: research.sources,
      benefits: research.benefits,
      originalImageUrl: identity.data.primaryImageUrl || null,
    },
    wb_subject_id: subject?.subjectID ?? null,
    wb_subject_name: subject?.subjectName ?? null,
    wb_characteristics: research.attributes,
  });

  const product = inserted?.[0];
  if (!product) {
    return NextResponse.json(
      { error: "Не удалось сохранить найденный товар." },
      { status: 500 },
    );
  }

  const imageCandidates = [
    identity.data.primaryImageUrl,
    ...identity.data.alternateImageUrls,
    identity.data.sourcePageUrl,
    providedUrl,
  ].filter((value): value is string => Boolean(value));

  const storedImage = await saveDiscoveredImage(product.id, imageCandidates);
  const sourceImageUrl =
    storedImage?.publicUrl ||
    safeUrl(identity.data.primaryImageUrl)?.toString() ||
    null;

  await supabasePatch(
    "products",
    { id: product.id },
    {
      source_metadata: {
        query,
        model: identity.data.model,
        confidence: identity.data.confidence,
        identitySources: identity.data.sources,
        researchSummary: research.summary,
        researchSources: research.sources,
        benefits: research.benefits,
        originalImageUrl:
          storedImage?.originalUrl ||
          identity.data.primaryImageUrl ||
          null,
        storedImageUrl: storedImage?.publicUrl ?? null,
      },
    },
  );

  return NextResponse.json({
    ok: true,
    mode: identity.mode,
    product: {
      id: product.id,
      sku: product.sku,
      name: identity.data.resolvedName || query,
      brand: identity.data.brand || "Не определён",
      model: identity.data.model || "",
      category:
        subject?.subjectName ||
        identity.data.category ||
        "Товар",
      sourceImageUrl,
    },
    wb: {
      subjectId: subject?.subjectID ?? null,
      subjectName: subject?.subjectName ?? null,
      availableCharacteristics: characteristics.map((item) => ({
        id: item.charcID,
        name: item.name,
        required: Boolean(item.required || item.isRequiredForCreate),
        filter: Boolean(item.hasFilter),
      })),
    },
    specs,
    attributes: research.attributes,
    benefits: research.benefits,
    summary: research.summary,
    sources:
      research.sources.length > 0
        ? research.sources
        : identity.data.sources,
    confidence: identity.data.confidence,
    image: {
      publicUrl: sourceImageUrl,
      originalUrl:
        storedImage?.originalUrl ||
        identity.data.primaryImageUrl ||
        null,
      stored: Boolean(storedImage?.publicUrl),
    },
    warning: sourceImageUrl
      ? storedImage?.publicUrl
        ? null
        : "Фото найдено, но не удалось сохранить копию в Supabase. Генерация будет использовать исходный URL."
      : "Подходящее исходное фото автоматически не найдено. Можно загрузить его вручную.",
  });
}
