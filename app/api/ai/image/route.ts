import { NextResponse } from "next/server";

type ImageRequest = {
  prompt?: string;
  image?: string | null;
};

type ImageRouterResponse = {
  data?: Array<{
    b64_json?: string;
    url?: string;
  }>;
  cost?: number;
  latency?: number;
};

export async function POST(request: Request) {
  const body = (await request.json()) as ImageRequest;
  const apiKey = process.env.IMAGEROUTER_API_KEY;

  if (!body.prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  if (body.image && body.image.length > 5_500_000) {
    return NextResponse.json(
      { error: "source image is too large" },
      { status: 413 },
    );
  }

  if (!apiKey) {
    return NextResponse.json({
      mode: "demo",
      image: body.image ?? null,
      cost: null,
    });
  }

  const model = process.env.IMAGEROUTER_MODEL ?? "openai/gpt-image-2";

  try {
    const response = await fetch(
      "https://api.imagerouter.io/v1/openai/images/generations",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: body.prompt,
          model,
          quality: "auto",
          size: "1024x1024",
          response_format: "b64_ephemeral",
          output_format: "webp",
          ...(body.image ? { image: body.image } : {}),
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      console.error("ImageRouter error", response.status, await response.text());
      return NextResponse.json({
        mode: "demo",
        image: body.image ?? null,
        cost: null,
      });
    }

    const payload = (await response.json()) as ImageRouterResponse;
    const image = payload.data?.[0]?.b64_json
      ? `data:image/webp;base64,${payload.data[0].b64_json}`
      : payload.data?.[0]?.url ?? null;

    return NextResponse.json({
      mode: image ? "live" : "demo",
      image: image ?? body.image ?? null,
      cost: payload.cost ?? null,
      latency: payload.latency ?? null,
    });
  } catch (error) {
    console.error("ImageRouter request failed", error);
    return NextResponse.json({
      mode: "demo",
      image: body.image ?? null,
      cost: null,
    });
  }
}
