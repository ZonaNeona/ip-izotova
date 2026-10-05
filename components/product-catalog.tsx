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
  severity: string | null;
  incidentType: string | null;
  incidentTitle: string | null;
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
      <div className="catalog-product-mark has-image">
        <img src={thumbnailUrl} alt={name} />
      </div>
    );
  }

  const letters = category
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return <div className="catalog-product-mark">{letters}</div>;
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

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

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
      if (problemsOnly && !item.severity) return false;
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
      if (sort === "growth") return item.growth;
      if (sort === "margin") return item.margin30d;
      if (sort === "drr") return item.drr30d;
      if (sort === "stock") return getStock(item);
      return getRevenue(item);
    };

    return [...result].sort((a, b) =>
      descending ? getter(b) - getter(a) : getter(a) - getter(b),
    );
  }, [items, search, channel, category, problemsOnly, sort, descending]);

  const totals = useMemo(() => {
    const revenue = items.reduce((sum, item) => sum + item.revenue30d, 0);
    const profit = items.reduce((sum, item) => sum + item.profit30d, 0);
    const units = items.reduce((sum, item) => sum + item.units30d, 0);
    const ad = items.reduce((sum, item) => sum + item.adSpend30d, 0);
    return {
      revenue,
      profit,
      units,
      margin: revenue ? (profit / revenue) * 100 : 0,
      drr: revenue ? (ad / revenue) * 100 : 0,
      issues: items.filter((item) => item.severity).length,
    };
  }, [items]);

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
      <div className="catalog-loading card">
        <RefreshCw size={24} />
        <strong>Загружаем каталог…</strong>
        <span>100 SKU · WB + Ozon · 30-дневная сводка</span>
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

            {filtered.map((item) => {
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

              return (
                <button
                  className="catalog-row catalog-data-row"
                  key={item.id}
                  onClick={() => setSelectedSku(item.sku)}
                >
                  <span className="catalog-product-cell">
                    <ProductMark
                      category={item.category}
                      thumbnailUrl={item.thumbnailUrl}
                      name={item.name}
                    />
                    <span>
                      <strong>{item.name}</strong>
                      <small>{item.sku} · {item.category}</small>
                    </span>
                  </span>

                  <span>
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
                  </span>

                  <span>{new Intl.NumberFormat("ru-RU").format(price)} ₽</span>
                  <span><strong>{rub(revenue)}</strong></span>
                  <span>{new Intl.NumberFormat("ru-RU").format(units)}</span>

                  <span>
                    <b className={item.margin30d < 15 ? "catalog-bad" : item.margin30d > 25 ? "catalog-good" : ""}>
                      {pct(item.margin30d)}
                    </b>
                  </span>

                  <span>
                    <b className={item.drr30d > 20 ? "catalog-bad" : item.drr30d < 15 ? "catalog-good" : ""}>
                      {pct(item.drr30d)}
                    </b>
                  </span>

                  <span>
                    <b className={stock < 20 ? "catalog-bad" : ""}>{stock}</b>
                  </span>

                  <span className={item.growth >= 0 ? "catalog-growth positive" : "catalog-growth negative"}>
                    {item.growth > 0 ? "+" : ""}{item.growth.toFixed(1)}%
                  </span>

                  <span>
                    {item.severity ? (
                      <span className={`catalog-issue ${item.severity}`}>
                        {item.incidentTitle}
                      </span>
                    ) : (
                      <span className="catalog-ok">Норма</span>
                    )}
                  </span>

                  <span className="catalog-chevron">
                    <ChevronRight size={16} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </article>
    </div>
  );
}
