import { NextRequest, NextResponse } from "next/server";

const BASE = "https://content-api-sandbox.wildberries.ru";

function token() {
  return process.env.WB_SANDBOX_TOKEN ?? null;
}

async function wbGet(path: string) {
  const apiToken = token();
  if (!apiToken) {
    return NextResponse.json(
      { error: "WB_SANDBOX_TOKEN is not configured" },
      { status: 503 },
    );
  }

  const response = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: apiToken,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await response.text();
  let payload: unknown = null;

  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text };
  }

  return NextResponse.json(payload, { status: response.status });
}

export async function GET(request: NextRequest) {
  if ((process.env.WB_API_MODE ?? "sandbox") !== "sandbox") {
    return NextResponse.json(
      { error: "WB catalog browser is restricted to sandbox mode" },
      { status: 400 },
    );
  }

  const params = request.nextUrl.searchParams;
  const type = params.get("type");

  if (type === "parents") {
    return wbGet("/content/v2/object/parent/all");
  }

  if (type === "subjects") {
    const parentId = params.get("parentId");
    const name = params.get("name");
    const limit = Math.min(Number(params.get("limit") ?? 100), 1000);
    const offset = Math.max(Number(params.get("offset") ?? 0), 0);

    const query = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });

    if (parentId) query.set("parentID", parentId);
    if (name) query.set("name", name);

    return wbGet(`/content/v2/object/all?${query.toString()}`);
  }

  if (type === "characteristics") {
    const subjectId = params.get("subjectId");
    if (!subjectId) {
      return NextResponse.json(
        { error: "subjectId is required" },
        { status: 400 },
      );
    }

    return wbGet(`/content/v2/object/charcs/${encodeURIComponent(subjectId)}`);
  }

  return NextResponse.json(
    { error: "Unknown type. Use parents, subjects or characteristics." },
    { status: 400 },
  );
}
