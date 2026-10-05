"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock3,
  MessageSquareText,
  RefreshCw,
  Search,
  Send,
  Star,
  X,
} from "lucide-react";
import { MarketplaceLinks } from "@/components/marketplace-links";
import { ModalPortal } from "@/components/modal-portal";
import { reviewStatusRu } from "@/lib/ui-ru";

type Review = {
  id: string;
  externalId: string | null;
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
  author: string | null;
  rating: number;
  body: string;
  classification: string | null;
  risk: string | null;
  draft: string | null;
  answer: string | null;
  policy: string | null;
  status: string;
  createdAt: string;
  answeredAt: string | null;
};

type ChannelFilter = "all" | "wb" | "ozon";
type StatusFilter = "all" | "waiting" | "answered";
type RatingFilter = "all" | "negative" | "neutral" | "positive";
type SortKey = "newest" | "rating" | "risk" | "status";
type TrendMetric = "count" | "rating" | "negative" | "processed";

const trendLabels: Record<TrendMetric, string> = {
  count: "Количество отзывов",
  rating: "Средний рейтинг",
  negative: "Доля негатива",
  processed: "Доля обработанных",
};

function pct(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 1,
  }).format(value) + "%";
}

function formatHours(value: number) {
  if (!Number.isFinite(value)) return "—";
  if (value < 1) return Math.max(1, Math.round(value * 60)) + " мин.";
  if (value < 24) return value.toFixed(value < 10 ? 1 : 0) + " ч.";
  return (value / 24).toFixed(1) + " дн.";
}

function riskRank(value: string | null) {
  if (value === "Высокий") return 3;
  if (value === "Средний") return 2;
  if (value === "Низкий") return 1;
  return 0;
}

function riskTone(value: string | null) {
  if (value === "Высокий") return "high";
  if (value === "Средний") return "medium";
  return "low";
}

function buildTrend(reviews: Review[], period: number) {
  const days = new Map<
    string,
    { count: number; ratingSum: number; negative: number; answered: number }
  >();

  const now = new Date();
  for (let offset = period - 1; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - offset);
    const key = date.toISOString().slice(0, 10);
    days.set(key, { count: 0, ratingSum: 0, negative: 0, answered: 0 });
  }

  for (const review of reviews) {
    const key = review.createdAt.slice(0, 10);
    const row = days.get(key);
    if (!row) continue;
    row.count += 1;
    row.ratingSum += review.rating;
    if (review.rating <= 2) row.negative += 1;
    if (review.status === "answered") row.answered += 1;
  }

  return [...days.entries()].map(([date, row]) => ({
    date,
    count: row.count,
    rating: row.count ? row.ratingSum / row.count : 0,
    negative: row.count ? (row.negative / row.count) * 100 : 0,
    processed: row.count ? (row.answered / row.count) * 100 : 0,
  }));
}

function ReviewTrendChart({
  data,
  metric,
}: {
  data: ReturnType<typeof buildTrend>;
  metric: TrendMetric;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const width = 900;
  const height = 250;
  const paddingX = 16;
  const paddingY = 20;
  const values = data.map((row) => Number(row[metric]) || 0);
  const max = Math.max(...values, metric === "rating" ? 5 : 1);
  const min = metric === "rating" ? Math.min(...values.filter(Boolean), 3.5) : 0;
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

  function formatValue(value: number) {
    if (metric === "rating") return value.toFixed(2);
    if (metric === "negative" || metric === "processed") return pct(value);
    return new Intl.NumberFormat("ru-RU").format(Math.round(value));
  }

  return (
    <div className="reviews-chart-wrap">
      <div className="reviews-chart-stage">
        <svg
          className="reviews-chart"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          onMouseLeave={() => setHovered(null)}
          onMouseMove={(event) => {
            if (!data.length) return;
            const rect = event.currentTarget.getBoundingClientRect();
            const localX = event.clientX - rect.left;
            const ratio = Math.max(
              0,
              Math.min(1, localX / Math.max(rect.width, 1)),
            );
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
              className="reviews-gridline"
            />
          ))}
          <polygon points={fill} className="reviews-area" />
          <polyline points={polyline} className="reviews-line" />

          {hoverPoint && (
            <>
              <line
                x1={hoverPoint.x}
                x2={hoverPoint.x}
                y1={paddingY}
                y2={height - paddingY}
                className="reviews-hover-line"
              />
              <circle
                cx={hoverPoint.x}
                cy={hoverPoint.y}
                r="5"
                className="reviews-hover-dot"
              />
            </>
          )}
        </svg>

        {hoverPoint && hoverRow && (
          <div
            className="reviews-chart-tooltip"
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
            <strong>{formatValue(hoverPoint.value)}</strong>
          </div>
        )}
      </div>

      <div className="reviews-chart-axis">
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

export function ReviewsCenter({
  onQueueChange,
}: {
  onQueueChange?: (count: number) => void;
}) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState<ChannelFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [rating, setRating] = useState<RatingFilter>("all");
  const [risk, setRisk] = useState("all");
  const [period, setPeriod] = useState(30);
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("count");
  const [sort, setSort] = useState<SortKey>("newest");
  const [descending, setDescending] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/reviews", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setReviews(payload.reviews ?? []))
      .finally(() => setLoading(false));
  }, []);

  const periodReviews = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - period);
    return reviews.filter((review) => {
      if (new Date(review.createdAt) < cutoff) return false;
      if (channel !== "all" && review.channel.code !== channel) return false;
      return true;
    });
  }, [reviews, period, channel]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    const list = periodReviews.filter((review) => {
      if (
        query &&
        !review.product.name.toLowerCase().includes(query) &&
        !review.product.sku.toLowerCase().includes(query) &&
        !review.body.toLowerCase().includes(query) &&
        !(review.author ?? "").toLowerCase().includes(query)
      ) {
        return false;
      }

      if (status === "waiting" && review.status === "answered") return false;
      if (status === "answered" && review.status !== "answered") return false;

      if (rating === "negative" && review.rating > 2) return false;
      if (rating === "neutral" && review.rating !== 3) return false;
      if (rating === "positive" && review.rating < 4) return false;

      if (risk !== "all" && review.risk !== risk) return false;
      return true;
    });

    const getter = (review: Review) => {
      if (sort === "rating") return review.rating;
      if (sort === "risk") return riskRank(review.risk);
      if (sort === "status") return review.status === "answered" ? 0 : 1;
      return new Date(review.createdAt).getTime();
    };

    return [...list].sort((a, b) =>
      descending ? getter(b) - getter(a) : getter(a) - getter(b),
    );
  }, [periodReviews, search, status, rating, risk, sort, descending]);

  useEffect(() => {
    setPage(1);
  }, [search, channel, status, rating, risk, sort, descending, pageSize, period]);

  const totals = useMemo(() => {
    const total = periodReviews.length;
    const ratingSum = periodReviews.reduce((sum, row) => sum + row.rating, 0);
    const negative = periodReviews.filter((row) => row.rating <= 2).length;
    const answered = periodReviews.filter((row) => row.status === "answered");
    const waiting = total - answered.length;

    const responseHours = answered
      .filter((row) => row.answeredAt)
      .map(
        (row) =>
          (new Date(row.answeredAt!).getTime() -
            new Date(row.createdAt).getTime()) /
          3_600_000,
      )
      .filter((value) => value >= 0);

    return {
      total,
      avgRating: total ? ratingSum / total : 0,
      negativeShare: total ? (negative / total) * 100 : 0,
      answeredShare: total ? (answered.length / total) * 100 : 0,
      waiting,
      avgResponse:
        responseHours.length > 0
          ? responseHours.reduce((sum, value) => sum + value, 0) /
            responseHours.length
          : 0,
    };
  }, [periodReviews]);

  const trend = useMemo(
    () => buildTrend(periodReviews, period),
    [periodReviews, period],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paginated = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  const selected = reviews.find((review) => review.id === selectedId) ?? null;

  useEffect(() => {
    onQueueChange?.(
      reviews.filter((review) => review.status !== "answered").length,
    );
  }, [reviews, onQueueChange]);

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

  function openReview(review: Review) {
    setSelectedId(review.id);
    setAnswer(review.answer ?? review.draft ?? "");
    setMessage(null);
  }

  async function refreshAiDraft() {
    if (!selected || aiBusy) return;

    setAiBusy(true);
    setMessage(null);

    try {
      const response = await fetch("/api/ai/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: selected.product.name,
          author: selected.author,
          rating: selected.rating,
          text: selected.body,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.data) {
        setMessage("Не удалось обновить черновик ИИ.");
        return;
      }

      setAnswer(payload.data.draft ?? "");
      setReviews((current) =>
        current.map((review) =>
          review.id === selected.id
            ? {
                ...review,
                draft: payload.data.draft ?? review.draft,
                classification:
                  payload.data.classification ?? review.classification,
                risk: payload.data.risk ?? review.risk,
                policy: payload.data.policy ?? review.policy,
              }
            : review,
        ),
      );
      setMessage("Черновик ИИ обновлён. Проверьте его перед отправкой.");
    } catch {
      setMessage("Не удалось обновить черновик ИИ.");
    } finally {
      setAiBusy(false);
    }
  }

  async function sendAnswer() {
    if (!selected || busy || !answer.trim()) return;

    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch("/api/actions/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId: selected.id,
          product: selected.product.name,
          answerText: answer.trim(),
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setMessage(payload.error ?? "Не удалось отправить ответ.");
        return;
      }

      const answeredAt = new Date().toISOString();
      setReviews((current) =>
        current.map((review) =>
          review.id === selected.id
            ? {
                ...review,
                status: "answered",
                answer: answer.trim(),
                answeredAt,
              }
            : review,
        ),
      );
      setMessage("Ответ отправлен и сохранён в истории.");
    } catch {
      setMessage("Не удалось отправить ответ.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="reviews-loading card">
        <RefreshCw size={24} />
        <strong>Загружаем отзывы…</strong>
        <span>Очередь, история обработки и ИИ-черновики</span>
      </div>
    );
  }

  return (
    <div className="reviews-page">
      <section className="reviews-kpis">
        <article className="card reviews-kpi">
          <span>Отзывы · {period}д</span>
          <strong>{totals.total}</strong>
          <small>
            {channel === "all"
              ? "все каналы"
              : channel === "wb"
                ? "Wildberries"
                : "Ozon"}
          </small>
        </article>
        <article className="card reviews-kpi">
          <span>Средний рейтинг</span>
          <strong className="reviews-rating-value">
            {totals.avgRating.toFixed(2)}
            <Star size={16} />
          </strong>
          <small>по выбранному периоду</small>
        </article>
        <article className="card reviews-kpi">
          <span>Негативные</span>
          <strong className={totals.negativeShare > 15 ? "bad-metric" : ""}>
            {pct(totals.negativeShare)}
          </strong>
          <small>оценки 1–2</small>
        </article>
        <article className="card reviews-kpi attention">
          <span>Требуют ответа</span>
          <strong>{totals.waiting}</strong>
          <small>новые + в обработке</small>
        </article>
        <article className="card reviews-kpi">
          <span>Обработано</span>
          <strong>{pct(totals.answeredShare)}</strong>
          <small>среднее время {formatHours(totals.avgResponse)}</small>
        </article>
      </section>

      <section className="card reviews-overview">
        <div className="reviews-overview-head">
          <div>
            <span className="eyebrow">Динамика обратной связи</span>
            <h2>{trendLabels[trendMetric]}</h2>
          </div>

          <div className="reviews-periods">
            {[7, 30, 90, 365].map((days) => (
              <button
                key={days}
                className={period === days ? "active" : ""}
                onClick={() => setPeriod(days)}
              >
                {days === 365 ? "1 год" : `${days} дней`}
              </button>
            ))}
          </div>
        </div>

        <div className="reviews-metric-tabs">
          {(Object.keys(trendLabels) as TrendMetric[]).map((key) => (
            <button
              key={key}
              className={trendMetric === key ? "active" : ""}
              onClick={() => setTrendMetric(key)}
            >
              {trendLabels[key]}
            </button>
          ))}
        </div>

        <ReviewTrendChart data={trend} metric={trendMetric} />
      </section>

      <section className="card reviews-list-card">
        <div className="reviews-toolbar">
          <div className="search-box reviews-search">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Товар, SKU, покупатель или текст отзыва"
            />
          </div>

          <div className="reviews-channel-switch">
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

          <div className="reviews-status-switch">
            {([
              ["all", "Все"],
              ["waiting", "Требуют ответа"],
              ["answered", "Обработаны"],
            ] as Array<[StatusFilter, string]>).map(([value, label]) => (
              <button
                key={value}
                className={status === value ? "active" : ""}
                onClick={() => setStatus(value)}
              >
                {label}
              </button>
            ))}
          </div>

          <select
            value={rating}
            onChange={(event) =>
              setRating(event.target.value as RatingFilter)
            }
          >
            <option value="all">Все оценки</option>
            <option value="negative">1–2 звезды</option>
            <option value="neutral">3 звезды</option>
            <option value="positive">4–5 звёзд</option>
          </select>

          <select value={risk} onChange={(event) => setRisk(event.target.value)}>
            <option value="all">Все риски</option>
            <option value="Средний">Средний риск</option>
            <option value="Низкий">Низкий риск</option>
          </select>
        </div>

        <div className="reviews-subtoolbar">
          <span>{filtered.length} отзывов</span>
          <div className="reviews-sort">
            <span>Сортировка</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
            >
              <option value="newest">По дате</option>
              <option value="rating">По оценке</option>
              <option value="risk">По риску</option>
              <option value="status">По статусу</option>
            </select>
            <button onClick={() => setDescending((current) => !current)}>
              {descending ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
            </button>
          </div>
        </div>

        <div className="reviews-table-wrap">
          <div className="reviews-table">
            <div className="reviews-row reviews-head">
              <span>Товар</span>
              <span>Канал</span>
              <span>Оценка</span>
              <span>Отзыв</span>
              <span>Классификация</span>
              <span>Риск</span>
              <span>Статус</span>
              <span>Дата</span>
              <span />
            </div>

            {paginated.map((review) => (
              <div
                className="reviews-row reviews-data-row"
                key={review.id}
                role="button"
                tabIndex={0}
                onClick={() => openReview(review)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openReview(review);
                  }
                }}
              >
                <div className="reviews-product-cell">
                  <span className="reviews-product-thumb">
                    {review.product.thumbnailUrl ? (
                      <img
                        src={review.product.thumbnailUrl}
                        alt={review.product.name}
                      />
                    ) : (
                      <MessageSquareText size={18} />
                    )}
                  </span>
                  <span>
                    <strong>{review.product.name}</strong>
                    <small>{review.product.sku}</small>
                    <MarketplaceLinks
                      sku={review.product.sku}
                      wbId={
                        review.channel.code === "wb"
                          ? review.channel.externalProductId
                          : null
                      }
                      ozonId={
                        review.channel.code === "ozon"
                          ? review.channel.externalProductId
                          : null
                      }
                      compact
                    />
                  </span>
                </div>

                <span>
                  <i className={`reviews-channel ${review.channel.code}`}>
                    {review.channel.code === "wb" ? "WB" : "Ozon"}
                  </i>
                </span>

                <span className="reviews-stars">
                  <strong>{review.rating.toFixed(1)}</strong>
                  <Star size={13} />
                </span>

                <span className="reviews-body-cell">
                  <strong>{review.author ?? "Покупатель"}</strong>
                  <small>{review.body}</small>
                </span>

                <span className="reviews-classification">
                  {review.classification ?? "Общий отзыв"}
                </span>

                <span>
                  <i className={`reviews-risk ${riskTone(review.risk)}`}>
                    {review.risk ?? "Низкий"}
                  </i>
                </span>

                <span>
                  <i
                    className={
                      review.status === "answered"
                        ? "reviews-status answered"
                        : review.status === "new"
                          ? "reviews-status new"
                          : "reviews-status pending"
                    }
                  >
                    {reviewStatusRu(review.status)}
                  </i>
                </span>

                <span className="reviews-date">
                  {new Date(review.createdAt).toLocaleDateString("ru-RU", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "2-digit",
                  })}
                </span>

                <span className="reviews-chevron">
                  <ChevronRight size={16} />
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="reviews-pagination">
          <div className="reviews-page-size">
            <span>Показывать</span>
            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
            >
              {[20, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span>
              {filtered.length === 0
                ? "0 отзывов"
                : `${(safePage - 1) * pageSize + 1}–${Math.min(
                    safePage * pageSize,
                    filtered.length,
                  )} из ${filtered.length}`}
            </span>
          </div>

          <div className="reviews-page-controls">
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
      </section>

      {selected && (
        <ModalPortal>
          <div
            className="reviews-modal-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setSelectedId(null);
            }}
          >
            <section
              className="reviews-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="reviews-modal-title"
            >
              <div className="reviews-modal-head">
                <div>
                  <span className="eyebrow">
                    <MessageSquareText size={14} /> Работа с отзывом
                  </span>
                  <h3 id="reviews-modal-title">{selected.product.name}</h3>
                  <p>
                    {selected.channel.code === "wb" ? "Wildberries" : "Ozon"} ·{" "}
                    {reviewStatusRu(selected.status)}
                  </p>
                </div>
                <button onClick={() => setSelectedId(null)} aria-label="Закрыть">
                  <X size={19} />
                </button>
              </div>

              <div className="reviews-modal-body">
                <div className="reviews-modal-product">
                  <div>
                    <strong>{selected.product.name}</strong>
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
                  />
                </div>

                <div className="reviews-modal-review">
                  <div className="reviews-modal-review-head">
                    <div>
                      <strong>{selected.author ?? "Покупатель"}</strong>
                      <small>
                        {new Date(selected.createdAt).toLocaleString("ru-RU")}
                      </small>
                    </div>
                    <div className="reviews-modal-stars">
                      <strong>{selected.rating.toFixed(1)}</strong>
                      <Star size={15} />
                    </div>
                  </div>
                  <p>{selected.body}</p>

                  <div className="reviews-modal-tags">
                    <span>{selected.classification ?? "Общий отзыв"}</span>
                    <span className={`risk ${riskTone(selected.risk)}`}>
                      Риск: {selected.risk ?? "Низкий"}
                    </span>
                  </div>
                </div>

                <div className="reviews-response-meta">
                  <div>
                    <span>Статус</span>
                    <strong>{reviewStatusRu(selected.status)}</strong>
                  </div>
                  <div>
                    <span>Политика ответа</span>
                    <strong>{selected.policy ?? "Требуется проверка оператора"}</strong>
                  </div>
                  <div>
                    <span>Время обработки</span>
                    <strong>
                      {selected.answeredAt
                        ? formatHours(
                            (new Date(selected.answeredAt).getTime() -
                              new Date(selected.createdAt).getTime()) /
                              3_600_000,
                          )
                        : "В очереди"}
                    </strong>
                  </div>
                </div>

                <label className="reviews-answer-editor">
                  <div>
                    <span>
                      {selected.status === "answered"
                        ? "Отправленный ответ"
                        : "Ответ покупателю"}
                    </span>
                    {selected.status !== "answered" && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={refreshAiDraft}
                        disabled={aiBusy}
                      >
                        <Bot size={13} />
                        {aiBusy ? "Генерируем…" : "Обновить черновик ИИ"}
                      </button>
                    )}
                  </div>

                  <textarea
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    readOnly={selected.status === "answered"}
                    placeholder="Напишите ответ покупателю…"
                  />
                </label>

                {selected.status !== "answered" && selected.draft && (
                  <div className="reviews-ai-note">
                    <Bot size={15} />
                    <span>
                      Ответ заполнен черновиком ИИ. Перед отправкой его можно и
                      нужно проверить и отредактировать.
                    </span>
                  </div>
                )}

                {message && <div className="reviews-message">{message}</div>}
              </div>

              <div className="reviews-modal-footer">
                <div>
                  Ответ сохраняется в истории обработки и журнале действий.
                </div>
                <div className="reviews-modal-actions">
                  <button
                    className="secondary-button"
                    onClick={() => setSelectedId(null)}
                  >
                    Закрыть
                  </button>
                  {selected.status !== "answered" && (
                    <button
                      className="primary-button"
                      onClick={sendAnswer}
                      disabled={busy || !answer.trim()}
                    >
                      {busy ? (
                        <>
                          <RefreshCw size={15} /> Отправляем…
                        </>
                      ) : (
                        <>
                          <Send size={15} /> Отправить ответ
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </section>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
