import { NextResponse } from "next/server";
import { supabaseSelect } from "@/lib/supabase-rest";
import { mediaProxyUrl } from "@/lib/media-url";

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  thumbnail_path: string | null;
};

type CampaignRow = {
  id: string;
  product_id: string;
  product_channel_id: string;
  name: string;
  current_bid: number;
  recommended_bid: number;
  spend: number;
  ctr: number;
  cpc: number;
  orders: number;
  drr: number;
  target_drr: number;
  status: string;
  campaign_type: string;
  recommendation_reason: string | null;
  recommendation_status: string;
  updated_at: string;
};

type ProductChannelRow = {
  id: string;
  channel_id: string;
  external_product_id: string | null;
};

type SalesChannelRow = {
  id: string;
  code: string;
  name: string;
};

type DailyRow = {
  campaign_id: string;
  metric_date: string;
  impressions: number;
  clicks: number;
  orders: number;
  spend: number;
  attributed_revenue: number;
  ctr: number;
  cpc: number;
  conversion_rate: number;
  drr: number;
  bid: number;
};

export async function GET() {
  const [products, campaigns, productChannels, salesChannels, daily] =
    await Promise.all([
      supabaseSelect<ProductRow>("products"),
      supabaseSelect<CampaignRow>("campaigns", { order: "updated_at.desc" }),
      supabaseSelect<ProductChannelRow>("product_channels"),
      supabaseSelect<SalesChannelRow>("sales_channels"),
      supabaseSelect<DailyRow>("campaign_daily_metrics", {
        order: "metric_date.asc",
      }),
    ]);

  if (!products || !campaigns || !productChannels || !salesChannels || !daily) {
    return NextResponse.json(
      { error: "Не удалось загрузить рекламные данные." },
      { status: 500 },
    );
  }

  const productById = new Map(products.map((item) => [item.id, item]));
  const productChannelById = new Map(
    productChannels.map((item) => [item.id, item]),
  );
  const channelById = new Map(salesChannels.map((item) => [item.id, item]));

  const dailyByCampaign = new Map<string, DailyRow[]>();
  for (const row of daily) {
    const list = dailyByCampaign.get(row.campaign_id) ?? [];
    list.push(row);
    dailyByCampaign.set(row.campaign_id, list);
  }

  return NextResponse.json({
    campaigns: campaigns.map((campaign) => {
      const product = productById.get(campaign.product_id);
      const productChannel = productChannelById.get(campaign.product_channel_id);
      const channel = productChannel
        ? channelById.get(productChannel.channel_id)
        : undefined;

      return {
        id: campaign.id,
        name: campaign.name,
        product: {
          id: product?.id ?? campaign.product_id,
          sku: product?.sku ?? "—",
          name: product?.name ?? "Неизвестный товар",
          thumbnailUrl: product?.thumbnail_path
            ? mediaProxyUrl("product-thumbnails", product.thumbnail_path)
            : null,
        },
        channel: {
          code: channel?.code ?? "unknown",
          name: channel?.name ?? "Неизвестный канал",
          externalProductId: productChannel?.external_product_id ?? null,
        },
        currentBid: Number(campaign.current_bid),
        recommendedBid: Number(campaign.recommended_bid),
        targetDrr: Number(campaign.target_drr),
        status: campaign.status,
        type: campaign.campaign_type,
        recommendationReason: campaign.recommendation_reason,
        recommendationStatus: campaign.recommendation_status,
        updatedAt: campaign.updated_at,
        metrics: (dailyByCampaign.get(campaign.id) ?? []).map((row) => ({
          date: row.metric_date,
          impressions: row.impressions,
          clicks: row.clicks,
          orders: row.orders,
          spend: Number(row.spend),
          revenue: Number(row.attributed_revenue),
          ctr: Number(row.ctr),
          cpc: Number(row.cpc),
          conversion: Number(row.conversion_rate),
          drr: Number(row.drr),
          bid: Number(row.bid),
        })),
      };
    }),
  });
}
