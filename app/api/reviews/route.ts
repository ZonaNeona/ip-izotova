import { NextResponse } from "next/server";
import { supabaseSelect } from "@/lib/supabase-rest";

type ReviewRow = {
  id: string;
  product_id: string;
  product_channel_id: string | null;
  external_id: string | null;
  author: string | null;
  rating: number;
  body: string;
  classification: string | null;
  risk: string | null;
  ai_draft: string | null;
  answer_text: string | null;
  policy: string | null;
  status: string;
  created_at: string;
  answered_at: string | null;
};

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  thumbnail_path: string | null;
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

export async function GET() {
  const [reviews, products, productChannels, salesChannels] = await Promise.all([
    supabaseSelect<ReviewRow>("reviews", { order: "created_at.desc" }),
    supabaseSelect<ProductRow>("products"),
    supabaseSelect<ProductChannelRow>("product_channels"),
    supabaseSelect<SalesChannelRow>("sales_channels"),
  ]);

  if (!reviews || !products || !productChannels || !salesChannels) {
    return NextResponse.json(
      { error: "Не удалось загрузить отзывы." },
      { status: 500 },
    );
  }

  const productById = new Map(products.map((item) => [item.id, item]));
  const productChannelById = new Map(
    productChannels.map((item) => [item.id, item]),
  );
  const channelById = new Map(salesChannels.map((item) => [item.id, item]));

  return NextResponse.json({
    reviews: reviews.map((review) => {
      const product = productById.get(review.product_id);
      const productChannel = review.product_channel_id
        ? productChannelById.get(review.product_channel_id)
        : undefined;
      const channel = productChannel
        ? channelById.get(productChannel.channel_id)
        : undefined;

      return {
        id: review.id,
        externalId: review.external_id,
        product: {
          id: product?.id ?? review.product_id,
          sku: product?.sku ?? "—",
          name: product?.name ?? "Неизвестный товар",
          thumbnailUrl: product?.thumbnail_path
            ? `${process.env.SUPABASE_URL}/storage/v1/object/public/product-thumbnails/${encodeURIComponent(product.thumbnail_path)}`
            : null,
        },
        channel: {
          code: channel?.code ?? "unknown",
          name: channel?.name ?? "Неизвестный канал",
          externalProductId: productChannel?.external_product_id ?? null,
        },
        author: review.author,
        rating: review.rating,
        body: review.body,
        classification: review.classification,
        risk: review.risk,
        draft: review.ai_draft,
        answer: review.answer_text,
        policy: review.policy,
        status: review.status,
        createdAt: review.created_at,
        answeredAt: review.answered_at,
      };
    }),
  });
}
