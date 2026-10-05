import { NextResponse } from "next/server";
import { isSupabaseConfigured, supabaseInsert } from "@/lib/supabase-rest";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    productId?: string;
    sku?: string;
    quantity?: number;
  };

  if (!body.productId || !body.quantity || body.quantity <= 0) {
    return NextResponse.json({ error: "productId and quantity are required" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, mode: "demo" });
  }

  const created = await supabaseInsert<{ id: string }>("supplies", {
    product_id: body.productId,
    quantity: body.quantity,
    status: "draft",
    source: "demo",
  });

  if (!created?.length) {
    return NextResponse.json({ error: "Failed to create supply" }, { status: 500 });
  }

  await supabaseInsert("audit_log", {
    actor: "Supply Engine",
    action: `Создана заявка на поставку ${body.sku ?? ""}`.trim(),
    result: `${body.quantity} шт. · ожидает подтверждения склада`,
    tone: "info",
    entity_type: "supply",
    entity_id: created[0].id,
  });

  return NextResponse.json({ ok: true, mode: "live", supplyId: created[0].id });
}
