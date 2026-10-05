import { NextResponse } from "next/server";
import { supabaseSelect } from "@/lib/supabase-rest";

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  base_cost: number;
  launch_date: string | null;
  warranty_months: number;
  thumbnail_path: string | null;
};

type ChannelRow = {
  id: string;
  product_id: string;
  channel_id: string;
  external_product_id: string | null;
  external_vendor_code: string | null;
  external_variant_id: string | null;
  barcode: string | null;
  listing_status: string;
  current_price: number;
  current_stock: number;
  rating: number | null;
  reviews_count: number;
  metadata: Record<string, unknown>;
};

type ChannelDef = {
  id: string;
  code: string;
  name: string;
  is_primary: boolean;
};

type MetricRow = {
  product_channel_id: string;
  metric_date: string;
  orders: number;
  units: number;
  revenue: number;
  refunds: number;
  ad_spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversion_rate: number;
  drr: number;
  commission: number;
  logistics: number;
  storage: number;
  cost_of_goods: number;
  profit: number;
  margin: number;
  stock_close: number;
  price: number;
};

type IncidentRow = {
  id: string;
  channel_id: string | null;
  incident_type: string;
  severity: string;
  title: string;
  description: string;
  metric_key: string | null;
  metric_value: number | null;
  threshold_value: number | null;
  status: string;
  detected_at: string;
};

type RecommendationRow = {
  id: string;
  channel_id: string | null;
  recommendation_type: string;
  priority: string;
  title: string;
  rationale: string;
  expected_effect: string | null;
  risk: string | null;
  action_payload: Record<string, unknown>;
  status: string;
  created_at: string;
};

type ReviewRow = {
  id: string;
  product_channel_id: string | null;
  author: string | null;
  rating: number;
  body: string;
  classification: string | null;
  risk: string | null;
  ai_draft: string | null;
  policy: string | null;
  status: string;
  created_at: string;
};

type CompetitorRow = {
  id: string;
  competitor_index: number;
  name: string;
  brand: string;
  marketplace: string;
};

type CompetitorMetricRow = {
  competitor_id: string;
  metric_date: string;
  price: number;
  rating: number;
  reviews_count: number;
  estimated_units: number;
  position: number;
  promo_discount: number;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ sku: string }> },
) {
  const { sku } = await context.params;
  const decodedSku = decodeURIComponent(sku);

  const products = await supabaseSelect<ProductRow>("products", {
    filters: { sku: decodedSku },
  });

  const product = products?.[0];
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const [channelDefs, channelRows, incidents, recommendations, reviews, competitors] =
    await Promise.all([
      supabaseSelect<ChannelDef>("sales_channels"),
      supabaseSelect<ChannelRow>("product_channels", {
        filters: { product_id: product.id },
      }),
      supabaseSelect<IncidentRow>("incidents", {
        filters: { product_id: product.id },
        order: "detected_at.desc",
      }),
      supabaseSelect<RecommendationRow>("ai_recommendations", {
        filters: { product_id: product.id },
        order: "created_at.desc",
      }),
      supabaseSelect<ReviewRow>("reviews", {
        filters: { product_id: product.id },
        order: "created_at.desc",
      }),
      supabaseSelect<CompetitorRow>("competitors", {
        filters: { product_id: product.id },
        order: "competitor_index.asc",
      }),
    ]);

  const channels = channelRows ?? [];
  const metricGroups = await Promise.all(
    channels.map(async (channel) => ({
      channel,
      metrics:
        (await supabaseSelect<MetricRow>("channel_daily_metrics", {
          filters: { product_channel_id: channel.id },
          order: "metric_date.asc",
        })) ?? [],
    })),
  );

  const competitorGroups = await Promise.all(
    (competitors ?? []).map(async (competitor) => ({
      competitor,
      metrics:
        (await supabaseSelect<CompetitorMetricRow>("competitor_daily_metrics", {
          filters: { competitor_id: competitor.id },
          order: "metric_date.asc",
        })) ?? [],
    })),
  );

  const channelDefById = new Map(
    (channelDefs ?? []).map((item) => [item.id, item]),
  );

  return NextResponse.json({
    product: {
      id: product.id,
      sku: product.sku,
      name: product.name,
      brand: product.brand,
      category: product.category,
      listPrice: Number(product.price),
      baseCost: Number(product.base_cost),
      launchDate: product.launch_date,
      warrantyMonths: product.warranty_months,
      thumbnailUrl: product.thumbnail_path
        ? `${process.env.SUPABASE_URL}/storage/v1/object/public/product-thumbnails/${encodeURIComponent(product.thumbnail_path)}`
        : null,
    },
    channels: metricGroups.map(({ channel, metrics }) => {
      const def = channelDefById.get(channel.channel_id);
      return {
        id: channel.id,
        code: def?.code ?? "unknown",
        name: def?.name ?? "Unknown",
        primary: Boolean(def?.is_primary),
        listing: {
          externalProductId: channel.external_product_id,
          vendorCode: channel.external_vendor_code,
          variantId: channel.external_variant_id,
          barcode: channel.barcode,
          status: channel.listing_status,
          price: Number(channel.current_price),
          stock: Number(channel.current_stock),
          rating: channel.rating === null ? null : Number(channel.rating),
          reviews: channel.reviews_count,
          metadata: channel.metadata ?? {},
        },
        metrics: metrics.map((row) => ({
          date: row.metric_date,
          orders: row.orders,
          units: row.units,
          revenue: Number(row.revenue),
          refunds: row.refunds,
          adSpend: Number(row.ad_spend),
          impressions: row.impressions,
          clicks: row.clicks,
          ctr: Number(row.ctr),
          cpc: Number(row.cpc),
          conversionRate: Number(row.conversion_rate),
          drr: Number(row.drr),
          commission: Number(row.commission),
          logistics: Number(row.logistics),
          storage: Number(row.storage),
          costOfGoods: Number(row.cost_of_goods),
          profit: Number(row.profit),
          margin: Number(row.margin),
          stock: row.stock_close,
          price: Number(row.price),
        })),
      };
    }),
    incidents: (incidents ?? []).map((item) => ({
      ...item,
      channelCode: item.channel_id
        ? channelDefById.get(item.channel_id)?.code ?? null
        : null,
      metric_value:
        item.metric_value === null ? null : Number(item.metric_value),
      threshold_value:
        item.threshold_value === null ? null : Number(item.threshold_value),
    })),
    recommendations: (recommendations ?? []).map((item) => ({
      ...item,
      channelCode: item.channel_id
        ? channelDefById.get(item.channel_id)?.code ?? null
        : null,
      action_payload: item.action_payload ?? {},
    })),
    reviews: reviews ?? [],
    competitors: competitorGroups.map(({ competitor, metrics }) => ({
      id: competitor.id,
      name: competitor.name,
      brand: competitor.brand,
      marketplace: competitor.marketplace,
      metrics: metrics.map((row) => ({
        date: row.metric_date,
        price: Number(row.price),
        rating: Number(row.rating),
        reviews: row.reviews_count,
        units: row.estimated_units,
        position: row.position,
        promoDiscount: Number(row.promo_discount),
      })),
    })),
  });
}
