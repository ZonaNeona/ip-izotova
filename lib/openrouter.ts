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
};

export async function openRouterJson<T>({
  schemaName,
  schema,
  system,
  user,
  fallback,
  webSearch = false,
}: OpenRouterJsonOptions<T>): Promise<OpenRouterResult<T>> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
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
              tools: [
                {
                  type: "openrouter:web_search",
                  parameters: {
                    engine: "auto",
                    max_results: 4,
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
      console.error("OpenRouter error", response.status, await response.text());
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
      return { data: fallback, mode: "demo" };
    }

    return {
      data: JSON.parse(content) as T,
      mode: "live",
    };
  } catch (error) {
    console.error("OpenRouter request failed", error);
    return { data: fallback, mode: "demo" };
  }
}
