"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  ExternalLink,
  Gauge,
  RefreshCw,
  ShoppingBag,
  Star,
  Target,
  TrendingUp,
} from "lucide-react";

type Metric = {
  date: string;
  orders: number;
  units: number;
  revenue: number;
  refunds: number;
  adSpend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversionRate: number;
  drr: number;
  commission: number;
  logistics: number;
  storage: number;
  costOfGoods: number;
  profit: number;
  margin: number;
  stock: number;
  price: number;
};

type Product360Data = {
  product: {
    id: string;
    sku: string;
    name: string;
    brand: string;
    category: string;
    listPrice: number;
    baseCost: number;
    launchDate: string | null;
    warrantyMonths: number;
    thumbnailUrl: string | null;
  };
  channels: Array<{
    id: string;
    code: string;
    name: string;
    primary: boolean;
    listing: {
      externalProductId: string | null;
      vendorCode: string | null;
      variantId: string | null;
      barcode: string | null;
      status: string;
      price: number;
      stock: number;
      rating: number | null;
      reviews: number;
      metadata: Record<string, unknown>;
    };
    metrics: Metric[];
  }>;
  incidents: Array<{
    id: string;
    channel_id: string | null;
    channelCode: string | null;
    incident_type: string;
    severity: string;
    title: string;
    description: string;
    metric_key: string | null;
    metric_value: number | null;
    threshold_value: number | null;
    status: string;
    detected_at: string;
  }>;
  recommendations: Array<{
    id: string;
    channel_id: string | null;
    channelCode: string | null;
    recommendation_type: string;
    priority: string;
    title: string;
    rationale: string;
    expected_effect: string | null;
    risk: string | null;
    action_payload: Record<string, unknown>;
    status: string;
    created_at: string;
  }>;
  reviews: Array<{
    id: string;
    product_channel_id: string | null;
    channelCode: string | null;
    author: string | null;
    rating: number;
    body: string;
    classification: string | null;
    risk: string | null;
    policy: string | null;
    status: string;
    created_at: string;
  }>;
  competitors: Array<{
    id: string;
    name: string;
    brand: string;
    marketplace: string;
    metrics: Array<{
      date: string;
      price: number;
      rating: number;
      reviews: number;
      units: number;
      position: number;
      promoDiscount: number;
    }>;
  }>;
};

type ChannelFilter = "all" | "wb" | "ozon";
type MetricKey = "revenue" | "profit" | "adSpend" | "units" | "price" | "drr" | "stock";

const metricLabels: Record<MetricKey, string> = {
  revenue: "Выручка",
  profit: "Прибыль",
  adSpend: "Реклама",
  units: "Продажи",
  price: "Цена",
  drr: "ДРР",
  stock: "Остаток",
};

function money(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(value) + " ₽";
}

function compactMoney(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value) + " ₽";
}

function pct(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 1,
  }).format(value) + "%";
}

function aggregateByDate(channels: Product360Data["channels"]) {
  const map = new Map<string, Metric[]>();
  for (const channel of channels) {
    for (const metric of channel.metrics) {
      const list = map.get(metric.date) ?? [];
      list.push(metric);
      map.set(metric.date, list);
    }
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, rows]) => {
      const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
      const profit = rows.reduce((sum, row) => sum + row.profit, 0);
      const adSpend = rows.reduce((sum, row) => sum + row.adSpend, 0);
      const units = rows.reduce((sum, row) => sum + row.units, 0);
      const orders = rows.reduce((sum, row) => sum + row.orders, 0);
      const refunds = rows.reduce((sum, row) => sum + row.refunds, 0);
      const clicks = rows.reduce((sum, row) => sum + row.clicks, 0);
      const impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
      const commission = rows.reduce((sum, row) => sum + row.commission, 0);
      const logistics = rows.reduce((sum, row) => sum + row.logistics, 0);
      const storage = rows.reduce((sum, row) => sum + row.storage, 0);
      const costOfGoods = rows.reduce((sum, row) => sum + row.costOfGoods, 0);
      const stock = rows.reduce((sum, row) => sum + row.stock, 0);
      return {
        date,
        revenue,
        profit,
        adSpend,
        units,
        orders,
        refunds,
        impressions,
        clicks,
        ctr: impressions ? (clicks / impressions) * 100 : 0,
        cpc: clicks ? adSpend / clicks : 0,
        conversionRate: clicks ? (units / clicks) * 100 : 0,
        drr: revenue ? (adSpend / revenue) * 100 : 0,
        commission,
        logistics,
        storage,
        costOfGoods,
        margin: revenue ? (profit / revenue) * 100 : 0,
        stock,
        price: units ? revenue / units : rows.reduce((s, r) => s + r.price, 0) / Math.max(rows.length, 1),
      } satisfies Metric;
    });
}

function sumMetrics(metrics: Metric[]) {
  const revenue = metrics.reduce((sum, row) => sum + row.revenue, 0);
  const profit = metrics.reduce((sum, row) => sum + row.profit, 0);
  const adSpend = metrics.reduce((sum, row) => sum + row.adSpend, 0);
  const units = metrics.reduce((sum, row) => sum + row.units, 0);
  const orders = metrics.reduce((sum, row) => sum + row.orders, 0);
  const refunds = metrics.reduce((sum, row) => sum + row.refunds, 0);
  const commission = metrics.reduce((sum, row) => sum + row.commission, 0);
  const logistics = metrics.reduce((sum, row) => sum + row.logistics, 0);
  const storage = metrics.reduce((sum, row) => sum + row.storage, 0);
  const costOfGoods = metrics.reduce((sum, row) => sum + row.costOfGoods, 0);
  const last = metrics.at(-1);
  return {
    revenue,
    profit,
    adSpend,
    units,
    orders,
    refunds,
    commission,
    logistics,
    storage,
    costOfGoods,
    margin: revenue ? (profit / revenue) * 100 : 0,
    drr: revenue ? (adSpend / revenue) * 100 : 0,
    avgPrice: units ? revenue / units : last?.price ?? 0,
    stock: last?.stock ?? 0,
  };
}

function growth(current: number, previous: number) {
  if (!previous) return 0;
  return ((current - previous) / previous) * 100;
}

function LineChart({
  data,
  metric,
}: {
  data: Metric[];
  metric: MetricKey;
}) {
  const width = 900;
  const height = 250;
  const paddingX = 12;
  const paddingY = 18;

  const values = data.map((row) => Number(row[metric]) || 0);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);

  const points = values
    .map((value, index) => {
      const x =
        paddingX +
        (index / Math.max(values.length - 1, 1)) * (width - paddingX * 2);
      const y =
        paddingY +
        (1 - (value - min) / span) * (height - paddingY * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const fillPoints = `${paddingX},${height - paddingY} ${points} ${width - paddingX},${height - paddingY}`;

  return (
    <div className="p360-chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="p360-chart" role="img">
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1="0"
            x2={width}
            y1={height * ratio}
            y2={height * ratio}
            className="p360-gridline"
          />
        ))}
        <polygon points={fillPoints} className="p360-area" />
        <polyline points={points} className="p360-line" />
      </svg>
      <div className="p360-axis">
        <span>{data[0]?.date ? new Date(data[0].date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : "—"}</span>
        <span>{data.at(-1)?.date ? new Date(data.at(-1)!.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : "—"}</span>
      </div>
    </div>
  );
}

export function Product360({
  sku,
  onBack,
}: {
  sku: string;
  onBack: () => void;
}) {
  const [data, setData] = useState<Product360Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<ChannelFilter>("all");
  const [period, setPeriod] = useState(30);
  const [metric, setMetric] = useState<MetricKey>("revenue");
  const [showRecommendationDetails, setShowRecommendationDetails] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [decisionMessage, setDecisionMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/products/${encodeURIComponent(sku)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sku]);

  const selectedChannels = useMemo(() => {
    if (!data) return [];
    if (channel === "all") return data.channels;
    return data.channels.filter((item) => item.code === channel);
  }, [data, channel]);

  const allDaily = useMemo(
    () => aggregateByDate(selectedChannels),
    [selectedChannels],
  );

  const currentPeriod = useMemo(
    () => allDaily.slice(-period),
    [allDaily, period],
  );

  const previousPeriod = useMemo(
    () => allDaily.slice(-(period * 2), -period),
    [allDaily, period],
  );

  const current = useMemo(() => sumMetrics(currentPeriod), [currentPeriod]);
  const previous = useMemo(() => sumMetrics(previousPeriod), [previousPeriod]);

  const selectedIncident = useMemo(() => {
    if (!data) return undefined;
    const open = data.incidents.filter((item) => item.status === "open");
    if (channel === "all") return open[0];
    return open.find((item) => item.channelCode === channel) ?? open[0];
  }, [data, channel]);

  const selectedRecommendation = useMemo(() => {
    if (!data) return undefined;
    const suggested = data.recommendations.filter(
      (item) => item.status === "suggested",
    );
    if (channel === "all") return suggested[0];
    return (
      suggested.find((item) => item.channelCode === channel) ??
      suggested[0]
    );
  }, [data, channel]);

  const visibleReviews = useMemo(() => {
    if (!data) return [];
    if (channel === "all") return data.reviews;
    return data.reviews.filter((item) => item.channelCode === channel);
  }, [data, channel]);

  useEffect(() => {
    setShowRecommendationDetails(false);
    setShowEvidence(false);
    setDecisionMessage(null);
  }, [channel, sku]);

  async function decideRecommendation(action: "accepted" | "rejected") {
    if (!selectedRecommendation || decisionBusy) return;

    setDecisionBusy(true);
    setDecisionMessage(null);

    try {
      const response = await fetch(
        `/api/recommendations/${selectedRecommendation.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );

      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setDecisionMessage(payload.error ?? "Не удалось сохранить решение.");
        return;
      }

      setData((currentData) =>
        currentData
          ? {
              ...currentData,
              recommendations: currentData.recommendations.map((item) =>
                item.id === selectedRecommendation.id
                  ? { ...item, status: action }
                  : item,
              ),
            }
          : currentData,
      );
      setDecisionMessage(
        action === "accepted"
          ? "Рекомендация принята и записана в журнал действий."
          : "Рекомендация отклонена и записана в журнал действий.",
      );
      setShowRecommendationDetails(false);
      setShowEvidence(false);
    } catch {
      setDecisionMessage("Не удалось сохранить решение.");
    } finally {
      setDecisionBusy(false);
    }
  }

  if (loading || !data) {
    return (
      <div className="p360-skeleton">
        <div className="card p360-skeleton-hero">
          <div className="premium-skeleton p360-skeleton-image" />
          <div className="p360-skeleton-copy">
            <div className="premium-skeleton p360-skeleton-line wide" />
            <div className="premium-skeleton p360-skeleton-line medium" />
            <div className="premium-skeleton p360-skeleton-line short" />
          </div>
          <div className="p360-skeleton-marketplaces">
            <div className="premium-skeleton" />
            <div className="premium-skeleton" />
          </div>
        </div>
        <div className="p360-skeleton-kpis">
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="card p360-skeleton-kpi" key={index}>
              <div className="premium-skeleton small" />
              <div className="premium-skeleton large" />
              <div className="premium-skeleton tiny" />
            </div>
          ))}
        </div>
        <div className="p360-skeleton-main">
          <div className="card premium-skeleton" />
          <div className="card premium-skeleton" />
        </div>
      </div>
    );
  }

  const mainIncident = selectedIncident;
  const recommendation = selectedRecommendation;
  const wb = data.channels.find((item) => item.code === "wb");
  const ozon = data.channels.find((item) => item.code === "ozon");

  return (
    <div className="p360">
      <div className="p360-top">
        <button className="p360-back" onClick={onBack}>
          <ArrowLeft size={17} />
          Каталог
        </button>

        <div className="p360-channel-switch">
          {(["all", "wb", "ozon"] as ChannelFilter[]).map((item) => (
            <button
              key={item}
              className={channel === item ? "active" : ""}
              onClick={() => setChannel(item)}
            >
              {item === "all" ? "Все каналы" : item === "wb" ? "Wildberries" : "Ozon"}
            </button>
          ))}
        </div>
      </div>

      <header className="p360-header">
        <div className="p360-product-avatar">
          {data.product.thumbnailUrl ? (
            <img
              src={data.product.thumbnailUrl}
              alt={data.product.name}
            />
          ) : (
            <ShoppingBag size={30} />
          )}
        </div>
        <div className="p360-title">
          <div className="p360-kicker">
            {data.product.category} · {data.product.brand}
          </div>
          <h2>{data.product.name}</h2>
          <div className="p360-meta">
            <span>{data.product.sku}</span>
            <span>Себестоимость {money(data.product.baseCost)}</span>
            <span>Гарантия {data.product.warrantyMonths} мес.</span>
          </div>
        </div>
        <div className="p360-listings">
          {wb && (
            <div className="listing-badge wb">
              <div className="listing-badge-head">
                <strong>Wildberries</strong>
                <span>{wb.listing.status}</span>
              </div>
              <div className="listing-badge-stats">
                <div>
                  <small>Цена</small>
                  <b>{money(wb.listing.price)}</b>
                </div>
                <div>
                  <small>Остаток</small>
                  <b>{wb.listing.stock}</b>
                </div>
                <div>
                  <small>Рейтинг</small>
                  <b>{wb.listing.rating?.toFixed(2) ?? "—"}</b>
                </div>
              </div>
              {wb.listing.externalProductId && (
                <small className="listing-external-id">nmID {wb.listing.externalProductId}</small>
              )}
            </div>
          )}
          {ozon && (
            <div className="listing-badge ozon">
              <div className="listing-badge-head">
                <strong>Ozon</strong>
                <span>{ozon.listing.status}</span>
              </div>
              <div className="listing-badge-stats">
                <div>
                  <small>Цена</small>
                  <b>{money(ozon.listing.price)}</b>
                </div>
                <div>
                  <small>Остаток</small>
                  <b>{ozon.listing.stock}</b>
                </div>
                <div>
                  <small>Рейтинг</small>
                  <b>{ozon.listing.rating?.toFixed(2) ?? "—"}</b>
                </div>
              </div>
              {ozon.listing.externalProductId && (
                <small className="listing-external-id">{ozon.listing.externalProductId}</small>
              )}
            </div>
          )}
        </div>
      </header>

      {mainIncident && (
        <div className={`p360-alert ${mainIncident.severity}`}>
          <AlertTriangle size={18} />
          <div>
            <strong>{mainIncident.title}</strong>
            <span>{mainIncident.description}</span>
          </div>
          <span className="p360-alert-severity">{mainIncident.severity}</span>
        </div>
      )}

      <section className="p360-kpis">
        <Kpi
          label="Выручка"
          value={compactMoney(current.revenue)}
          delta={growth(current.revenue, previous.revenue)}
          icon={<TrendingUp size={16} />}
        />
        <Kpi
          label="Прибыль"
          value={compactMoney(current.profit)}
          delta={growth(current.profit, previous.profit)}
          icon={<CircleDollarSign size={16} />}
        />
        <Kpi
          label="Маржа"
          value={pct(current.margin)}
          delta={current.margin - previous.margin}
          suffix="п.п."
          icon={<Target size={16} />}
        />
        <Kpi
          label="ДРР"
          value={pct(current.drr)}
          delta={current.drr - previous.drr}
          inverse
          suffix="п.п."
          icon={<Gauge size={16} />}
        />
        <Kpi
          label="Продано"
          value={new Intl.NumberFormat("ru-RU").format(current.units)}
          delta={growth(current.units, previous.units)}
          icon={<BarChart3 size={16} />}
        />
        <Kpi
          label="Остаток"
          value={new Intl.NumberFormat("ru-RU").format(current.stock)}
          delta={0}
          icon={<Boxes size={16} />}
        />
      </section>

      <section className="p360-grid-main">
        <article className="card p360-chart-card">
          <div className="p360-card-head">
            <div>
              <span className="eyebrow">Динамика</span>
              <h3>{metricLabels[metric]}</h3>
            </div>
            <div className="p360-periods">
              {[7, 30, 90, 365].map((days) => (
                <button
                  key={days}
                  className={period === days ? "active" : ""}
                  onClick={() => setPeriod(days)}
                >
                  {days === 365 ? "1 год" : `${days}д`}
                </button>
              ))}
            </div>
          </div>

          <div className="p360-metric-tabs">
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

          <LineChart data={currentPeriod} metric={metric} />
        </article>

        <article className="card p360-ai-card">
          <div className="p360-card-head">
            <div>
              <span className="eyebrow">
                <Bot size={14} /> AI-рекомендация
              </span>
              <h3>{recommendation?.title ?? "Нет активных рекомендаций"}</h3>
            </div>
            {recommendation && (
              <span className={`priority-chip ${recommendation.priority}`}>
                {recommendation.priority}
              </span>
            )}
          </div>

          {recommendation ? (
            <>
              <p className="p360-ai-rationale">{recommendation.rationale}</p>
              <div className="p360-ai-box">
                <span>Ожидаемый эффект</span>
                <strong>{recommendation.expected_effect ?? "—"}</strong>
              </div>
              <div className="p360-ai-risk">
                <span>Риск</span>
                <p>{recommendation.risk ?? "Требуется подтверждение менеджера."}</p>
              </div>
              <button
                className="primary-button p360-ai-action"
                onClick={() =>
                  setShowRecommendationDetails((current) => !current)
                }
              >
                {showRecommendationDetails ? "Скрыть разбор" : "Разобрать рекомендацию"}
                <ExternalLink size={15} />
              </button>
              <button
                className="secondary-button p360-evidence"
                onClick={() => setShowEvidence((current) => !current)}
              >
                {showEvidence ? "Скрыть данные-основания" : "Показать данные-основания"}
              </button>

              {showRecommendationDetails && (
                <div className="p360-recommendation-detail">
                  <div>
                    <span>Почему это действие</span>
                    <p>
                      {recommendation.rationale} Система сравнивает текущий
                      показатель с порогом и динамикой выбранного канала.
                    </p>
                  </div>
                  <div className="p360-recommendation-actions">
                    <button
                      className="primary-button"
                      onClick={() => decideRecommendation("accepted")}
                      disabled={decisionBusy}
                    >
                      <CheckCircle2 size={15} />
                      Принять
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() => decideRecommendation("rejected")}
                      disabled={decisionBusy}
                    >
                      Отклонить
                    </button>
                  </div>
                </div>
              )}

              {showEvidence && (
                <div className="p360-evidence-panel">
                  <div className="p360-evidence-row">
                    <span>Метрика</span>
                    <strong>
                      {String(recommendation.action_payload?.metric ?? "—")}
                    </strong>
                  </div>
                  <div className="p360-evidence-row">
                    <span>Текущее значение</span>
                    <strong>
                      {recommendation.action_payload?.current !== undefined
                        ? String(recommendation.action_payload.current)
                        : "—"}
                    </strong>
                  </div>
                  <div className="p360-evidence-row">
                    <span>Порог</span>
                    <strong>
                      {recommendation.action_payload?.threshold !== undefined
                        ? String(recommendation.action_payload.threshold)
                        : "—"}
                    </strong>
                  </div>
                  <div className="p360-evidence-row">
                    <span>Выручка · период</span>
                    <strong>{compactMoney(current.revenue)}</strong>
                  </div>
                  <div className="p360-evidence-row">
                    <span>Маржа</span>
                    <strong>{pct(current.margin)}</strong>
                  </div>
                  <div className="p360-evidence-row">
                    <span>ДРР</span>
                    <strong>{pct(current.drr)}</strong>
                  </div>
                </div>
              )}

              {decisionMessage && (
                <div className="p360-decision-message">{decisionMessage}</div>
              )}
            </>
          ) : (
            <div className="p360-empty">
              <CheckCircle2 size={24} />
              <span>Критичных действий сейчас нет.</span>
            </div>
          )}
        </article>
      </section>

      <section className="p360-channel-cards">
        {data.channels.map((item) => {
          const rows = item.metrics.slice(-period);
          const summary = sumMetrics(rows);
          return (
            <article className="card channel-performance" key={item.code}>
              <div className="channel-performance-head">
                <div className={`channel-logo ${item.code}`}>
                  {item.code === "wb" ? "WB" : "OZ"}
                </div>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.listing.status}</span>
                </div>
                <div className="channel-rating">
                  <Star size={14} />
                  {item.listing.rating?.toFixed(2) ?? "—"}
                </div>
              </div>
              <div className="channel-performance-grid">
                <div><span>Выручка</span><strong>{compactMoney(summary.revenue)}</strong></div>
                <div><span>Маржа</span><strong>{pct(summary.margin)}</strong></div>
                <div><span>ДРР</span><strong>{pct(summary.drr)}</strong></div>
                <div><span>Остаток</span><strong>{item.listing.stock}</strong></div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="p360-lower-grid">
        <article className="card p360-economics">
          <div className="p360-card-head">
            <div>
              <span className="eyebrow">Unit economics</span>
              <h3>Разложение прибыли · {period === 365 ? "1 год" : `${period} дней`}</h3>
            </div>
          </div>
          <EconomicsWaterfall current={current} />
        </article>

        <article className="card p360-competitors">
          <div className="p360-card-head">
            <div>
              <span className="eyebrow">Конкуренты</span>
              <h3>Цены и позиция</h3>
            </div>
          </div>
          <div className="competitor-list">
            {data.competitors.map((competitor) => {
              const latest = competitor.metrics.at(-1);
              const monthAgo = competitor.metrics.at(-31);
              const priceGrowth = latest && monthAgo ? growth(latest.price, monthAgo.price) : 0;
              return (
                <div className="competitor-row" key={competitor.id}>
                  <div>
                    <strong>{competitor.name}</strong>
                    <span>{competitor.brand}</span>
                  </div>
                  <div>
                    <span>Цена</span>
                    <strong>{latest ? money(latest.price) : "—"}</strong>
                  </div>
                  <div>
                    <span>30д</span>
                    <strong className={priceGrowth < 0 ? "negative" : "positive"}>
                      {priceGrowth > 0 ? "+" : ""}{priceGrowth.toFixed(1)}%
                    </strong>
                  </div>
                  <div>
                    <span>Позиция</span>
                    <strong>#{latest?.position ?? "—"}</strong>
                  </div>
                  <div>
                    <span>Рейтинг</span>
                    <strong>{latest?.rating.toFixed(2) ?? "—"}</strong>
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section className="card p360-reviews">
        <div className="p360-card-head">
          <div>
            <span className="eyebrow">Отзывы</span>
            <h3>Последняя обратная связь</h3>
          </div>
          <span className="count-chip">{visibleReviews.length}</span>
        </div>
        <div className="p360-review-grid">
          {visibleReviews.slice(0, 6).map((review) => (
            <article key={review.id} className="p360-review">
              <div className="p360-review-head">
                <strong>{review.author ?? "Покупатель"}</strong>
                <span>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
              </div>
              <p>{review.body}</p>
              <div>
                <span>
                  {review.channelCode === "wb"
                    ? "WB"
                    : review.channelCode === "ozon"
                      ? "Ozon"
                      : "Все"} · {review.classification ?? "Общий отзыв"}
                </span>
                <small>{new Date(review.created_at).toLocaleDateString("ru-RU")}</small>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  delta,
  icon,
  inverse = false,
  suffix = "%",
}: {
  label: string;
  value: string;
  delta: number;
  icon: React.ReactNode;
  inverse?: boolean;
  suffix?: string;
}) {
  const positive = inverse ? delta < 0 : delta > 0;
  const negative = inverse ? delta > 0 : delta < 0;
  return (
    <article className="card p360-kpi">
      <div className="p360-kpi-label">
        <span>{label}</span>
        <i>{icon}</i>
      </div>
      <strong>{value}</strong>
      {delta !== 0 ? (
        <div className={positive ? "p360-delta positive" : negative ? "p360-delta negative" : "p360-delta"}>
          {delta > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {delta > 0 ? "+" : ""}{delta.toFixed(1)}{suffix}
        </div>
      ) : (
        <div className="p360-delta neutral">текущий уровень</div>
      )}
    </article>
  );
}

function EconomicsWaterfall({
  current,
}: {
  current: ReturnType<typeof sumMetrics>;
}) {
  const rows = [
    { label: "Выручка", value: current.revenue, positive: true },
    { label: "Комиссия", value: -current.commission },
    { label: "Логистика", value: -current.logistics },
    { label: "Хранение", value: -current.storage },
    { label: "Реклама", value: -current.adSpend },
    { label: "Себестоимость", value: -current.costOfGoods },
    { label: "Прибыль", value: current.profit, positive: current.profit >= 0 },
  ];
  const max = Math.max(...rows.map((row) => Math.abs(row.value)), 1);

  return (
    <div className="economics-waterfall">
      {rows.map((row) => (
        <div className="economics-row" key={row.label}>
          <span>{row.label}</span>
          <div className="economics-track">
            <i
              className={row.value >= 0 ? "positive" : "negative"}
              style={{ width: `${Math.max(4, (Math.abs(row.value) / max) * 100)}%` }}
            />
          </div>
          <strong className={row.value < 0 ? "negative" : ""}>
            {row.value < 0 ? "−" : ""}{compactMoney(Math.abs(row.value))}
          </strong>
        </div>
      ))}
    </div>
  );
}
