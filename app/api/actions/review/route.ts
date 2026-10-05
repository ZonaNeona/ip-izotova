import { NextResponse } from "next/server";
import { isSupabaseConfigured, supabaseInsert, supabasePatch } from "@/lib/supabase-rest";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    reviewId?: string;
    product?: string;
    answerText?: string;
  };

  if (!body.reviewId) {
    return NextResponse.json({ error: "reviewId is required" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, mode: "demo" });
  }

  const answeredAt = new Date().toISOString();
  const updated = await supabasePatch("reviews", { id: body.reviewId }, {
    status: "answered",
    answered_at: answeredAt,
    answer_text: body.answerText?.trim() || null,
  });

  if (!updated?.length) {
    return NextResponse.json({ error: "Failed to update review" }, { status: 500 });
  }

  await supabaseInsert("audit_log", {
    actor: "AI Reviews + Оператор",
    action: `Ответ на отзыв по ${body.product ?? "товару"}`,
    result: body.answerText?.trim()
      ? "Ответ подтверждён, отправлен и сохранён"
      : "Ответ подтверждён и отправлен",
    tone: "success",
    entity_type: "review",
    entity_id: body.reviewId,
  });

  return NextResponse.json({ ok: true, mode: "live" });
}
