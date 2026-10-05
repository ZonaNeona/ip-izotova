import { NextResponse } from "next/server";
import { supabaseInsert, supabasePatch, supabaseSelect } from "@/lib/supabase-rest";

type RecommendationRow = {
  id: string;
  product_id: string;
  title: string;
  status: string;
};

type ProductRow = {
  id: string;
  sku: string;
  name: string;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json()) as { action?: "accepted" | "rejected" };

  if (body.action !== "accepted" && body.action !== "rejected") {
    return NextResponse.json(
      { error: "action must be accepted or rejected" },
      { status: 400 },
    );
  }

  const recommendations = await supabaseSelect<RecommendationRow>(
    "ai_recommendations",
    { filters: { id } },
  );
  const recommendation = recommendations?.[0];

  if (!recommendation) {
    return NextResponse.json({ error: "Recommendation not found" }, { status: 404 });
  }

  const updated = await supabasePatch<RecommendationRow>(
    "ai_recommendations",
    { id },
    {
      status: body.action,
    },
  );

  if (!updated?.[0]) {
    return NextResponse.json(
      { error: "Could not update recommendation" },
      { status: 500 },
    );
  }

  const products = await supabaseSelect<ProductRow>("products", {
    filters: { id: recommendation.product_id },
  });
  const product = products?.[0];

  await supabaseInsert("audit_log", {
    actor: "Оператор",
    action:
      body.action === "accepted"
        ? `Принята AI-рекомендация: ${recommendation.title}`
        : `Отклонена AI-рекомендация: ${recommendation.title}`,
    result: product
      ? `${product.sku} · ${product.name}`
      : recommendation.product_id,
    tone: body.action === "accepted" ? "success" : "warning",
    entity_type: "ai_recommendation",
    metadata: {
      recommendationId: recommendation.id,
      decision: body.action,
      previousStatus: recommendation.status,
    },
  });

  return NextResponse.json({
    ok: true,
    id,
    status: body.action,
  });
}
