import { authorizeGateway } from "@/lib/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  if (!authorizeGateway(request)) {
    return Response.json({ error: "Unauthorized gateway request" }, { status: 401 });
  }

  return Response.json(
    {
      ok: true,
      region: process.env.VERCEL_REGION || "fra1",
      openrouter: Boolean(process.env.OPENROUTER_API_KEY),
      imagerouter: Boolean(process.env.IMAGEROUTER_API_KEY),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
