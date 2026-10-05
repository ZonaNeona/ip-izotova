type UploadResult = {
  path: string;
  publicUrl: string;
};

function storageConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return { url, key };
}

function storageHeaders(key: string, contentType: string) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": contentType,
    "x-upsert": "true",
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit,
  attempts = 3,
) {
  let lastResponse: Response | null = null;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(input, init);
      lastResponse = response;

      if (response.ok) return response;

      const retryable =
        response.status === 408 ||
        response.status === 425 ||
        response.status === 429 ||
        response.status >= 500;

      if (!retryable || attempt === attempts - 1) return response;
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) throw error;
    }

    await sleep(350 * 2 ** attempt);
  }

  if (lastResponse) return lastResponse;
  throw lastError ?? new Error("Network request failed");
}

export async function uploadBytesToPublicBucket({
  bucket,
  path,
  bytes,
  contentType,
}: {
  bucket: string;
  path: string;
  bytes: ArrayBuffer | Uint8Array;
  contentType: string;
}): Promise<UploadResult | null> {
  const cfg = storageConfig();
  if (!cfg) return null;

  const response = await fetchWithRetry(
    `${cfg.url}/storage/v1/object/${bucket}/${path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`,
    {
      method: "POST",
      headers: storageHeaders(cfg.key, contentType),
      body: bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    console.error(
      "Supabase storage upload failed",
      bucket,
      path,
      response.status,
      await response.text(),
    );
    return null;
  }

  return {
    path,
    publicUrl: `${cfg.url}/storage/v1/object/public/${bucket}/${path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`,
  };
}

export async function persistRemoteAsset({
  sourceUrl,
  bucket,
  path,
  fallbackContentType,
}: {
  sourceUrl: string;
  bucket: string;
  path: string;
  fallbackContentType: string;
}): Promise<UploadResult | null> {
  const response = await fetchWithRetry(
    sourceUrl,
    {
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; MarketplaceStudio/1.0; +https://vercel.app)",
      },
    },
    3,
  );
  if (!response.ok) {
    console.error("Failed to download generated asset", response.status);
    return null;
  }

  const contentType =
    response.headers.get("content-type")?.split(";")[0] || fallbackContentType;
  const buffer = await response.arrayBuffer();

  return uploadBytesToPublicBucket({
    bucket,
    path,
    bytes: buffer,
    contentType,
  });
}

export function dataUriToBytes(dataUri: string) {
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;

  const contentType = match[1];
  const bytes = Uint8Array.from(Buffer.from(match[2], "base64"));
  return { contentType, bytes };
}
