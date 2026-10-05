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

  const response = await fetch(
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
  const response = await fetch(sourceUrl, { cache: "no-store" });
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
