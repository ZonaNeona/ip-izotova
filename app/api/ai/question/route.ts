import { NextResponse } from "next/server";
import { openRouterJson } from "@/lib/openrouter";
import { supabasePatch, supabaseSelect } from "@/lib/supabase-rest";

type QuestionRow = {
  id: string;
  product_id: string;
  body: string;
  fallback_answer: string;
};

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  specs: Record<string, string | number | boolean>;
};

type QuestionAnswer = {
  draft: string;
  groundedFacts: string[];
  confidence: "Высокая" | "Средняя";
};

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["draft", "groundedFacts", "confidence"],
  properties: {
    draft: { type: "string" },
    groundedFacts: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: { type: "string" },
    },
    confidence: {
      type: "string",
      enum: ["Высокая", "Средняя"],
    },
  },
};

export async function POST(request: Request) {
  const body = (await request.json()) as { questionId?: string };

  if (!body.questionId) {
    return NextResponse.json(
      { error: "Не указан идентификатор вопроса." },
      { status: 400 },
    );
  }

  const questions = await supabaseSelect<QuestionRow>("questions", {
    filters: { id: body.questionId },
  });
  const question = questions?.[0];

  if (!question) {
    return NextResponse.json({ error: "Вопрос не найден." }, { status: 404 });
  }

  const products = await supabaseSelect<ProductRow>("products", {
    filters: { id: question.product_id },
  });
  const product = products?.[0];

  if (!product) {
    return NextResponse.json({ error: "Товар не найден." }, { status: 404 });
  }

  const facts = Object.entries(product.specs ?? {}).map(
    ([key, value]) => `${key}: ${String(value)}`,
  );

  const fallback: QuestionAnswer = {
    draft: question.fallback_answer,
    groundedFacts: facts.slice(0, 4),
    confidence: "Высокая",
  };

  const result = await openRouterJson<QuestionAnswer>({
    schemaName: "marketplace_question_answer",
    schema,
    fallback,
    system:
      "Ты ассистент seller-команды маркетплейса. Отвечай покупателю только на основании характеристик товара, переданных во входных данных. Не придумывай свойства, совместимость, комплектацию или условия, которых нет в характеристиках. Если данных недостаточно, прямо скажи: «В характеристиках товара это не указано». Ответ — короткий, естественный, на русском языке, без рекламных преувеличений.",
    user: JSON.stringify({
      product: {
        sku: product.sku,
        name: product.name,
        specs: product.specs,
      },
      question: question.body,
    }),
  });

  await supabasePatch(
    "questions",
    { id: question.id },
    { ai_draft: result.data.draft },
  );

  return NextResponse.json({
    ...result,
    source: {
      productId: product.id,
      sku: product.sku,
      specs: product.specs,
    },
  });
}
