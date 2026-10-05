const PROVIDERS = {
  openrouter: {
    baseUrl: "https://openrouter.ai/api",
    keyEnv: "OPENROUTER_API_KEY",
    routes: new Map([
      ["v1/chat/completions", new Set(["POST"])],
      ["v1/models", new Set(["GET"])],
      ["v1/key", new Set(["GET"])],
    ]),
  },
  imagerouter: {
    baseUrl: "https://api.imagerouter.io",
    keyEnv: "IMAGEROUTER_API_KEY",
    routes: new Map([
      ["v1/openai/images/generations", new Set(["POST"])],
      ["v1/openai/videos/generations", new Set(["POST"])],
    ]),
  },
};

function secureEqual(a, b) {
  if (!a || !b) return false;

  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);

  if (left.length !== right.length) return false;

  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left[i] ^ right[i];
  }

  return diff === 0;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function authorize(request, env) {
  return secureEqual(
    request.headers.get("x-gateway-secret") || "",
    env.GATEWAY_SECRET || "",
  );
}

function parseProviderPath(pathname) {
  const parts = pathname.split("/").filter(Boolean);

  if (parts.length < 2) return null;

  const provider = parts[0];
  const path = parts.slice(1).join("/");

  if (!PROVIDERS[provider]) return null;

  return { provider, path };
}

function isAllowed(provider, path, method) {
  const config = PROVIDERS[provider];
  return config?.routes.get(path)?.has(method.toUpperCase()) ?? false;
}

function upstreamHeaders(request, provider, apiKey) {
  const headers = new Headers({
    Authorization: `Bearer ${apiKey}`,
    Accept: request.headers.get("accept") || "application/json",
    "User-Agent": "JOB-Cloudflare-AI-Proxy/1.0",
  });

  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  if (provider === "openrouter") {
    headers.set("HTTP-Referer", "https://workers.dev");
    headers.set("X-Title", "JOB AI Router Proxy");
  }

  return headers;
}

function downstreamHeaders(upstream) {
  const headers = new Headers();

  for (const name of [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "retry-after",
    "x-ratelimit-limit",
    "x-ratelimit-remaining",
    "x-ratelimit-reset",
  ]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");

  return headers;
}

export default {
  async fetch(request, env) {
    if (!authorize(request, env)) {
      return json({ error: "Unauthorized gateway request" }, 401);
    }

    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({
        ok: true,
        runtime: "cloudflare-worker",
        openrouter: Boolean(env.OPENROUTER_API_KEY),
        imagerouter: Boolean(env.IMAGEROUTER_API_KEY),
      });
    }

    const parsed = parseProviderPath(url.pathname);
    if (!parsed) {
      return json({ error: "Unknown provider route" }, 404);
    }

    const { provider, path } = parsed;
    const method = request.method.toUpperCase();

    if (!isAllowed(provider, path, method)) {
      return json({ error: "Provider route is not allowed" }, 404);
    }

    const config = PROVIDERS[provider];
    const apiKey = env[config.keyEnv];

    if (!apiKey) {
      return json({ error: `${config.keyEnv} is not configured` }, 503);
    }

    const target = new URL(`${config.baseUrl}/${path}`);
    target.search = url.search;

    let body;
    if (!["GET", "HEAD"].includes(method)) {
      body = request.body;
    }

    try {
      const upstream = await fetch(target.toString(), {
        method,
        headers: upstreamHeaders(request, provider, apiKey),
        body,
        redirect: "follow",
      });

      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: downstreamHeaders(upstream),
      });
    } catch (error) {
      console.error("AI proxy upstream error", provider, path, error);

      return json(
        {
          error: "Upstream provider request failed",
          provider,
        },
        502,
      );
    }
  },
};
