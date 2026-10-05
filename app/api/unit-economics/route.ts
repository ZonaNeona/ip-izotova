import { NextResponse } from "next/server";
import { supabaseSelect } from "@/lib/supabase-rest";
import { mediaProxyUrl } from "@/lib/media-url";

type Row = {
  product_id: string;
  product_channel_id: string;
  channel: string;
  catalog_index: number;
  sku: string;
  name: string;
  brand: string;
  category: string;
  thumbnail_path: string | null;
  list_price: number;
  base_cost: number;
  units_7d: number;
  revenue_7d: number;
  commission_7d: number;
  logistics_7d: number;
  storage_7d: number;
  ad_spend_7d: number;
  cogs_7d: number;
  profit_7d: number;
  refunds_7d: number;
  avg_price_7d: number;
  units_30d: number;
  revenue_30d: number;
  commission_30d: number;
  logistics_30d: number;
  storage_30d: number;
  ad_spend_30d: number;
  cogs_30d: number;
  profit_30d: number;
  refunds_30d: number;
  avg_price_30d: number;
  units_90d: number;
  revenue_90d: number;
  commission_90d: number;
  logistics_90d: number;
  storage_90d: number;
  ad_spend_90d: number;
  cogs_90d: number;
  profit_90d: number;
  refunds_90d: number;
  avg_price_90d: number;
};

type ChannelRow = {
  id: string;
  product_id: string;
  external_product_id: string | null;
  channel_id: string;
};

type ChannelDef = {
  id: string;
  code: string;
};

function num(value: unknown) {
  return Number(value ?? 0);
}

function imageUrl(path: string | null) {
  return path ? mediaProxyUrl("product-thumbnails", path) : null;
}

export async function GET() {
  const [rows, productChannels, channelDefs] = await Promise.all([
    supabaseSelect<Row>("unit_economics_summary", {
      order: "revenue_30d.desc",
    }),
    supabaseSelect<ChannelRow>("product_channels"),
    supabaseSelect<ChannelDef>("sales_channels"),
  ]);

  if (!rows || !productChannels || !channelDefs) {
    return NextResponse.json(
      { error: "Не удалось загрузить юнит-экономику." },
      { status: 500 },
    );
  }

  const channelCodeById = new Map(channelDefs.map((row) => [row.id, row.code]));
  const externalByKey = new Map(
    productChannels.map((row) => [
      `${row.product_id}:${channelCodeById.get(row.channel_id) ?? "unknown"}`,
      row.external_product_id,
    ]),
  );

  return NextResponse.json({
    items: rows.map((row) => ({
      id: row.product_channel_id,
      productId: row.product_id,
      sku: row.sku,
      name: row.name,
      brand: row.brand,
      category: row.category,
      thumbnailUrl: imageUrl(row.thumbnail_path),
      channel: row.channel,
      externalProductId:
        externalByKey.get(`${row.product_id}:${row.channel}`) ?? null,
      listPrice: num(row.list_price),
      baseCost: num(row.base_cost),
      periods: {
        7: {
          units: num(row.units_7d),
          revenue: num(row.revenue_7d),
          commission: num(row.commission_7d),
          logistics: num(row.logistics_7d),
          storage: num(row.storage_7d),
          adSpend: num(row.ad_spend_7d),
          cogs: num(row.cogs_7d),
          profit: num(row.profit_7d),
          refunds: num(row.refunds_7d),
          avgPrice: num(row.avg_price_7d),
        },
        30: {
          units: num(row.units_30d),
          revenue: num(row.revenue_30d),
          commission: num(row.commission_30d),
          logistics: num(row.logistics_30d),
          storage: num(row.storage_30d),
          adSpend: num(row.ad_spend_30d),
          cogs: num(row.cogs_30d),
          profit: num(row.profit_30d),
          refunds: num(row.refunds_30d),
          avgPrice: num(row.avg_price_30d),
        },
        90: {
          units: num(row.units_90d),
          revenue: num(row.revenue_90d),
          commission: num(row.commission_90d),
          logistics: num(row.logistics_90d),
          storage: num(row.storage_90d),
          adSpend: num(row.ad_spend_90d),
          cogs: num(row.cogs_90d),
          profit: num(row.profit_90d),
          refunds: num(row.refunds_90d),
          avgPrice: num(row.avg_price_90d),
        },
      },
    })),
  });
}
