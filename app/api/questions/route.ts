import { NextResponse } from "next/server";
import { supabaseSelect } from "@/lib/supabase-rest";

type QuestionRow = {
  id: string;
  product_id: string;
  product_channel_id: string;
  external_id: string;
  author: string | null;
  body: string;
  question_type: string;
  fallback_answer: string;
  ai_draft: string | null;
  answer_text: string | null;
  policy: string;
  status: string;
  created_at: string;
  answered_at: string | null;
};

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  thumbnail_path: string | null;
  specs: Record<string, string | number | boolean>;
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
  const [questions, products, productChannels, salesChannels] =
    await Promise.all([
      supabaseSelect<QuestionRow>("questions", { order: "created_at.desc" }),
      supabaseSelect<ProductRow>("products"),
      supabaseSelect<ProductChannelRow>("product_channels"),
      supabaseSelect<SalesChannelRow>("sales_channels"),
    ]);

  if (!questions || !products || !productChannels || !salesChannels) {
    return NextResponse.json(
      { error: "Не удалось загрузить вопросы." },
      { status: 500 },
    );
  }

  const productById = new Map(products.map((item) => [item.id, item]));
  const productChannelById = new Map(
    productChannels.map((item) => [item.id, item]),
  );
  const channelById = new Map(salesChannels.map((item) => [item.id, item]));

  return NextResponse.json({
    questions: questions.map((question) => {
      const product = productById.get(question.product_id);
      const productChannel = productChannelById.get(
        question.product_channel_id,
      );
      const channel = productChannel
        ? channelById.get(productChannel.channel_id)
        : undefined;

      return {
        id: question.id,
        externalId: question.external_id,
        product: {
          id: product?.id ?? question.product_id,
          sku: product?.sku ?? "—",
          name: product?.name ?? "Неизвестный товар",
          thumbnailUrl: product?.thumbnail_path
            ? `${process.env.SUPABASE_URL}/storage/v1/object/public/product-thumbnails/${encodeURIComponent(product.thumbnail_path)}`
            : null,
          specs: product?.specs ?? {},
        },
        channel: {
          code: channel?.code ?? "unknown",
          name: channel?.name ?? "Неизвестный канал",
          externalProductId: productChannel?.external_product_id ?? null,
        },
        author: question.author,
        body: question.body,
        type: question.question_type,
        fallbackAnswer: question.fallback_answer,
        draft: question.ai_draft,
        answer: question.answer_text,
        policy: question.policy,
        status: question.status,
        createdAt: question.created_at,
        answeredAt: question.answered_at,
      };
    }),
  });
}
