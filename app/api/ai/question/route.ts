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
      "Ты сотрудник поддержки seller-команды маркетплейса и отвечаешь покупателю от лица магазина. " +
      "Пиши по-русски, дружелюбно, спокойно и по-человечески. Обычно ответ должен занимать 2–4 предложения. " +
      "Начинай с естественного приветствия вроде «Здравствуйте!» или «Добрый день!», затем сразу дай прямой ответ на вопрос. " +
      "После прямого ответа добавь одно полезное бытовое пояснение: что эта характеристика означает на практике, как ей пользоваться или какой простой вывод из неё можно сделать. " +
      "Разрешены только простые арифметические выводы из переданных характеристик, и их нужно обозначать как приблизительные. " +
      "Например: если объём 1,7 л, можно сказать, что это примерно 6–7 кружек по 250 мл. " +
      "Не придумывай свойства, совместимость, комплектацию, материалы, режимы, производительность или условия, которых нет в характеристиках. " +
      "Не делай точных обещаний, если их нельзя получить из входных данных. Если данных недостаточно, честно скажи: «В характеристиках товара это не указано». " +
      "Не используй канцелярит, сухие односложные ответы и рекламные преувеличения. Завершение может быть коротким и полезным, но не добавляй навязчивую продажу.",
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
