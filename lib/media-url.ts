const PUBLIC_STORAGE_PREFIX = "/storage/v1/object/public/";

const ALLOWED_MEDIA_BUCKETS = new Set([
  "product-thumbnails",
  "product-studio-media",
]);

function encodePath(path: string) {
  return path
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

export function isAllowedMediaBucket(bucket: string) {
  return ALLOWED_MEDIA_BUCKETS.has(bucket);
}

export function storagePublicUrl(bucket: string, path: string) {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  if (!base || !bucket || !path) return null;
  return `${base}${PUBLIC_STORAGE_PREFIX}${encodeURIComponent(bucket)}/${encodePath(path)}`;
}

export function mediaProxyUrl(bucket: string, path: string) {
  return `/api/media?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`;
}

export function clientMediaUrl(value: string | null | undefined) {
  if (!value) return null;
  if (value.startsWith("/api/media?")) return value;

  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  if (!base) return value;

  try {
    const source = new URL(value);
    const supabase = new URL(base);

    if (source.origin !== supabase.origin) return value;
    if (!source.pathname.startsWith(PUBLIC_STORAGE_PREFIX)) return value;

    const rest = source.pathname.slice(PUBLIC_STORAGE_PREFIX.length);
    const slash = rest.indexOf("/");
    if (slash <= 0) return value;

    const bucket = decodeURIComponent(rest.slice(0, slash));
    const path = rest
      .slice(slash + 1)
      .split("/")
      .map(decodeURIComponent)
      .join("/");

    if (!isAllowedMediaBucket(bucket) || !path) return value;
    return mediaProxyUrl(bucket, path);
  } catch {
    return value;
  }
}
