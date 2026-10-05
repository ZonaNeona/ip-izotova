import { NextResponse } from "next/server";
import { isSupabaseConfigured, supabaseInsert, supabasePatch } from "@/lib/supabase-rest";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    campaignId?: string;
    sku?: string;
    from?: number;
    to?: number;
  };

  if (!body.campaignId || typeof body.to !== "number") {
    return NextResponse.json({ error: "campaignId and to are required" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, mode: "demo" });
  }

  const updated = await supabasePatch("campaigns", { id: body.campaignId }, {
    current_bid: body.to,
    updated_at: new Date().toISOString(),
  });

  if (!updated?.length) {
    return NextResponse.json({ error: "Failed to update campaign" }, { status: 500 });
  }

  await supabaseInsert("audit_log", {
    actor: "Оператор",
    action: `Подтверждено изменение ставки ${body.sku ?? ""}`.trim(),
    result: `${body.from ?? "—"} ₽ → ${body.to} ₽ · Supabase Demo API`,
    tone: "success",
    entity_type: "campaign",
    entity_id: body.campaignId,
  });

  return NextResponse.json({ ok: true, mode: "live" });
}
