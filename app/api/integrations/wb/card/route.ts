import { NextResponse } from "next/server";
import {
  supabaseInsert,
  supabasePatch,
  supabaseSelect,
} from "@/lib/supabase-rest";

const BASE = "https://content-api-sandbox.wildberries.ru";
const THROTTLE_MS = 1100;

type InputCharacteristic = {
  id: number;
  value: string[] | number;
};

type CreateCardRequest = {
  internalSku?: string;
  subjectId?: number;
  vendorCode?: string;
  title?: string;
  description?: string;
  brand?: string;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    weightBrutto?: number;
  };
  characteristics?: InputCharacteristic[];
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

type WbCard = {
  nmID?: number;
  vendorCode?: string;
  subjectID?: number;
  subjectName?: string;
  title?: string;
  brand?: string;
  sizes?: Array<{
    chrtID?: number;
    techSize?: string;
    wbSize?: string;
    skus?: string[];
  }>;
  characteristics?: Array<{
    id?: number;
    name?: string;
    value?: unknown;
  }>;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getToken() {
  return process.env.WB_SANDBOX_TOKEN ?? null;
}

async function wbRequest<T>(
  path: string,
  init: RequestInit,
): Promise<{ ok: boolean; status: number; payload: T | null; raw: string }> {
  const token = getToken();
  if (!token) {
    return {
      ok: false,
      status: 503,
      payload: null,
      raw: "WB_SANDBOX_TOKEN is not configured",
    };
  }

  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: token,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const raw = await response.text();
  let payload: T | null = null;
  try {
    payload = JSON.parse(raw) as T;
  } catch {
    payload = null;
  }

  return { ok: response.ok, status: response.status, payload, raw };
}

function hasValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) {
    return value.some(
      (item) => typeof item === "string" && item.trim().length > 0,
    );
  }
  return false;
}

export async function POST(request: Request) {
  if ((process.env.WB_API_MODE ?? "sandbox") !== "sandbox") {
    return NextResponse.json(
      { error: "Card creation is restricted to sandbox mode" },
      { status: 400 },
    );
  }

  const body = (await request.json()) as CreateCardRequest;

  if (
    !body.internalSku ||
    !body.subjectId ||
    !body.vendorCode ||
    !body.title ||
    !body.brand
  ) {
    return NextResponse.json(
      {
        error:
          "internalSku, subjectId, vendorCode, title and brand are required",
      },
      { status: 400 },
    );
  }

  const dimensions = {
    length: Number(body.dimensions?.length ?? 0),
    width: Number(body.dimensions?.width ?? 0),
    height: Number(body.dimensions?.height ?? 0),
    weightBrutto: Number(body.dimensions?.weightBrutto ?? 0),
  };

  if (
    dimensions.length <= 0 ||
    dimensions.width <= 0 ||
    dimensions.height <= 0 ||
    dimensions.weightBrutto <= 0
  ) {
    return NextResponse.json(
      { error: "Dimensions and gross weight must be greater than zero" },
      { status: 400 },
    );
  }

  const schemaResponse = await wbRequest<{
    data?: WbCharacteristic[];
    error?: boolean;
    errorText?: string;
  }>(`/content/v2/object/charcs/${body.subjectId}`, {
    method: "GET",
  });

  if (!schemaResponse.ok || !schemaResponse.payload?.data) {
    return NextResponse.json(
      {
        error: "Could not verify WB subject characteristics",
        wbStatus: schemaResponse.status,
        details:
          schemaResponse.payload?.errorText ?? schemaResponse.raw.slice(0, 500),
      },
      { status: 502 },
    );
  }

  const schema = schemaResponse.payload.data;
  const schemaById = new Map(schema.map((item) => [item.charcID, item]));
  const input = body.characteristics ?? [];
  const inputById = new Map(input.map((item) => [item.id, item]));

  const required = schema.filter(
    (item) =>
      !item.existNamedField &&
      item.charcType !== 0 &&
      (item.required || item.isRequiredForCreate),
  );

  const missing = required.filter((item) => {
    const provided = inputById.get(item.charcID);
    return !provided || !hasValue(provided.value);
  });

  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: "Required WB characteristics are missing",
        missing: missing.map((item) => ({
          id: item.charcID,
          name: item.name,
          type: item.charcType,
          hasFilter: item.hasFilter ?? false,
        })),
      },
      { status: 400 },
    );
  }

  const characteristics = input
    .filter((item) => {
      const meta = schemaById.get(item.id);
      return Boolean(meta && !meta.existNamedField && meta.charcType !== 0);
    })
    .map((item) => {
      const meta = schemaById.get(item.id)!;
      if (meta.charcType === 4) {
        return { id: item.id, value: Number(item.value) };
      }
      const values = Array.isArray(item.value)
        ? item.value
        : [String(item.value)];
      return {
        id: item.id,
        value: values.map((value) => value.trim()).filter(Boolean),
      };
    })
    .filter((item) => hasValue(item.value));

  await sleep(THROTTLE_MS);

  const barcodeResponse = await wbRequest<{
    data?: string[];
    error?: boolean;
    errorText?: string;
  }>("/content/v2/barcodes", {
    method: "POST",
    body: JSON.stringify({ count: 1 }),
  });

  const barcode = barcodeResponse.payload?.data?.[0];
  if (!barcodeResponse.ok || !barcode) {
    return NextResponse.json(
      {
        error: "Could not generate WB barcode",
        wbStatus: barcodeResponse.status,
        details:
          barcodeResponse.payload?.errorText ??
          barcodeResponse.raw.slice(0, 500),
      },
      { status: 502 },
    );
  }

  await sleep(THROTTLE_MS);

  const uploadPayload = [
    {
      subjectID: body.subjectId,
      variants: [
        {
          vendorCode: body.vendorCode,
          kizMarked: false,
          title: body.title,
          description: body.description ?? "",
          brand: body.brand,
          dimensions,
          characteristics,
          sizes: [
            {
              skus: [barcode],
            },
          ],
        },
      ],
    },
  ];

  const upload = await wbRequest<{
    data?: unknown;
    error?: boolean;
    errorText?: string;
    additionalErrors?: unknown;
  }>("/content/v2/cards/upload", {
    method: "POST",
    body: JSON.stringify(uploadPayload),
  });

  if (!upload.ok || upload.payload?.error) {
    return NextResponse.json(
      {
        error: "WB rejected product card creation",
        wbStatus: upload.status,
        errorText: upload.payload?.errorText ?? null,
        additionalErrors: upload.payload?.additionalErrors ?? null,
        payloadPreview: {
          subjectID: body.subjectId,
          vendorCode: body.vendorCode,
          characteristicsCount: characteristics.length,
          barcode,
        },
      },
      { status: upload.status >= 400 ? upload.status : 502 },
    );
  }

  await sleep(THROTTLE_MS);

  const list = await wbRequest<{
    cards?: WbCard[];
    cursor?: { total?: number };
  }>("/content/v2/get/cards/list", {
    method: "POST",
    body: JSON.stringify({
      settings: {
        sort: { ascending: false },
        filter: {
          textSearch: body.vendorCode,
          withPhoto: -1,
        },
        cursor: { limit: 10 },
      },
    }),
  });

  const card =
    list.payload?.cards?.find(
      (item) => item.vendorCode === body.vendorCode,
    ) ?? list.payload?.cards?.[0];

  if (!list.ok || !card?.nmID) {
    await supabaseInsert("audit_log", {
      actor: "WB Sandbox Lab",
      action: `Карточка ${body.vendorCode} принята WB Sandbox`,
      result:
        "Создание принято, но карточка не найдена при немедленной верификации",
      tone: "warning",
      entity_type: "wb_sandbox_card",
      metadata: {
        subjectId: body.subjectId,
        internalSku: body.internalSku,
        vendorCode: body.vendorCode,
        barcode,
      },
    });

    return NextResponse.json({
      ok: true,
      verified: false,
      message:
        "WB accepted the card, but it was not found during immediate read-back",
      vendorCode: body.vendorCode,
      barcode,
    });
  }

  const products = await supabaseSelect<{ id: string }>("products", {
    filters: { sku: body.internalSku },
  });
  const wbChannels = await supabaseSelect<{ id: string }>("sales_channels", {
    filters: { code: "wb" },
  });

  const productId = products?.[0]?.id;
  const channelId = wbChannels?.[0]?.id;
  const size = card.sizes?.[0];
  const verifiedBarcode = size?.skus?.[0] ?? barcode;

  if (productId && channelId) {
    const productChannels = await supabaseSelect<{ id: string }>(
      "product_channels",
      {
        filters: {
          product_id: productId,
          channel_id: channelId,
        },
      },
    );

    const productChannelId = productChannels?.[0]?.id;
    if (productChannelId) {
      await supabasePatch(
        "product_channels",
        { id: productChannelId },
        {
          external_product_id: String(card.nmID),
          external_vendor_code: card.vendorCode ?? body.vendorCode,
          external_variant_id: size?.chrtID
            ? String(size.chrtID)
            : null,
          barcode: verifiedBarcode,
          listing_status: "sandbox_live",
          metadata: {
            subjectID: card.subjectID ?? body.subjectId,
            subjectName: card.subjectName ?? null,
            verifiedAt: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        },
      );
    }
  }

  await supabaseInsert("audit_log", {
    actor: "WB Sandbox Lab",
    action: `Создана и проверена карточка ${body.vendorCode}`,
    result: `WB nmID ${card.nmID} · barcode ${verifiedBarcode}`,
    tone: "success",
    entity_type: "wb_sandbox_card",
    metadata: {
      internalSku: body.internalSku,
      subjectId: card.subjectID ?? body.subjectId,
      nmID: card.nmID,
      chrtID: size?.chrtID ?? null,
      barcode: verifiedBarcode,
    },
  });

  return NextResponse.json({
    ok: true,
    verified: true,
    card: {
      nmID: card.nmID,
      vendorCode: card.vendorCode ?? body.vendorCode,
      subjectID: card.subjectID ?? body.subjectId,
      subjectName: card.subjectName ?? null,
      title: card.title ?? body.title,
      brand: card.brand ?? body.brand,
      chrtID: size?.chrtID ?? null,
      barcode: verifiedBarcode,
    },
  });
}
