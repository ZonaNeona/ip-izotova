"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Gauge,
  MousePointerClick,
  RefreshCw,
  Search,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import { MarketplaceLinks } from "@/components/marketplace-links";
import { ModalPortal } from "@/components/modal-portal";

type DailyMetric = {
  date: string;
  impressions: number;
  clicks: number;
  orders: number;
  spend: number;
  revenue: number;
  ctr: number;
  cpc: number;
  conversion: number;
  drr: number;
  bid: number;
};

type Campaign = {
  id: string;
  name: string;
  product: {
    id: string;
    sku: string;
    name: string;
    thumbnailUrl: string | null;
  };
  channel: {
    code: string;
    name: string;
    externalProductId: string | null;
  };
  currentBid: number;
  recommendedBid: number;
  targetDrr: number;
  status: string;
  type: string;
  recommendationReason: string | null;
  recommendationStatus: string;
  updatedAt: string;
  metrics: DailyMetric[];
};

type ChannelFilter = "all" | "wb" | "ozon";
type HealthFilter = "all" | "attention" | "healthy";
type MetricKey = "spend" | "revenue" | "drr" | "orders";
type SortKey = "spend" | "revenue" | "drr" | "orders" | "conversion";

const metricLabels: Record<MetricKey, string> = {
  spend: "Расход",
  revenue: "Выручка с рекламы",
  drr: "ДРР",
  orders: "Заказы",
};

function rub(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(value) + " ₽";
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
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 1,
  }).format(value) + "%";
}

function campaignTypeRu(value: string) {
  const map: Record<string, string> = {
    search: "Поиск",
    catalog: "Каталог",
    recommendation: "Рекомендации",
  };
  return map[value] ?? value;
}

function statusRu(value: string) {
  const map: Record<string, string> = {
    active: "Активна",
    paused: "Приостановлена",
    archived: "Архив",
  };
  return map[value] ?? value;
}

function recommendationStatusRu(value: string) {
  const map: Record<string, string> = {
    suggested: "Есть рекомендация",
    stable: "Ставка оптимальна",
    applied: "Применено",
  };
  return map[value] ?? value;
}

function summarize(metrics: DailyMetric[]) {
  const spend = metrics.reduce((sum, row) => sum + row.spend, 0);
  const revenue = metrics.reduce((sum, row) => sum + row.revenue, 0);
  const impressions = metrics.reduce((sum, row) => sum + row.impressions, 0);
  const clicks = metrics.reduce((sum, row) => sum + row.clicks, 0);
  const orders = metrics.reduce((sum, row) => sum + row.orders, 0);

  return {
    spend,
    revenue,
    impressions,
    clicks,
    orders,
    ctr: impressions ? (clicks / impressions) * 100 : 0,
    cpc: clicks ? spend / clicks : 0,
    conversion: clicks ? (orders / clicks) * 100 : 0,
    drr: revenue ? (spend / revenue) * 100 : 0,
    roas: spend ? revenue / spend : 0,
  };
}

function aggregateByDate(campaigns: Campaign[], period: number) {
  const map = new Map<string, DailyMetric[]>();

  for (const campaign of campaigns) {
    for (const row of campaign.metrics.slice(-period)) {
      const list = map.get(row.date) ?? [];
      list.push(row);
      map.set(row.date, list);
    }
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, rows]) => {
      const summary = summarize(rows);
      return {
        date,
        spend: summary.spend,
        revenue: summary.revenue,
        drr: summary.drr,
        orders: summary.orders,
      };
    });
}

function AdvertisingChart({
  data,
  metric,
}: {
  data: Array<{ date: string; spend: number; revenue: number; drr: number; orders: number }>;
  metric: MetricKey;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const width = 900;
  const height = 250;
  const paddingX = 16;
  const paddingY = 20;
  const values = data.map((row) => Number(row[metric]) || 0);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);

  const points = values.map((value, index) => {
    const x =
      paddingX +
      (index / Math.max(values.length - 1, 1)) * (width - paddingX * 2);
    const y =
      paddingY +
      (1 - (value - min) / span) * (height - paddingY * 2);
    return { x, y, value };
  });

  const polyline = points
    .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(" ");

  const fill = `${paddingX},${height - paddingY} ${polyline} ${width - paddingX},${height - paddingY}`;
  const hoverPoint = hovered === null ? null : points[hovered];
  const hoverRow = hovered === null ? null : data[hovered];

  function format(value: number) {
    if (metric === "spend" || metric === "revenue") return rub(value);
    if (metric === "drr") return pct(value);
    return new Intl.NumberFormat("ru-RU").format(value);
  }

  return (
    <div className="ad-chart-wrap">
      <div className="ad-chart-stage">
        <svg
          className="ad-chart"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          onMouseLeave={() => setHovered(null)}
          onMouseMove={(event) => {
            if (!data.length) return;
            const rect = event.currentTarget.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const ratio = Math.max(0, Math.min(1, x / Math.max(rect.width, 1)));
            setHovered(Math.round(ratio * Math.max(data.length - 1, 0)));
          }}
        >
          {[0.25, 0.5, 0.75].map((ratio) => (
            <line
              key={ratio}
              x1="0"
              x2={width}
              y1={height * ratio}
              y2={height * ratio}
              className="ad-gridline"
            />
          ))}
          <polygon points={fill} className="ad-area" />
          <polyline points={polyline} className="ad-line" />
          {hoverPoint && (
            <>
              <line
                x1={hoverPoint.x}
                x2={hoverPoint.x}
                y1={paddingY}
                y2={height - paddingY}
                className="ad-hover-line"
              />
              <circle
                cx={hoverPoint.x}
                cy={hoverPoint.y}
                r="5"
                className="ad-hover-dot"
              />
            </>
          )}
        </svg>

        {hoverPoint && hoverRow && (
          <div
            className="ad-chart-tooltip"
            style={{
              left: `${(hoverPoint.x / width) * 100}%`,
              top: `${(hoverPoint.y / height) * 100}%`,
            }}
          >
            <span>
              {new Date(hoverRow.date).toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "short",
              })}
            </span>
            <strong>{format(hoverPoint.value)}</strong>
          </div>
        )}
      </div>
      <div className="ad-chart-axis">
        <span>
          {data[0]?.date
            ? new Date(data[0].date).toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "short",
              })
            : "—"}
        </span>
        <span>
          {data.at(-1)?.date
            ? new Date(data.at(-1)!.date).toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "short",
              })
            : "—"}
        </span>
      </div>
    </div>
  );
}

export function AdvertisingCenter() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState<ChannelFilter>("all");
  const [health, setHealth] = useState<HealthFilter>("all");
  const [type, setType] = useState("all");
  const [period, setPeriod] = useState(30);
  const [metric, setMetric] = useState<MetricKey>("spend");
  const [sort, setSort] = useState<SortKey>("spend");
  const [descending, setDescending] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/advertising", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setCampaigns(payload.campaigns ?? []))
      .finally(() => setLoading(false));
  }, []);

  const campaignStats = useMemo(() => {
    return new Map(
      campaigns.map((campaign) => [
        campaign.id,
        summarize(campaign.metrics.slice(-period)),
      ]),
    );
  }, [campaigns, period]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    const list = campaigns.filter((campaign) => {
      if (
        query &&
        !campaign.product.name.toLowerCase().includes(query) &&
        !campaign.product.sku.toLowerCase().includes(query) &&
        !campaign.name.toLowerCase().includes(query)
      ) {
        return false;
      }

      if (channel !== "all" && campaign.channel.code !== channel) return false;
      if (type !== "all" && campaign.type !== type) return false;

      const summary = campaignStats.get(campaign.id);
      const needsAttention = summary
        ? summary.drr > campaign.targetDrr * 1.05
        : false;

      if (health === "attention" && !needsAttention) return false;
      if (health === "healthy" && needsAttention) return false;
      return true;
    });

    const getter = (campaign: Campaign) => {
      const stats = campaignStats.get(campaign.id);
      if (!stats) return 0;
      if (sort === "revenue") return stats.revenue;
      if (sort === "drr") return stats.drr;
      if (sort === "orders") return stats.orders;
      if (sort === "conversion") return stats.conversion;
      return stats.spend;
    };

    return [...list].sort((a, b) =>
      descending ? getter(b) - getter(a) : getter(a) - getter(b),
    );
  }, [
    campaigns,
    campaignStats,
    search,
    channel,
    type,
    health,
    sort,
    descending,
  ]);

  const total = useMemo(() => {
    const rows = filtered.flatMap((campaign) => campaign.metrics.slice(-period));
    return summarize(rows);
  }, [filtered, period]);

  const chartData = useMemo(
    () => aggregateByDate(filtered, period),
    [filtered, period],
  );

  const attentionCount = useMemo(
    () =>
      filtered.filter((campaign) => {
        const summary = campaignStats.get(campaign.id);
        return Boolean(summary && summary.drr > campaign.targetDrr * 1.05);
      }).length,
    [filtered, campaignStats],
  );

  const selected =
    campaigns.find((campaign) => campaign.id === selectedId) ?? null;
  const selectedStats = selected ? campaignStats.get(selected.id) : null;

  useEffect(() => {
    if (!selectedId) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedId(null);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedId]);

  async function applyBid(campaign: Campaign) {
    if (applying || campaign.currentBid === campaign.recommendedBid) return;

    setApplying(true);
    setMessage(null);

    try {
      const response = await fetch("/api/actions/bid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: campaign.id,
          sku: campaign.product.sku,
          from: campaign.currentBid,
          to: campaign.recommendedBid,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setMessage(payload.error ?? "Не удалось изменить ставку.");
        return;
      }

      setCampaigns((current) =>
        current.map((item) =>
          item.id === campaign.id
            ? {
                ...item,
                currentBid: item.recommendedBid,
                recommendationStatus: "applied",
                updatedAt: new Date().toISOString(),
              }
            : item,
        ),
      );
      setMessage("Новая ставка применена и записана в журнал действий.");
    } catch {
      setMessage("Не удалось изменить ставку.");
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return (
      <div className="ad-loading card">
        <RefreshCw size={24} />
        <strong>Загружаем рекламную аналитику…</strong>
        <span>Кампании, ставки и 90 дней истории</span>
      </div>
    );
  }

  return (
    <div className="ad-page">
      <section className="ad-kpis">
        <article className="card ad-kpi">
          <span>Расход · {period}д</span>
          <strong>{compactRub(total.spend)}</strong>
          <small>{filtered.length} кампаний</small>
        </article>
        <article className="card ad-kpi">
          <span>Выручка с рекламы</span>
          <strong>{compactRub(total.revenue)}</strong>
          <small>окупаемость рекламы {total.roas.toFixed(2)}×</small>
        </article>
        <article className="card ad-kpi">
          <span>ДРР</span>
          <strong className={total.drr > 15 ? "bad-metric" : "ok-text"}>
            {pct(total.drr)}
          </strong>
          <small>взвешенный по выручке</small>
        </article>
        <article className="card ad-kpi">
          <span>Заказы</span>
          <strong>{new Intl.NumberFormat("ru-RU").format(total.orders)}</strong>
          <small>конверсия {pct(total.conversion)}</small>
        </article>
        <article className="card ad-kpi attention">
          <span>Требуют внимания</span>
          <strong>{attentionCount}</strong>
          <small>ДРР выше цели</small>
        </article>
      </section>

      <section className="card ad-overview">
        <div className="ad-overview-head">
          <div>
            <span className="eyebrow">Динамика рекламы</span>
            <h2>{metricLabels[metric]}</h2>
          </div>

          <div className="ad-periods">
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                className={period === days ? "active" : ""}
                onClick={() => setPeriod(days)}
              >
                {days} дней
              </button>
            ))}
          </div>
        </div>

        <div className="ad-metric-tabs">
          {(Object.keys(metricLabels) as MetricKey[]).map((key) => (
            <button
              key={key}
              className={metric === key ? "active" : ""}
              onClick={() => setMetric(key)}
            >
              {metricLabels[key]}
            </button>
          ))}
        </div>

        <AdvertisingChart data={chartData} metric={metric} />
      </section>

      <section className="card ad-campaign-card">
        <div className="ad-toolbar">
          <div className="search-box ad-search">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Товар, SKU или кампания"
            />
          </div>

          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="all">Все типы</option>
            <option value="search">Поиск</option>
            <option value="catalog">Каталог</option>
            <option value="recommendation">Рекомендации</option>
          </select>

          <div className="ad-channel-switch">
            {(["all", "wb", "ozon"] as ChannelFilter[]).map((value) => (
              <button
                key={value}
                className={channel === value ? "active" : ""}
                onClick={() => setChannel(value)}
              >
                {value === "all" ? "Все" : value === "wb" ? "WB" : "Ozon"}
              </button>
            ))}
          </div>

          <div className="ad-health-switch">
            {([
              ["all", "Все"],
              ["attention", "Проблемные"],
              ["healthy", "В норме"],
            ] as Array<[HealthFilter, string]>).map(([value, label]) => (
              <button
                key={value}
                className={health === value ? "active" : ""}
                onClick={() => setHealth(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="ad-subtoolbar">
          <span>{filtered.length} кампаний</span>
          <div className="ad-sort">
            <span>Сортировка</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
            >
              <option value="spend">Расход</option>
              <option value="revenue">Выручка</option>
              <option value="drr">ДРР</option>
              <option value="orders">Заказы</option>
              <option value="conversion">Конверсия</option>
            </select>
            <button onClick={() => setDescending((current) => !current)}>
              {descending ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
            </button>
          </div>
        </div>

        <div className="ad-table-wrap">
          <div className="ad-table">
            <div className="ad-row ad-head">
              <span>Товар / кампания</span>
              <span>Канал</span>
              <span>Ставка</span>
              <span>Расход</span>
              <span>Выручка</span>
              <span>Клики</span>
              <span>Заказы</span>
              <span>Конверсия</span>
              <span>ДРР</span>
              <span>Статус</span>
              <span />
            </div>

            {filtered.map((campaign) => {
              const stats = campaignStats.get(campaign.id)!;
              const bad = stats.drr > campaign.targetDrr * 1.05;
              const changed = campaign.currentBid === campaign.recommendedBid;

              return (
                <div
                  className="ad-row ad-data-row"
                  key={campaign.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSelectedId(campaign.id);
                    setMessage(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedId(campaign.id);
                      setMessage(null);
                    }
                  }}
                >
                  <span className="ad-product-cell">
                    <span className="ad-product-thumb">
                      {campaign.product.thumbnailUrl ? (
                        <img
                          src={campaign.product.thumbnailUrl}
                          alt={campaign.product.name}
                        />
                      ) : (
                        <BarChart3 size={18} />
                      )}
                    </span>
                    <span>
                      <strong>{campaign.product.name}</strong>
                      <small>
                        {campaign.product.sku} · {campaignTypeRu(campaign.type)}
                      </small>
                      <MarketplaceLinks
                        sku={campaign.product.sku}
                        wbId={
                          campaign.channel.code === "wb"
                            ? campaign.channel.externalProductId
                            : null
                        }
                        ozonId={
                          campaign.channel.code === "ozon"
                            ? campaign.channel.externalProductId
                            : null
                        }
                        only={campaign.channel.code === "wb" ? "wb" : "ozon"}
                        compact
                      />
                    </span>
                  </span>

                  <span>
                    <i className={`ad-channel ${campaign.channel.code}`}>
                      {campaign.channel.code === "wb" ? "WB" : "Ozon"}
                    </i>
                  </span>

                  <span className="ad-bid-cell">
                    <strong>{rub(campaign.currentBid)}</strong>
                    {!changed && (
                      <small>
                        → {rub(campaign.recommendedBid)}
                      </small>
                    )}
                  </span>
                  <span>{compactRub(stats.spend)}</span>
                  <span>{compactRub(stats.revenue)}</span>
                  <span>{new Intl.NumberFormat("ru-RU").format(stats.clicks)}</span>
                  <span>{new Intl.NumberFormat("ru-RU").format(stats.orders)}</span>
                  <span>{pct(stats.conversion)}</span>
                  <span>
                    <b className={bad ? "bad-metric" : "ok-text"}>
                      {pct(stats.drr)}
                    </b>
                    <small className="ad-target">цель ≤ {pct(campaign.targetDrr)}</small>
                  </span>
                  <span>
                    <i className={bad ? "ad-health bad" : "ad-health good"}>
                      {bad ? "Требует внимания" : "В норме"}
                    </i>
                  </span>
                  <span className="ad-chevron">
                    <ChevronRight size={16} />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {selected && selectedStats && (
        <ModalPortal>
        <div
          className="ad-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedId(null);
          }}
        >
          <section
            className="ad-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ad-modal-title"
          >
            <div className="ad-modal-head">
              <div>
                <span className="eyebrow">
                  <Bot size={14} /> Рекомендация по ставке
                </span>
                <h3 id="ad-modal-title">{selected.product.name}</h3>
                <p>
                  {selected.channel.code === "wb" ? "Wildberries" : "Ozon"} ·{" "}
                  {campaignTypeRu(selected.type)} · {period} дней
                </p>
              </div>
              <button onClick={() => setSelectedId(null)} aria-label="Закрыть">
                <X size={19} />
              </button>
            </div>

            <div className="ad-modal-body">
              <div className="ad-modal-product">
                <div>
                  <strong>{selected.name}</strong>
                  <span>{selected.product.sku}</span>
                </div>
                <MarketplaceLinks
                  sku={selected.product.sku}
                  wbId={
                    selected.channel.code === "wb"
                      ? selected.channel.externalProductId
                      : null
                  }
                  ozonId={
                    selected.channel.code === "ozon"
                      ? selected.channel.externalProductId
                      : null
                  }
                  only={selected.channel.code === "wb" ? "wb" : "ozon"}
                />
              </div>

              <div className="ad-evidence-grid">
                <div>
                  <span>Текущая ставка</span>
                  <strong>{rub(selected.currentBid)}</strong>
                </div>
                <div>
                  <span>Рекомендуемая</span>
                  <strong>{rub(selected.recommendedBid)}</strong>
                </div>
                <div>
                  <span>ДРР</span>
                  <strong className={
                    selectedStats.drr > selected.targetDrr
                      ? "bad-metric"
                      : "ok-text"
                  }>
                    {pct(selectedStats.drr)}
                  </strong>
                </div>
                <div>
                  <span>Целевой ДРР</span>
                  <strong>{pct(selected.targetDrr)}</strong>
                </div>
                <div>
                  <span>Расход</span>
                  <strong>{rub(selectedStats.spend)}</strong>
                </div>
                <div>
                  <span>Выручка</span>
                  <strong>{rub(selectedStats.revenue)}</strong>
                </div>
                <div>
                  <span>Кликабельность</span>
                  <strong>{pct(selectedStats.ctr)}</strong>
                </div>
                <div>
                  <span>Конверсия</span>
                  <strong>{pct(selectedStats.conversion)}</strong>
                </div>
              </div>

              <div className="ad-recommendation-copy">
                <span>Почему система предлагает изменение</span>
                <p>
                  {selected.recommendationReason ??
                    "Текущая ставка сравнивается с ДРР, конверсией и целевой экономикой кампании."}
                </p>
              </div>

              <div className="ad-recommendation-status">
                <span>Статус рекомендации</span>
                <strong>{recommendationStatusRu(selected.recommendationStatus)}</strong>
              </div>

              {message && <div className="ad-message">{message}</div>}
            </div>

            <div className="ad-modal-footer">
              <div>
                Изменение ставки сохраняется в Supabase и журнале действий.
              </div>
              <div className="ad-modal-actions">
                <button
                  className="secondary-button"
                  onClick={() => setSelectedId(null)}
                >
                  Закрыть
                </button>
                <button
                  className="primary-button"
                  disabled={
                    applying ||
                    selected.currentBid === selected.recommendedBid
                  }
                  onClick={() => applyBid(selected)}
                >
                  {selected.currentBid === selected.recommendedBid ? (
                    <>
                      <CheckCircle2 size={15} />
                      Уже применено
                    </>
                  ) : applying ? (
                    <>
                      <RefreshCw size={15} />
                      Применяем…
                    </>
                  ) : (
                    <>
                      <Activity size={15} />
                      Применить {rub(selected.recommendedBid)}
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>
        </div>
        </ModalPortal>
      )}
    </div>
  );
}
