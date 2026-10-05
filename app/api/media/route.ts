import { NextResponse } from "next/server";
import { isAllowedMediaBucket, storagePublicUrl } from "@/lib/media-url";

export const runtime = "nodejs";

function validPath(path: string) {
  if (!path || path.startsWith("/") || path.includes("\\0")) return false;
  return !path.split("/").some((part) => part === "." || part === "..");
}

async function proxyMedia(request: Request, headOnly: boolean) {
  const url = new URL(request.url);
  const bucket = url.searchParams.get("bucket") ?? "";
  const path = url.searchParams.get("path") ?? "";

  if (!isAllowedMediaBucket(bucket) || !validPath(path)) {
    return NextResponse.json({ error: "Недопустимый медиафайл." }, { status: 400 });
  }

  const sourceUrl = storagePublicUrl(bucket, path);
  if (!sourceUrl) {
    return NextResponse.json({ error: "Хранилище не настроено." }, { status: 503 });
  }

  const headers = new Headers();
  for (const name of ["range", "if-none-match", "if-modified-since"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  try {
    const upstream = await fetch(sourceUrl, {
      method: headOnly ? "HEAD" : "GET",
      headers,
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(60000),
    });

    const responseHeaders = new Headers();
    for (const name of [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "etag",
      "last-modified",
    ]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }

    responseHeaders.set(
      "Cache-Control",
      "public, max-age=86400, stale-while-revalidate=604800",
    );
    responseHeaders.set("X-Content-Type-Options", "nosniff");

    return new Response(headOnly ? null : upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Media proxy failed", bucket, path, error);
    return NextResponse.json(
      { error: "Не удалось загрузить медиафайл." },
      { status: 502 },
    );
  }
}

export async function GET(request: Request) {
  return proxyMedia(request, false);
}

export async function HEAD(request: Request) {
  return proxyMedia(request, true);
}
