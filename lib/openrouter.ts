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
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    if (strict) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }
    return { data: fallback, mode: "demo" };
  }

  const baseUrl =
    process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";
  const model = process.env.OPENROUTER_MODEL ?? "openrouter/auto";

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          process.env.APP_PUBLIC_URL ?? "http://localhost:3000",
        "X-Title": "WB AI Control Center",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        provider: {
          require_parameters: true,
        },
        ...(webSearch
          ? {
              plugins: [
                {
                  id: "web",
                  max_results: 8,
                  search_prompt:
                    "Search the public web thoroughly for the exact product/model in the user request. Prefer the official manufacturer, then major trustworthy retailers. Return evidence for exact model identity, specifications and the best source page containing a clean product image.",
                },
              ],
            }
          : {}),
        ...(!webSearch && webFetch
          ? {
              tools: [
                {
                  type: "openrouter:web_fetch",
                  parameters: {
                    engine: "openrouter",
                    max_content_tokens: 30000,
                  },
                },
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
