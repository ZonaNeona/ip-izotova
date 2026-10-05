"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Calculator,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { MarketplaceLinks } from "@/components/marketplace-links";
import { ModalPortal } from "@/components/modal-portal";

type Period = 7 | 30 | 90;
type ChannelFilter = "all" | "wb" | "ozon";
type MarginFilter = "all" | "low" | "target" | "high";
type SortKey = "revenue" | "profit" | "margin" | "drr" | "units";

type Metrics = {
  units: number;
  revenue: number;
  commission: number;
  logistics: number;
  storage: number;
  adSpend: number;
  cogs: number;
  profit: number;
  refunds: number;
  avgPrice: number;
};

type EconomicsItem = {
  id: string;
  productId: string;
  sku: string;
  name: string;
  brand: string;
  category: string;
  thumbnailUrl: string | null;
  channel: string;
  externalProductId: string | null;
  listPrice: number;
  baseCost: number;
  periods: Record<string, Metrics>;
};

function rub(value: number) {
  return (
    new Intl.NumberFormat("ru-RU", {
      maximumFractionDigits: 0,
    }).format(value) + " ₽"
  );
}

function compactRub(value: number) {
  return (
    new Intl.NumberFormat("ru-RU", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value) + " ₽"
  );
}

function pct(value: number) {
  return (
    new Intl.NumberFormat("ru-RU", {
      maximumFractionDigits: 1,
    }).format(value) + "%"
  );
}

function marginOf(metrics: Metrics) {
  return metrics.revenue ? (metrics.profit / metrics.revenue) * 100 : 0;
}

function drrOf(metrics: Metrics) {
  return metrics.revenue ? (metrics.adSpend / metrics.revenue) * 100 : 0;
}

function perUnit(value: number, units: number) {
  return units ? value / units : 0;
}

export function UnitEconomicsCenter() {
  const [items, setItems] = useState<EconomicsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>(30);
  const [channel, setChannel] = useState<ChannelFilter>("all");
  const [marginFilter, setMarginFilter] = useState<MarginFilter>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("revenue");
  const [descending, setDescending] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [priceDelta, setPriceDelta] = useState(0);
  const [adsDelta, setAdsDelta] = useState(0);
  const [costDelta, setCostDelta] = useState(0);
  const [volumeDelta, setVolumeDelta] = useState(0);

  useEffect(() => {
    fetch("/api/unit-economics", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setItems(payload.items ?? []))
      .finally(() => setLoading(false));
  }, []);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = items.filter((item) => {
      if (channel !== "all" && item.channel !== channel) return false;

      if (
        query &&
        !item.name.toLowerCase().includes(query) &&
        !item.sku.toLowerCase().includes(query) &&
        !item.brand.toLowerCase().includes(query)
      ) {
        return false;
      }

      const metrics = item.periods[String(period)];
      const margin = marginOf(metrics);

      if (marginFilter === "low" && margin >= 15) return false;
      if (marginFilter === "target" && (margin < 15 || margin >= 25)) {
        return false;
      }
      if (marginFilter === "high" && margin < 25) return false;

      return true;
    });

    const getter = (item: EconomicsItem) => {
      const metrics = item.periods[String(period)];
      if (sort === "profit") return metrics.profit;
      if (sort === "margin") return marginOf(metrics);
      if (sort === "drr") return drrOf(metrics);
      if (sort === "units") return metrics.units;
      return metrics.revenue;
    };

    return [...filtered].sort((a, b) =>
      descending ? getter(b) - getter(a) : getter(a) - getter(b),
    );
  }, [
    items,
    period,
    channel,
    marginFilter,
    search,
    sort,
    descending,
  ]);

  const totals = useMemo(() => {
    const metrics = rows.map((item) => item.periods[String(period)]);
    const revenue = metrics.reduce((sum, row) => sum + row.revenue, 0);
    const profit = metrics.reduce((sum, row) => sum + row.profit, 0);
    const adSpend = metrics.reduce((sum, row) => sum + row.adSpend, 0);
    const units = metrics.reduce((sum, row) => sum + row.units, 0);
    const low = rows.filter(
      (item) => marginOf(item.periods[String(period)]) < 15,
    ).length;

    return {
      revenue,
      profit,
      units,
      margin: revenue ? (profit / revenue) * 100 : 0,
      drr: revenue ? (adSpend / revenue) * 100 : 0,
      low,
    };
  }, [rows, period]);

  const selected = items.find((item) => item.id === selectedId) ?? null;
  const selectedMetrics = selected
    ? selected.periods[String(period)]
    : null;

  const scenario = useMemo(() => {
    if (!selectedMetrics) return null;

    const units = Math.max(
      selectedMetrics.units * (1 + volumeDelta / 100),
      0,
    );
    const currentUnitPrice =
      selectedMetrics.units > 0
        ? selectedMetrics.revenue / selectedMetrics.units
        : selectedMetrics.avgPrice;
    const price = currentUnitPrice * (1 + priceDelta / 100);

    const commissionRate = selectedMetrics.revenue
      ? selectedMetrics.commission / selectedMetrics.revenue
      : 0;
    const adsRate = selectedMetrics.revenue
      ? selectedMetrics.adSpend / selectedMetrics.revenue
      : 0;

    const logisticsUnit = perUnit(
      selectedMetrics.logistics,
      selectedMetrics.units,
    );
    const storageUnit = perUnit(
      selectedMetrics.storage,
      selectedMetrics.units,
    );
    const cogsUnit =
      perUnit(selectedMetrics.cogs, selectedMetrics.units) *
      (1 + costDelta / 100);

    const revenue = price * units;
    const commission = revenue * commissionRate;
    const adSpend =
      revenue * adsRate * (1 + adsDelta / 100);
    const logistics = logisticsUnit * units;
    const storage = storageUnit * units;
    const cogs = cogsUnit * units;
    const profit =
      revenue - commission - adSpend - logistics - storage - cogs;
    const margin = revenue ? (profit / revenue) * 100 : 0;
    const drr = revenue ? (adSpend / revenue) * 100 : 0;

    const variableRate = commissionRate + adsRate * (1 + adsDelta / 100);
    const fixedPerUnit = logisticsUnit + storageUnit + cogsUnit;
    const breakEvenPrice =
      1 - variableRate > 0 ? fixedPerUnit / (1 - variableRate) : 0;

    return {
      units,
      price,
      revenue,
      commission,
      adSpend,
      logistics,
      storage,
      cogs,
      profit,
      margin,
      drr,
      breakEvenPrice,
    };
  }, [
    selectedMetrics,
    priceDelta,
    adsDelta,
    costDelta,
    volumeDelta,
  ]);

  useEffect(() => {
    if (!selectedId) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedId(null);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedId]);

  function openScenario(item: EconomicsItem) {
    setSelectedId(item.id);
    setPriceDelta(0);
    setAdsDelta(0);
    setCostDelta(0);
    setVolumeDelta(0);
  }

  if (loading) {
    return (
      <div className="economics-loading card">
        <RefreshCw size={24} className="spin" />
        <strong>Считаем юнит‑экономику…</strong>
        <span>Комиссия, логистика, реклама, себестоимость и прибыль</span>
      </div>
    );
  }

  return (
    <div className="economics-center">
      <section className="economics-kpis">
        <article className="card economics-kpi">
          <span>Выручка · {period}д</span>
          <strong>{compactRub(totals.revenue)}</strong>
          <small>{numberForUnits(totals.units)} проданных единиц</small>
        </article>
        <article className="card economics-kpi">
          <span>Прибыль</span>
          <strong>{compactRub(totals.profit)}</strong>
          <small>после всех переменных расходов</small>
        </article>
        <article className="card economics-kpi">
          <span>Маржа</span>
          <strong className={totals.margin < 15 ? "danger-text" : ""}>
            {pct(totals.margin)}
          </strong>
          <small>взвешенная по выручке</small>
        </article>
        <article className="card economics-kpi">
          <span>ДРР</span>
          <strong>{pct(totals.drr)}</strong>
          <small>рекламные расходы / выручка</small>
        </article>
        <article className="card economics-kpi attention">
          <span>Ниже 15% маржи</span>
          <strong>{totals.low}</strong>
          <small>SKU × каналов требуют внимания</small>
        </article>
      </section>

      <section className="card economics-center-card">
        <div className="economics-toolbar">
          <div className="search-box economics-search">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Товар, SKU или бренд"
            />
          </div>

          <div className="economics-period-switch">
            {([7, 30, 90] as Period[]).map((value) => (
              <button
                key={value}
                className={period === value ? "active" : ""}
                onClick={() => setPeriod(value)}
              >
                {value} дней
              </button>
            ))}
          </div>

          <div className="economics-channel-switch">
            {([
              ["all", "Все"],
              ["wb", "WB"],
              ["ozon", "Ozon"],
            ] as Array<[ChannelFilter, string]>).map(([value, label]) => (
              <button
                key={value}
                className={channel === value ? "active" : ""}
                onClick={() => setChannel(value)}
              >
                {label}
              </button>
            ))}
          </div>

          <select
            value={marginFilter}
            onChange={(event) =>
              setMarginFilter(event.target.value as MarginFilter)
            }
          >
            <option value="all">Любая маржа</option>
            <option value="low">Ниже 15%</option>
            <option value="target">15–25%</option>
            <option value="high">Выше 25%</option>
          </select>
        </div>

        <div className="economics-subtoolbar">
          <span>{rows.length} позиций</span>
          <div className="economics-sort">
            <span>Сортировка</span>
            <select
              value={sort}
              onChange={(event) =>
                setSort(event.target.value as SortKey)
              }
            >
              <option value="revenue">Выручка</option>
              <option value="profit">Прибыль</option>
              <option value="margin">Маржа</option>
              <option value="drr">ДРР</option>
              <option value="units">Продажи</option>
            </select>
            <button onClick={() => setDescending((value) => !value)}>
              {descending ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
            </button>
          </div>
        </div>

        <div className="economics-center-table-wrap">
          <div className="economics-center-table">
            <div className="economics-center-row head">
              <span>Товар</span>
              <span>Канал</span>
              <span>Цена</span>
              <span>Продано</span>
              <span>Выручка</span>
              <span>Комиссия</span>
              <span>Логистика</span>
              <span>Реклама</span>
              <span>Прибыль</span>
              <span>Маржа</span>
              <span />
            </div>

            {rows.map((item) => {
              const metrics = item.periods[String(period)];
              const margin = marginOf(metrics);
              const commissionRate = metrics.revenue
                ? (metrics.commission / metrics.revenue) * 100
                : 0;

              return (
                <div
                  key={item.id}
                  className={`economics-center-row data ${margin < 15 ? "low-margin" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => openScenario(item)}
                >
                  <div className="economics-product-cell">
                    <span className="economics-product-thumb">
                      {item.thumbnailUrl ? (
                        <img src={item.thumbnailUrl} alt="" />
                      ) : (
                        <CircleDollarSign size={17} />
                      )}
                    </span>
                    <span>
                      <strong>{item.name}</strong>
                      <small>{item.sku}</small>
                      <MarketplaceLinks
                        sku={item.sku}
                        wbId={
                          item.channel === "wb"
                            ? item.externalProductId
                            : null
                        }
                        ozonId={
                          item.channel === "ozon"
                            ? item.externalProductId
                            : null
                        }
                        only={item.channel === "wb" ? "wb" : "ozon"}
                        compact
                      />
                    </span>
                  </div>
                  <span>
                    <i className={`economics-channel ${item.channel}`}>
                      {item.channel === "wb" ? "WB" : "Ozon"}
                    </i>
                  </span>
                  <span>{rub(metrics.avgPrice)}</span>
                  <span>{numberForUnits(metrics.units)}</span>
                  <span><strong>{compactRub(metrics.revenue)}</strong></span>
                  <span>{pct(commissionRate)}</span>
                  <span>{rub(perUnit(metrics.logistics + metrics.storage, metrics.units))}/шт.</span>
                  <span>
                    {compactRub(metrics.adSpend)}
                    <small className="economics-drr">
                      ДРР {pct(drrOf(metrics))}
                    </small>
                  </span>
                  <span><strong>{compactRub(metrics.profit)}</strong></span>
                  <span>
                    <b
                      className={
                        margin < 15
                          ? "economics-margin bad"
                          : margin >= 25
                            ? "economics-margin good"
                            : "economics-margin"
                      }
                    >
                      {pct(margin)}
                    </b>
                  </span>
                  <ChevronRight size={16} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="economics-formula-note">
          <Calculator size={17} />
          <span>
            Прибыль = выручка − комиссия − логистика − хранение − реклама −
            себестоимость. Все показатели рассчитаны кодом по фактическим
            метрикам периода.
          </span>
        </div>
      </section>

      {selected && selectedMetrics && scenario && (
        <ModalPortal>
          <div
            className="economics-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setSelectedId(null);
            }}
          >
            <section className="economics-modal" role="dialog" aria-modal="true">
              <div className="economics-modal-head">
                <div>
                  <span className="eyebrow">
                    <SlidersHorizontal size={14} /> Сценарный калькулятор
                  </span>
                  <h3>{selected.name}</h3>
                  <p>
                    {selected.channel === "wb" ? "Wildberries" : "Ozon"} ·{" "}
                    {period} дней
                  </p>
                </div>
                <button onClick={() => setSelectedId(null)}>
                  <X size={19} />
                </button>
              </div>

              <div className="economics-modal-body">
                <div className="economics-current-summary">
                  <div>
                    <span>Текущая цена</span>
                    <strong>{rub(selectedMetrics.revenue / Math.max(selectedMetrics.units,1))}</strong>
                  </div>
                  <div>
                    <span>Прибыль</span>
                    <strong>{rub(selectedMetrics.profit)}</strong>
                  </div>
                  <div>
                    <span>Маржа</span>
                    <strong>{pct(marginOf(selectedMetrics))}</strong>
                  </div>
                  <div>
                    <span>ДРР</span>
                    <strong>{pct(drrOf(selectedMetrics))}</strong>
                  </div>
                </div>

                <div className="economics-scenario-controls">
                  <ScenarioControl
                    label="Цена"
                    value={priceDelta}
                    onChange={setPriceDelta}
                    min={-20}
                    max={20}
                  />
                  <ScenarioControl
                    label="Расход на рекламу"
                    value={adsDelta}
                    onChange={setAdsDelta}
                    min={-50}
                    max={50}
                  />
                  <ScenarioControl
                    label="Себестоимость"
                    value={costDelta}
                    onChange={setCostDelta}
                    min={-20}
                    max={30}
                  />
                  <ScenarioControl
                    label="Объём продаж"
                    value={volumeDelta}
                    onChange={setVolumeDelta}
                    min={-30}
                    max={40}
                  />
                </div>

                <div className="economics-projection">
                  <div className="economics-projection-head">
                    <div>
                      <span className="eyebrow">Сценарий</span>
                      <h4>Прогноз результата</h4>
                    </div>
                    <button
                      className="secondary-button"
                      onClick={() => {
                        setPriceDelta(0);
                        setAdsDelta(0);
                        setCostDelta(0);
                        setVolumeDelta(0);
                      }}
                    >
                      <RotateCcw size={14} /> Сбросить
                    </button>
                  </div>

                  <div className="economics-projection-grid">
                    <ProjectionCard
                      label="Выручка"
                      current={selectedMetrics.revenue}
                      projected={scenario.revenue}
                      money
                    />
                    <ProjectionCard
                      label="Прибыль"
                      current={selectedMetrics.profit}
                      projected={scenario.profit}
                      money
                    />
                    <ProjectionCard
                      label="Маржа"
                      current={marginOf(selectedMetrics)}
                      projected={scenario.margin}
                    />
                    <ProjectionCard
                      label="ДРР"
                      current={drrOf(selectedMetrics)}
                      projected={scenario.drr}
                      inverse
                    />
                  </div>
                </div>

                <div className="economics-break-even">
                  <Calculator size={18} />
                  <div>
                    <span>Расчётная точка безубыточности</span>
                    <strong>{rub(scenario.breakEvenPrice)} за единицу</strong>
                    <p>
                      При текущих ставках комиссии и рекламы цена ниже этого
                      уровня делает вклад товара отрицательным.
                    </p>
                  </div>
                </div>

                <div className="economics-cost-breakdown">
                  {[
                    ["Комиссия", scenario.commission],
                    ["Логистика", scenario.logistics],
                    ["Хранение", scenario.storage],
                    ["Реклама", scenario.adSpend],
                    ["Себестоимость", scenario.cogs],
                  ].map(([label, value]) => (
                    <div key={String(label)}>
                      <span>{label}</span>
                      <strong>−{rub(Number(value))}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="economics-modal-footer">
                <span>
                  Сценарий ничего не меняет в маркетплейсе — это безопасная
                  модель для принятия решения.
                </span>
                <button
                  className="primary-button"
                  onClick={() => setSelectedId(null)}
                >
                  <CheckCircle2 size={15} /> Готово
                </button>
              </div>
            </section>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}

function numberForUnits(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(value);
}

function ScenarioControl({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
}) {
  return (
    <label className="scenario-control">
      <div>
        <span>{label}</span>
        <strong className={value > 0 ? "positive" : value < 0 ? "negative" : ""}>
          {value > 0 ? "+" : ""}
          {value}%
        </strong>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div className="scenario-range">
        <span>{min}%</span>
        <span>{max}%</span>
      </div>
    </label>
  );
}

function ProjectionCard({
  label,
  current,
  projected,
  money = false,
  inverse = false,
}: {
  label: string;
  current: number;
  projected: number;
  money?: boolean;
  inverse?: boolean;
}) {
  const delta = current
    ? ((projected - current) / Math.abs(current)) * 100
    : 0;
  const better = inverse ? delta < 0 : delta > 0;

  return (
    <div className="projection-card">
      <span>{label}</span>
      <strong>{money ? compactRub(projected) : pct(projected)}</strong>
      <small className={better ? "positive" : delta === 0 ? "" : "negative"}>
        {delta === 0 ? (
          "без изменений"
        ) : (
          <>
            {better ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {delta > 0 ? "+" : ""}
            {delta.toFixed(1)}%
          </>
        )}
      </small>
    </div>
  );
}
