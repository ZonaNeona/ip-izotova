import { NextResponse } from "next/server";
import { openRouterJson } from "@/lib/openrouter";

type ReviewRequest = {
  product?: string;
  author?: string;
  rating?: number;
  text?: string;
};

type ReviewAnswer = {
  classification: string;
  risk: "Низкий" | "Средний" | "Высокий";
  draft: string;
  policy: "Можно отправить автоматически" | "Требует подтверждения";
};

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["classification", "risk", "draft", "policy"],
  properties: {
    classification: { type: "string" },
    risk: { type: "string", enum: ["Низкий", "Средний", "Высокий"] },
    draft: { type: "string" },
    policy: {
      type: "string",
      enum: ["Можно отправить автоматически", "Требует подтверждения"],
    },
  },
};

export async function POST(request: Request) {
  const body = (await request.json()) as ReviewRequest;

  if (!body.text || !body.product) {
    return NextResponse.json(
      { error: "product and text are required" },
      { status: 400 },
    );
  }

  const fallback: ReviewAnswer = {
    classification: body.rating && body.rating <= 3
      ? "Проблема с товаром"
      : "Позитивный отзыв",
    risk: body.rating && body.rating <= 2 ? "Средний" : "Низкий",
    draft:
      body.rating && body.rating <= 3
        ? `${body.author ?? "Покупатель"}, спасибо за обратную связь. Нам жаль, что возникла проблема с товаром. Пожалуйста, оформите обращение через поддержку заказа — мы поможем разобраться.`
        : `${body.author ?? "Покупатель"}, спасибо за высокую оценку! Рады, что товар вам понравился.`,
    policy:
      body.rating && body.rating <= 3
        ? "Требует подтверждения"
        : "Можно отправить автоматически",
  };

  const result = await openRouterJson<ReviewAnswer>({
    schemaName: "review_answer",
    schema,
    fallback,
    system:
      "Ты ассистент seller-команды маркетплейса. Пиши короткие, корректные ответы покупателям на русском языке. Не обещай компенсацию, возврат денег или действия, которые компания не подтверждала. Негативные и потенциально рискованные обращения должны требовать подтверждения человеком.",
    user: JSON.stringify({
      product: body.product,
      author: body.author,
      rating: body.rating,
      review: body.text,
    }),
  });

  return NextResponse.json(result);
}
