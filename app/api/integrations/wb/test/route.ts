import { NextResponse } from "next/server";
import { supabasePatch } from "@/lib/supabase-rest";

type PingResult = {
  category: string;
  host: string;
  ok: boolean;
  status: number;
  wbStatus?: string | null;
  timestamp?: string | null;
  error?: string | null;
};

const SANDBOX_PINGS = [
  {
    category: "Content",
    host: "content-api-sandbox.wildberries.ru",
    url: "https://content-api-sandbox.wildberries.ru/ping",
  },
  {
    category: "Prices",
    host: "discounts-prices-api-sandbox.wildberries.ru",
    url: "https://discounts-prices-api-sandbox.wildberries.ru/ping",
  },
  {
    category: "Statistics",
    host: "statistics-api-sandbox.wildberries.ru",
    url: "https://statistics-api-sandbox.wildberries.ru/ping",
  },
  {
    category: "Promotion",
    host: "advert-api-sandbox.wildberries.ru",
    url: "https://advert-api-sandbox.wildberries.ru/ping",
  },
  {
    category: "Feedbacks",
    host: "feedbacks-api-sandbox.wildberries.ru",
    url: "https://feedbacks-api-sandbox.wildberries.ru/ping",
  },
] as const;

let lastRunAt = 0;
const COOLDOWN_MS = 10_000;

async function ping(
  token: string,
  item: (typeof SANDBOX_PINGS)[number],
): Promise<PingResult> {
  try {
    const response = await fetch(item.url, {
      method: "GET",
      headers: {
        Authorization: token,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    let payload: { Status?: string; TS?: string } | null = null;
    try {
      payload = (await response.json()) as { Status?: string; TS?: string };
    } catch {
      payload = null;
    }

    return {
      category: item.category,
      host: item.host,
      ok: response.ok && payload?.Status === "OK",
      status: response.status,
      wbStatus: payload?.Status ?? null,
      timestamp: payload?.TS ?? null,
      error:
        response.ok
          ? null
          : response.status === 401
            ? "Unauthorized: token invalid or category mismatch"
            : response.status === 429
              ? "Rate limit reached"
              : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      category: item.category,
      host: item.host,
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "Request failed",
    };
  }
}

export async function GET() {
  const token = process.env.WB_SANDBOX_TOKEN;
  const mode = process.env.WB_API_MODE ?? "sandbox";

  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        mode,
        error: "WB_SANDBOX_TOKEN is not configured",
        results: [],
      },
      { status: 503 },
    );
  }

  if (mode !== "sandbox") {
    return NextResponse.json(
      {
        ok: false,
        mode,
        error: "Diagnostics are restricted to sandbox mode",
        results: [],
      },
      { status: 400 },
    );
  }

  const now = Date.now();
  if (now - lastRunAt < COOLDOWN_MS) {
    return NextResponse.json(
      {
        ok: false,
        mode,
        error: "Cooldown active. Try again in a few seconds.",
        retryAfterMs: COOLDOWN_MS - (now - lastRunAt),
        results: [],
      },
      { status: 429 },
    );
  }
  lastRunAt = now;

  const results: PingResult[] = [];
  for (const item of SANDBOX_PINGS) {
    results.push(await ping(token, item));
  }

  const ok = results.every((item) => item.ok);
  const checkedAt = new Date().toISOString();

  await supabasePatch(
    "integration_settings",
    { provider: "wildberries_sandbox" },
    {
      status: ok ? "connected" : "error",
      last_sync_at: checkedAt,
      details: {
        categories: results.map((item) => ({
          category: item.category,
          ok: item.ok,
          status: item.status,
          wbStatus: item.wbStatus ?? null,
        })),
      },
      last_error: ok
        ? null
        : results
            .filter((item) => !item.ok)
            .map((item) => `${item.category}: ${item.error ?? item.status}`)
            .join("; "),
      updated_at: checkedAt,
    },
  );

  return NextResponse.json({
    ok,
    mode,
    checkedAt,
    results,
  });
}
