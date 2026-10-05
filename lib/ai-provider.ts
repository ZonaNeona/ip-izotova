type AiProvider = "openrouter" | "imagerouter";

const DEFAULT_BASE: Record<AiProvider, string> = {
  openrouter: "https://openrouter.ai/api/v1",
  imagerouter: "https://api.imagerouter.io/v1",
};

const BASE_ENV: Record<AiProvider, string> = {
  openrouter: "OPENROUTER_BASE_URL",
  imagerouter: "IMAGEROUTER_BASE_URL",
};

const KEY_ENV: Record<AiProvider, string> = {
  openrouter: "OPENROUTER_API_KEY",
  imagerouter: "IMAGEROUTER_API_KEY",
};

function trimSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function aiProviderConfig(provider: AiProvider) {
  const customBase = process.env[BASE_ENV[provider]]?.trim();
  const gatewaySecret = process.env.AI_GATEWAY_SECRET?.trim();
  const apiKey = process.env[KEY_ENV[provider]]?.trim();
  const usingGateway = Boolean(customBase && gatewaySecret);

  return {
    baseUrl: trimSlash(customBase || DEFAULT_BASE[provider]),
    gatewaySecret: gatewaySecret || null,
    apiKey: apiKey || null,
    usingGateway,
    configured: usingGateway || Boolean(apiKey),
  };
}

export function aiProviderUrl(provider: AiProvider, path: string) {
  const config = aiProviderConfig(provider);
  return `${config.baseUrl}/${path.replace(/^\/+/, "")}`;
}

export function aiProviderHeaders(
  provider: AiProvider,
  extra: HeadersInit = {},
) {
  const config = aiProviderConfig(provider);
  const headers = new Headers(extra);

  if (config.usingGateway && config.gatewaySecret) {
    headers.set("X-Gateway-Secret", config.gatewaySecret);
  } else if (config.apiKey) {
    headers.set("Authorization", `Bearer ${config.apiKey}`);
  }

  return headers;
}

export function isAiProviderConfigured(provider: AiProvider) {
  return aiProviderConfig(provider).configured;
}
