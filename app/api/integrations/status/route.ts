import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase-rest";
import { isAiProviderConfigured } from "@/lib/ai-provider";

export async function GET() {
  return NextResponse.json({
    supabase: isSupabaseConfigured(),
    openrouter: isAiProviderConfigured("openrouter"),
    imagerouter: isAiProviderConfigured("imagerouter"),
    telegram: Boolean(
      process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID,
    ),
    wildberries: Boolean(process.env.WB_SANDBOX_TOKEN),
  });
}
