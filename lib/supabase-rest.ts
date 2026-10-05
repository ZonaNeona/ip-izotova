type QueryOptions = {
  select?: string;
  filters?: Record<string, string | number | boolean>;
  order?: string;
};

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

function headers(key: string, extra?: HeadersInit): HeadersInit {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export function isSupabaseConfigured() {
  return Boolean(config());
}

export async function supabaseSelect<T>(
  table: string,
  options: QueryOptions = {},
): Promise<T[] | null> {
  const cfg = config();
  if (!cfg) return null;

  const params = new URLSearchParams();
  params.set("select", options.select ?? "*");

  for (const [key, value] of Object.entries(options.filters ?? {})) {
    params.set(key, `eq.${String(value)}`);
  }

  if (options.order) params.set("order", options.order);

  const response = await fetch(
    `${cfg.url}/rest/v1/${table}?${params.toString()}`,
    {
      headers: headers(cfg.key),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    console.error("Supabase select failed", table, response.status, await response.text());
    return null;
  }

  return (await response.json()) as T[];
}

export async function supabasePatch<T>(
  table: string,
  filters: Record<string, string | number | boolean>,
  body: Record<string, unknown>,
): Promise<T[] | null> {
  const cfg = config();
  if (!cfg) return null;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    params.set(key, `eq.${String(value)}`);
  }

  const response = await fetch(
    `${cfg.url}/rest/v1/${table}?${params.toString()}`,
    {
      method: "PATCH",
      headers: headers(cfg.key, { Prefer: "return=representation" }),
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    console.error("Supabase patch failed", table, response.status, await response.text());
    return null;
  }

  return (await response.json()) as T[];
}

export async function supabaseInsert<T>(
  table: string,
  body: Record<string, unknown> | Array<Record<string, unknown>>,
): Promise<T[] | null> {
  const cfg = config();
  if (!cfg) return null;

  const response = await fetch(`${cfg.url}/rest/v1/${table}`, {
    method: "POST",
    headers: headers(cfg.key, { Prefer: "return=representation" }),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    console.error("Supabase insert failed", table, response.status, await response.text());
    return null;
  }

  return (await response.json()) as T[];
}
