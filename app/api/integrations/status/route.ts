import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase-rest";

export async function GET() {
  return NextResponse.json({
    supabase: isSupabaseConfigured(),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    imagerouter: Boolean(process.env.IMAGEROUTER_API_KEY),
    telegram: Boolean(
      process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID,
    ),
    wildberries: Boolean(process.env.WB_SANDBOX_TOKEN),
  });
}
