import { NextResponse } from "next/server";
import {
  isSupabaseConfigured,
  supabaseInsert,
  supabasePatch,
} from "@/lib/supabase-rest";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    questionId?: string;
    product?: string;
    answerText?: string;
  };

  if (!body.questionId) {
    return NextResponse.json(
      { error: "Не указан идентификатор вопроса." },
      { status: 400 },
    );
  }

  if (!body.answerText?.trim()) {
    return NextResponse.json(
      { error: "Ответ не может быть пустым." },
      { status: 400 },
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, mode: "demo" });
  }

  const answeredAt = new Date().toISOString();
  const updated = await supabasePatch(
    "questions",
    { id: body.questionId },
    {
      status: "answered",
      answer_text: body.answerText.trim(),
      answered_at: answeredAt,
    },
  );

  if (!updated?.length) {
    return NextResponse.json(
      { error: "Не удалось сохранить ответ на вопрос." },
      { status: 500 },
    );
  }

  await supabaseInsert("audit_log", {
    actor: "ИИ вопросов + оператор",
    action: `Ответ на вопрос по ${body.product ?? "товару"}`,
    result: "Ответ подтверждён, отправлен и сохранён",
    tone: "success",
    entity_type: "question",
    entity_id: body.questionId,
  });

  return NextResponse.json({ ok: true, mode: "live", answeredAt });
}
