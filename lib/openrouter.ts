import { aiProviderConfig, aiProviderHeaders, aiProviderUrl } from "@/lib/ai-provider";

type JsonSchema = Record<string, unknown>;

type OpenRouterResult<T> = {
  data: T;
  mode: "live" | "demo";
};

type OpenRouterJsonOptions<T> = {
  schemaName: string;
  schema: JsonSchema;
  system: string;
  user: string;
  fallback: T;
  webSearch?: boolean;
  webFetch?: boolean;
  strict?: boolean;
};

export async function openRouterJson<T>({
  schemaName,
  schema,
  system,
  user,
  fallback,
  webSearch = false,
  webFetch = false,
  strict = false,
}: OpenRouterJsonOptions<T>): Promise<OpenRouterResult<T>> {
  const provider = aiProviderConfig("openrouter");

  if (!provider.configured) {
    if (strict) {
      throw new Error("OpenRouter is not configured");
    }
    return { data: fallback, mode: "demo" };
  }

  const model = process.env.OPENROUTER_MODEL ?? "openrouter/auto";

  try {
    const response = await fetch(aiProviderUrl("openrouter", "chat/completions"), {
      method: "POST",
      headers: aiProviderHeaders("openrouter", {
        "Content-Type": "application/json",
        "HTTP-Referer":
          process.env.APP_PUBLIC_URL ?? "http://localhost:3000",
        "X-Title": "WB AI Control Center",
      }),
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        provider: {
          require_parameters: true,
        },
        ...((webSearch || webFetch)
          ? {
              tools: [
                ...(webSearch
                  ? [
                      {
                        type: "openrouter:web_search",
                        parameters: {
                          engine: "auto",
                          max_results: 8,
                          max_total_results: 16,
                          search_context_size: "medium",
                        },
                      },
                    ]
                  : []),
                ...(webFetch
                  ? [
                      {
                        type: "openrouter:web_fetch",
                        parameters: {
                          engine: "openrouter",
                          max_content_tokens: 30000,
                        },
                      },
                    ]
                  : []),
              ],
            }
          : {}),
        response_format: {
          type: "json_schema",
          json_schema: {
            name: schemaName,
            strict: true,
            schema,
          },
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(150_000),
    });

    if (!response.ok) {
      const details = await response.text();
      console.error("OpenRouter error", response.status, details);
      if (strict) {
        throw new Error(
          `OpenRouter request failed (${response.status}): ${details.slice(0, 600)}`,
        );
      }
      return { data: fallback, mode: "demo" };
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      if (strict) {
        throw new Error("OpenRouter returned an empty response");
      }
      return { data: fallback, mode: "demo" };
    }

    return {
      data: JSON.parse(content) as T,
      mode: "live",
    };
  } catch (error) {
    console.error("OpenRouter request failed", error);
    if (strict) throw error;
    return { data: fallback, mode: "demo" };
  }
}
