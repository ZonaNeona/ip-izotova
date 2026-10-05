import { NextResponse } from "next/server";
import {
  supabaseInsert,
  supabasePatch,
  supabaseSelect,
} from "@/lib/supabase-rest";

type ReconciliationRow = {
  id: string;
  product_id: string;
  warehouse_id: string | null;
  status: string;
  expected_value: number | null;
  actual_value: number | null;
};

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    id?: string;
    action?: "resolve" | "recheck";
  };

  if (!body.id || !body.action) {
    return NextResponse.json(
      { error: "Не указано расхождение или действие." },
      { status: 400 },
    );
  }

  const rows = await supabaseSelect<ReconciliationRow>("reconciliations", {
    filters: { id: body.id },
  });
  const row = rows?.[0];

  if (!row) {
    return NextResponse.json(
      { error: "Расхождение не найдено." },
      { status: 404 },
    );
  }

  if (body.action === "recheck") {
    const updated = await supabasePatch(
      "reconciliations",
      { id: row.id },
      { checked_at: new Date().toISOString() },
    );

    return NextResponse.json({
      ok: Boolean(updated?.length),
      status: row.status,
    });
  }

  const updated = await supabasePatch(
    "reconciliations",
    { id: row.id },
    {
      status: "resolved",
      expected_value: row.actual_value,
      difference: 0,
      checked_at: new Date().toISOString(),
    },
  );

  if (!updated?.length) {
    return NextResponse.json(
      { error: "Не удалось закрыть расхождение." },
      { status: 500 },
    );
  }

  await supabaseInsert("audit_log", {
    actor: "Оператор склада",
    action: "Закрыто расхождение остатков",
    result: "Учётное значение принято после проверки.",
    tone: "success",
    entity_type: "reconciliation",
    entity_id: row.id,
  });

  return NextResponse.json({ ok: true, status: "resolved" });
}
