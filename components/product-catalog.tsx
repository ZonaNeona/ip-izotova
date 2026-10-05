"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Filter,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { Product360 } from "@/components/product-360";

type CatalogItem = {
  id: string;
  index: number;
  sku: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  cost: number;
  revenue30d: number;
  units30d: number;
  profit30d: number;
  adSpend30d: number;
  margin30d: number;
  drr30d: number;
  wbRevenue30d: number;
  ozonRevenue30d: number;
  wbProfit30d: number;
  ozonProfit30d: number;
  wbAdSpend30d: number;
  ozonAdSpend30d: number;
  wbMargin30d: number;
  ozonMargin30d: number;
  wbDrr30d: number;
  ozonDrr30d: number;
  wbUnits30d: number;
  ozonUnits30d: number;
  wbStock: number;
  ozonStock: number;
  wbPrice: number;
  ozonPrice: number;
  wbRating: number;
  ozonRating: number;
  wbReviews: number;
  ozonReviews: number;
  growth: number;
  wbGrowth: number;
  ozonGrowth: number;
  severity: string | null;
  incidentType: string | null;
  incidentTitle: string | null;
  incidentChannel: string | null;
  wbSeverity: string | null;
  wbIncidentTitle: string | null;
  ozonSeverity: string | null;
  ozonIncidentTitle: string | null;
  thumbnailUrl: string | null;
};

type Channel = "all" | "wb" | "ozon";
type SortKey = "revenue" | "growth" | "margin" | "drr" | "stock";

function rub(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    notation: value >= 100000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value) + " ₽";
}

function pct(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 1,
  }).format(value) + "%";
}

function ProductMark({
  category,
  thumbnailUrl,
  name,
}: {
  category: string;
  thumbnailUrl: string | null;
  name: string;
}) {
  if (thumbnailUrl) {
    return (
      <span className="catalog-product-mark has-image">
        <img src={thumbnailUrl} alt={name} loading="lazy" />
      </span>
    );
  }

  const letters = category
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return <span className="catalog-product-mark">{letters}</span>;
}

export function ProductCatalog() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState<Channel>("all");
  const [category, setCategory] = useState("all");
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("revenue");
  const [descending, setDescending] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    setLoading(true);
    fetch("/api/catalog", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setItems(payload.items ?? []))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(
    () => [...new Set(items.map((item) => item.category))].sort(),
    [items],
  );

  useEffect(() => {
    setPage(1);
  }, [search, channel, category, problemsOnly, sort, descending, pageSize]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    const getSeverity = (item: CatalogItem) =>
      channel === "wb"
        ? item.wbSeverity
        : channel === "ozon"
          ? item.ozonSeverity
          : item.severity;

    const getGrowth = (item: CatalogItem) =>
      channel === "wb"
        ? item.wbGrowth
        : channel === "ozon"
          ? item.ozonGrowth
          : item.growth;

    const result = items.filter((item) => {
      if (
        query &&
        !item.name.toLowerCase().includes(query) &&
        !item.sku.toLowerCase().includes(query) &&
        !item.brand.toLowerCase().includes(query)
      ) {
        return false;
      }

      if (category !== "all" && item.category !== category) return false;
      if (problemsOnly && !getSeverity(item)) return false;
      return true;
    });

    const getRevenue = (item: CatalogItem) =>
      channel === "wb"
        ? item.wbRevenue30d
        : channel === "ozon"
          ? item.ozonRevenue30d
          : item.revenue30d;

    const getStock = (item: CatalogItem) =>
      channel === "wb"
        ? item.wbStock
        : channel === "ozon"
          ? item.ozonStock
          : item.wbStock + item.ozonStock;

    const getter = (item: CatalogItem) => {
      if (sort === "growth") return getGrowth(item);
      if (sort === "margin") {
        return channel === "wb"
          ? item.wbMargin30d
          : channel === "ozon"
            ? item.ozonMargin30d
            : item.margin30d;
      }
      if (sort === "drr") {
        return channel === "wb"
          ? item.wbDrr30d
          : channel === "ozon"
            ? item.ozonDrr30d
            : item.drr30d;
      }
      if (sort === "stock") return getStock(item);
      return getRevenue(item);
    };

    return [...result].sort((a, b) =>
      descending ? getter(b) - getter(a) : getter(a) - getter(b),
    );
  }, [items, search, channel, category, problemsOnly, sort, descending]);

  const totals = useMemo(() => {
    const revenue = items.reduce(
      (sum, item) =>
        sum +
        (channel === "wb"
          ? item.wbRevenue30d
          : channel === "ozon"
            ? item.ozonRevenue30d
            : item.revenue30d),
      0,
    );
    const profit = items.reduce(
      (sum, item) =>
        sum +
        (channel === "wb"
          ? item.wbProfit30d
          : channel === "ozon"
            ? item.ozonProfit30d
            : item.profit30d),
      0,
    );
    const units = items.reduce(
      (sum, item) =>
        sum +
        (channel === "wb"
          ? item.wbUnits30d
          : channel === "ozon"
            ? item.ozonUnits30d
            : item.units30d),
      0,
    );
    const ad = items.reduce(
      (sum, item) =>
        sum +
        (channel === "wb"
          ? item.wbAdSpend30d
          : channel === "ozon"
            ? item.ozonAdSpend30d
            : item.adSpend30d),
      0,
    );
    return {
      revenue,
      profit,
      units,
      margin: revenue ? (profit / revenue) * 100 : 0,
      drr: revenue ? (ad / revenue) * 100 : 0,
      issues: items.filter((item) =>
        channel === "wb"
          ? item.wbSeverity
          : channel === "ozon"
            ? item.ozonSeverity
            : item.severity,
      ).length,
    };
  }, [items, channel]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  if (selectedSku) {
    return (
      <Product360
        sku={selectedSku}
        onBack={() => setSelectedSku(null)}
      />
    );
  }

  if (loading) {
    return (
      <div className="catalog-skeleton card">
        <div className="catalog-skeleton-top">
          <div className="premium-skeleton catalog-skeleton-search" />
          <div className="premium-skeleton catalog-skeleton-filter" />
          <div className="premium-skeleton catalog-skeleton-filter" />
        </div>
        <div className="catalog-skeleton-head">
          {Array.from({ length: 7 }).map((_, index) => (
            <div className="premium-skeleton" key={index} />
          ))}
        </div>
        <div className="catalog-skeleton-rows">
          {Array.from({ length: 7 }).map((_, row) => (
            <div className="catalog-skeleton-row" key={row}>
              <div className="premium-skeleton catalog-skeleton-thumb" />
              <div className="catalog-skeleton-product-copy">
                <div className="premium-skeleton" />
                <div className="premium-skeleton short" />
              </div>
              {Array.from({ length: 6 }).map((__, col) => (
                <div className="premium-skeleton catalog-skeleton-cell" key={col} />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="catalog-page">
      <section className="catalog-summary">
        <div className="catalog-summary-main">
          <div>
            <span>Товаров</span>
            <strong>{items.length}</strong>
          </div>
          <div>
            <span>Выручка · 30д</span>
            <strong>{rub(totals.revenue)}</strong>
          </div>
          <div>
            <span>Прибыль · 30д</span>
            <strong>{rub(totals.profit)}</strong>
          </div>
          <div>
            <span>Маржа</span>
            <strong>{pct(totals.margin)}</strong>
          </div>
          <div>
            <span>ДРР</span>
            <strong>{pct(totals.drr)}</strong>
          </div>
          <div className="catalog-summary-alert">
            <span>Требуют внимания</span>
            <strong>{totals.issues}</strong>
          </div>
        </div>
      </section>

      <article className="card catalog-card">
        <div className="catalog-toolbar">
          <div className="catalog-toolbar-left">
            <div className="search-box catalog-search">
              <Search size={17} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Товар, SKU или бренд"
              />
            </div>

            <select
              className="catalog-select"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="all">Все категории</option>
              {categories.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>

            <button
              className={problemsOnly ? "catalog-filter active" : "catalog-filter"}
              onClick={() => setProblemsOnly((value) => !value)}
            >
              <AlertTriangle size={15} />
              Проблемные
            </button>
          </div>

          <div className="catalog-channel-switch">
            {(["all", "wb", "ozon"] as Channel[]).map((item) => (
              <button
                key={item}
                className={channel === item ? "active" : ""}
                onClick={() => setChannel(item)}
              >
                {item === "all" ? "Все" : item === "wb" ? "WB" : "Ozon"}
              </button>
            ))}
          </div>
        </div>

        <div className="catalog-subtoolbar">
          <div className="catalog-result-count">
            <Filter size={14} />
            {filtered.length} из {items.length}
          </div>
          <div className="catalog-sort">
            <SlidersHorizontal size={14} />
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
            >
              <option value="revenue">Выручка</option>
              <option value="growth">Рост</option>
              <option value="margin">Маржа</option>
              <option value="drr">ДРР</option>
              <option value="stock">Остаток</option>
            </select>
            <button onClick={() => setDescending((value) => !value)}>
              {descending ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
            </button>
          </div>
        </div>

        <div className="catalog-table-wrap">
          <div className="catalog-table">
            <div className="catalog-row catalog-head">
              <span>Товар</span>
              <span>Канал</span>
              <span>Цена</span>
              <span>Выручка 30д</span>
              <span>Продажи</span>
              <span>Маржа</span>
              <span>ДРР</span>
              <span>Остаток</span>
              <span>Динамика</span>
              <span>Статус</span>
              <span />
            </div>

            {paginated.map((item) => {
              const revenue =
                channel === "wb"
                  ? item.wbRevenue30d
                  : channel === "ozon"
                    ? item.ozonRevenue30d
                    : item.revenue30d;
              const units =
                channel === "wb"
                  ? item.wbUnits30d
                  : channel === "ozon"
                    ? item.ozonUnits30d
                    : item.units30d;
              const price =
                channel === "wb"
                  ? item.wbPrice
                  : channel === "ozon"
                    ? item.ozonPrice
                    : item.price;
              const stock =
                channel === "wb"
                  ? item.wbStock
                  : channel === "ozon"
                    ? item.ozonStock
                    : item.wbStock + item.ozonStock;
              const margin =
                channel === "wb"
                  ? item.wbMargin30d
                  : channel === "ozon"
                    ? item.ozonMargin30d
                    : item.margin30d;
              const drr =
                channel === "wb"
                  ? item.wbDrr30d
                  : channel === "ozon"
                    ? item.ozonDrr30d
                    : item.drr30d;
              const growth =
                channel === "wb"
                  ? item.wbGrowth
                  : channel === "ozon"
                    ? item.ozonGrowth
                    : item.growth;
              const severity =
                channel === "wb"
                  ? item.wbSeverity
                  : channel === "ozon"
                    ? item.ozonSeverity
                    : item.severity;
              const incidentTitle =
                channel === "wb"
                  ? item.wbIncidentTitle
                  : channel === "ozon"
                    ? item.ozonIncidentTitle
                    : item.incidentTitle;

              return (
                <div
                  className="catalog-row catalog-data-row"
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedSku(item.sku)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedSku(item.sku);
                    }
                  }}
                >
                  <div className="catalog-product-cell">
                    <ProductMark
                      category={item.category}
                      thumbnailUrl={item.thumbnailUrl}
                      name={item.name}
                    />
                    <div className="catalog-product-copy">
                      <strong>{item.name}</strong>
                      <small>{item.sku} · {item.category}</small>
                    </div>
                  </div>

                  <div className="catalog-cell catalog-channel-cell">
                    {channel === "all" ? (
                      <span className="channel-pair">
                        <i className="wb">WB</i>
                        <i className="ozon">OZ</i>
                      </span>
                    ) : (
                      <span className={`channel-single ${channel}`}>
                        {channel === "wb" ? "WB" : "OZ"}
                      </span>
                    )}
                  </div>

                  <div className="catalog-cell">{new Intl.NumberFormat("ru-RU").format(price)} ₽</div>
                  <div className="catalog-cell catalog-money"><strong>{rub(revenue)}</strong></div>
                  <div className="catalog-cell">{new Intl.NumberFormat("ru-RU").format(units)}</div>

                  <div className="catalog-cell">
                    <b className={margin < 15 ? "catalog-bad" : margin > 25 ? "catalog-good" : ""}>
                      {pct(margin)}
                    </b>
                  </div>

                  <div className="catalog-cell">
                    <b className={drr > 20 ? "catalog-bad" : drr < 15 ? "catalog-good" : ""}>
                      {pct(drr)}
                    </b>
                  </div>

                  <div className="catalog-cell">
                    <b className={stock < 20 ? "catalog-bad" : ""}>{stock}</b>
                  </div>

                  <div className={growth >= 0 ? "catalog-cell catalog-growth positive" : "catalog-cell catalog-growth negative"}>
                    {growth > 0 ? "+" : ""}{growth.toFixed(1)}%
                  </div>

                  <div className="catalog-cell catalog-status-cell">
                    {severity ? (
                      <span className={`catalog-issue ${severity}`}>
                        {incidentTitle}
                      </span>
                    ) : (
                      <span className="catalog-ok">Норма</span>
                    )}
                  </div>

                  <div className="catalog-chevron">
                    <ChevronRight size={16} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="catalog-pagination">
          <div className="catalog-page-size">
            <span>Показывать</span>
            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
            >
              {[25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span>
              {filtered.length === 0
                ? "0 товаров"
                : `${(safePage - 1) * pageSize + 1}–${Math.min(
                    safePage * pageSize,
                    filtered.length,
                  )} из ${filtered.length}`}
            </span>
          </div>

          <div className="catalog-page-controls">
            <button
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={safePage <= 1}
            >
              Назад
            </button>
            <span>
              {safePage} / {pageCount}
            </span>
            <button
              onClick={() =>
                setPage((current) => Math.min(pageCount, current + 1))
              }
              disabled={safePage >= pageCount}
            >
              Далее
            </button>
          </div>
        </div>
      </article>
    </div>
  );
}
