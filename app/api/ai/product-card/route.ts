import { NextResponse } from "next/server";
import { openRouterJson } from "@/lib/openrouter";

type CardRequest = {
  productName?: string;
  brand?: string;
  volume?: string;
  power?: string;
  features?: string;
};

type CardAnswer = {
  title: string;
  description: string;
  bullets: string[];
  category: string;
  searchPhrases: string[];
};

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "description", "bullets", "category", "searchPhrases"],
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    bullets: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: { type: "string" },
    },
    category: { type: "string" },
    searchPhrases: {
      type: "array",
      minItems: 3,
      maxItems: 8,
      items: { type: "string" },
    },
  },
};

export async function POST(request: Request) {
  const body = (await request.json()) as CardRequest;

  if (!body.productName || !body.brand) {
    return NextResponse.json(
      { error: "productName and brand are required" },
      { status: 400 },
    );
  }

  const fallback: CardAnswer = {
    title: `${body.productName}, ${body.volume ?? "1,7 л"}, ${body.power ?? "2200 Вт"}`,
    description:
      "Практичный электрический чайник для ежедневного использования дома и в офисе. Корпус из нержавеющей стали, быстрое кипячение и базовые функции безопасности.",
    bullets: [
      `Объём: ${body.volume ?? "1,7 л"}`,
      `Мощность: ${body.power ?? "2200 Вт"}`,
      "Автоматическое отключение",
      "Защита от включения без воды",
      "Поворотная база 360°",
    ],
    category: "Бытовая техника · Электрические чайники",
    searchPhrases: [
      "электрический чайник",
      "чайник 1.7 л",
      "чайник нержавеющая сталь",
      "чайник 2200 вт",
    ],
  };

  const result = await openRouterJson<CardAnswer>({
    schemaName: "marketplace_product_card",
    schema,
    fallback,
    system:
      "Ты контент-ассистент seller-команды маркетплейса. Создавай карточку только по фактам из входных данных. Не придумывай характеристики, сертификаты, гарантии, медицинские или абсолютные маркетинговые обещания. Русский язык, деловой e-commerce стиль.",
    user: JSON.stringify(body),
  });

  return NextResponse.json(result);
}
