"use client";

import { ExternalLink } from "lucide-react";

function stableNumber(value: string, base: number, range: number) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return base + (Math.abs(hash) % range);
}

export function marketplaceUrls({
  sku,
  wbId,
  ozonId,
}: {
  sku: string;
  wbId?: string | number | null;
  ozonId?: string | number | null;
}) {
  const wbNumeric =
    wbId && /^\d+$/.test(String(wbId))
      ? String(wbId)
      : String(stableNumber(`wb:${sku}`, 120_000_000, 700_000_000));

  const ozonNumeric =
    ozonId && /^\d+$/.test(String(ozonId))
      ? String(ozonId)
      : String(stableNumber(`ozon:${sku}`, 300_000_000, 650_000_000));

  return {
    wb: `https://www.wildberries.ru/catalog/${wbNumeric}/detail.aspx`,
    ozon: `https://www.ozon.ru/product/${ozonNumeric}/`,
  };
}

export function MarketplaceLinks({
  sku,
  wbId,
  ozonId,
  compact = false,
  className = "",
}: {
  sku: string;
  wbId?: string | number | null;
  ozonId?: string | number | null;
  compact?: boolean;
  className?: string;
}) {
  const urls = marketplaceUrls({ sku, wbId, ozonId });

  return (
    <span className={`marketplace-links ${compact ? "compact" : ""} ${className}`.trim()}>
      <a
        href={urls.wb}
        target="_blank"
        rel="noreferrer noopener"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="marketplace-link-mark wb">WB</span>
        {compact ? "WB" : "Посмотреть на WB"}
        <ExternalLink size={compact ? 11 : 12} />
      </a>
      <a
        href={urls.ozon}
        target="_blank"
        rel="noreferrer noopener"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="marketplace-link-mark ozon">OZ</span>
        {compact ? "Ozon" : "Посмотреть на Ozon"}
        <ExternalLink size={compact ? 11 : 12} />
      </a>
    </span>
  );
}
