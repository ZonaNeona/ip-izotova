import { timingSafeEqual } from "node:crypto";

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

function secretMatches(received, expected) {
  if (!received || !expected) return false;

  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

export function authorizeGateway(request) {
  const expected = process.env.GATEWAY_SECRET;
  const received = request.headers.get("x-gateway-secret");

  return secretMatches(received, expected);
}

function providerConfig(provider) {
  return PROVIDERS[provider] ?? null;
}

function cleanPath(parts) {
  return parts
    .map((part) => decodeURIComponent(String(part)))
    .join("/")
    .replace(/^\/+|\/+$/g, "");
}

function allowed(provider, path, method) {
  const config = providerConfig(provider);
  if (!config) return false;

  return config.routes.get(path)?.has(method.toUpperCase()) ?? false;
}

function upstreamHeaders(request, provider, apiKey) {
  const headers = new Headers({
    Authorization: `Bearer ${apiKey}`,
    Accept: request.headers.get("accept") || "application/json",
    "User-Agent": "JOB-AI-Router-Proxy/1.0",
  });

  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  if (provider === "openrouter") {
    headers.set(
      "HTTP-Referer",
      process.env.PROXY_PUBLIC_URL || "https://vercel.app",
    );
    headers.set("X-Title", "JOB AI Router Proxy");
  }

  return headers;
}

function downstreamHeaders(upstream) {
  const headers = new Headers();

  for (const name of [
    "content-type",
    "content-length",
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

export async function forwardProviderRequest(request, provider, parts) {
  if (!authorizeGateway(request)) {
    return Response.json(
      { error: "Unauthorized gateway request" },
      { status: 401 },
    );
  }

  const config = providerConfig(provider);
  if (!config) {
    return Response.json({ error: "Unknown provider" }, { status: 404 });
  }

  const path = cleanPath(parts);
  const method = request.method.toUpperCase();

  if (!allowed(provider, path, method)) {
    return Response.json(
      { error: "Provider route is not allowed" },
      { status: 404 },
    );
  }

  const apiKey = process.env[config.keyEnv];
  if (!apiKey) {
    return Response.json(
      { error: `${config.keyEnv} is not configured` },
      { status: 503 },
    );
  }

  const incomingUrl = new URL(request.url);
  const target = new URL(`${config.baseUrl}/${path}`);
  target.search = incomingUrl.search;

  let body;
  if (!["GET", "HEAD"].includes(method)) {
    body = await request.arrayBuffer();
  }

  try {
    const upstream = await fetch(target, {
      method,
      headers: upstreamHeaders(request, provider, apiKey),
      body,
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(290_000),
    });

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: downstreamHeaders(upstream),
    });
  } catch (error) {
    console.error("AI proxy upstream error", provider, path, error);

    return Response.json(
      {
        error: "Upstream provider request failed",
        provider,
      },
      { status: 502 },
    );
  }
}
