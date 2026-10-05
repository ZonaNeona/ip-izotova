import { forwardProviderRequest } from "@/lib/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request, context) {
  const { path = [] } = await context.params;
  return forwardProviderRequest(request, "openrouter", path);
}

export async function POST(request, context) {
  const { path = [] } = await context.params;
  return forwardProviderRequest(request, "openrouter", path);
}
