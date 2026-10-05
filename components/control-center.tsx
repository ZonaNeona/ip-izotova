"use client";

import { useEffect, useMemo, useState } from "react";
import { ProductCardStudio } from "@/components/product-card-studio";
import { IntegrationsPanel } from "@/components/integrations-panel";
import { ProductCatalog } from "@/components/product-catalog";
import { MarketplaceLinks } from "@/components/marketplace-links";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Bot,
  Boxes,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Gauge,
  HelpCircle,
  ImagePlus,
  LayoutDashboard,
  Link2,
  MessageSquareText,
  PackageCheck,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Tag,
  Truck,
  WandSparkles,
  X,
} from "lucide-react";
import {
  attentionItems,
  auditSeed,
  campaignsSeed,
  economicsRows,
  inventorySeed,
  kpis,
  reconciliationRows,
  reviewsSeed,
  type AuditEvent,
  type Campaign,
} from "@/lib/demo-data";

type Section =
  | "overview"
  | "products"
  | "advertising"
  | "reviews"
  | "cards"
  | "inventory"
  | "economics"
  | "reconciliation"
  | "audit"
  | "integrations";

const menu: Array<{
  id: Section;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  badge?: string;
}> = [
  { id: "overview", label: "Обзор", icon: LayoutDashboard },
  { id: "products", label: "Товары", icon: PackageCheck, badge: "100" },
  { id: "advertising", label: "Реклама и ставки", icon: Gauge, badge: "3" },
  { id: "reviews", label: "Отзывы и вопросы", icon: MessageSquareText, badge: "3" },
  { id: "cards", label: "Карточки товаров", icon: ImagePlus },
  { id: "inventory", label: "Остатки и поставки", icon: Boxes, badge: "4" },
  { id: "economics", label: "Юнит-экономика", icon: CircleDollarSign },
  { id: "reconciliation", label: "Сверка данных", icon: ShieldCheck, badge: "2" },
  { id: "audit", label: "Журнал действий", icon: FileText },
  { id: "integrations", label: "Интеграции", icon: Link2 },
];

const sectionTitles: Record<Section, { title: string; subtitle: string }> = {
  overview: {
    title: "Центр управления",
    subtitle: "Что требует внимания прямо сейчас",
  },
  products: {
    title: "Товары",
    subtitle: "100 SKU · Wildberries + Ozon · продажи, маржа и операционные риски",
  },
  advertising: {
    title: "Реклама и ставки",
    subtitle: "Детерминированные метрики, рекомендации и подтверждение действий",
  },
  reviews: {
    title: "Отзывы и вопросы",
    subtitle: "ИИ готовит ответы, правила определяют уровень автономности",
  },
  cards: {
    title: "Карточки товаров",
    subtitle: "ИИ-контент и изображения с обязательной проверкой перед публикацией",
  },
  inventory: {
    title: "Остатки и поставки",
    subtitle: "Прогноз дефицита и расчёт рекомендуемого пополнения",
  },
  economics: {
    title: "Юнит-экономика",
    subtitle: "Формулы считаются кодом, а не языковой моделью",
  },
  reconciliation: {
    title: "Сверка данных",
    subtitle: "Контроль расхождений между маркетплейсом и учётной системой",
  },
  audit: {
    title: "Журнал действий",
    subtitle: "Кто, когда и почему инициировал каждое изменение",
  },
  integrations: {
    title: "Интеграции",
    subtitle: "Единая точка контроля доступов и источников данных",
  },
};

function rub(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value) + " ₽";
}

function nowTime() {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

export function ControlCenter() {
  const [section, setSection] = useState<Section>("overview");
  const [campaigns, setCampaigns] = useState(campaignsSeed);
  const [inventory, setInventory] = useState<
    Array<(typeof inventorySeed)[number] & { productId?: string }>
  >(inventorySeed);
  const [economics, setEconomics] = useState(economicsRows);
  const [reviews, setReviews] = useState(reviewsSeed);
  const [reconciliations, setReconciliations] = useState(reconciliationRows);
  const [audit, setAudit] = useState<AuditEvent[]>(auditSeed);
  const [dataMode, setDataMode] = useState<"demo" | "live">("demo");
  const [toast, setToast] = useState<string | null>(null);
  const [sentReviews, setSentReviews] = useState<string[]>([]);
  const [createdSupplies, setCreatedSupplies] = useState<string[]>([]);
  const [cardGenerated, setCardGenerated] = useState(false);
  const [search, setSearch] = useState("");

  const attentionCount = attentionItems.length;

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        const response = await fetch("/api/dashboard", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok || cancelled) return;

        if (payload.campaigns) setCampaigns(payload.campaigns);
        if (payload.inventory) setInventory(payload.inventory);
        if (payload.economics) setEconomics(payload.economics);
        if (payload.reviews) {
          setReviews(payload.reviews);
          setSentReviews(
            payload.reviews
              .filter((item: { status?: string }) => item.status === "answered")
              .map((item: { id: string }) => item.id),
          );
        }
        if (payload.reconciliations) setReconciliations(payload.reconciliations);
        if (payload.audit) setAudit(payload.audit);
        setDataMode(payload.mode === "live" ? "live" : "demo");
      } catch {
        setDataMode("demo");
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredCampaigns = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return campaigns;
    return campaigns.filter(
      (item) =>
        item.product.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query),
    );
  }, [campaigns, search]);

  function pushAudit(event: Omit<AuditEvent, "id" | "time">) {
    setAudit((current) => [
      {
        id: crypto.randomUUID(),
        time: nowTime(),
        ...event,
      },
      ...current,
    ]);
  }

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  }

  async function applyBid(campaign: Campaign) {
    const response = await fetch("/api/actions/bid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId: campaign.id,
        sku: campaign.sku,
        from: campaign.currentBid,
        to: campaign.recommendedBid,
      }),
    });

    if (!response.ok) {
      notify("Не удалось применить ставку.");
      return;
    }

    setCampaigns((current) =>
      current.map((item) =>
        item.id === campaign.id
          ? { ...item, currentBid: item.recommendedBid }
          : item,
      ),
    );
    pushAudit({
      actor: "Оператор",
      action: `Подтверждено изменение ставки ${campaign.sku}`,
      result: `${rub(campaign.currentBid)} → ${rub(campaign.recommendedBid)} · ${dataMode === "live" ? "Supabase" : "Demo API"}`,
      tone: "success",
    });
    notify("Ставка применена и действие записано в журнал.");
  }

  async function sendReview(reviewId: string, product: string) {
    const response = await fetch("/api/actions/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewId, product }),
    });

    if (!response.ok) {
      notify("Не удалось отправить ответ.");
      return;
    }

    setSentReviews((current) => [...current, reviewId]);
    pushAudit({
      actor: "ИИ отзывов + оператор",
      action: `Ответ на отзыв по ${product}`,
      result: `Подтверждён и отправлен через ${dataMode === "live" ? "Supabase" : "Demo API"}`,
      tone: "success",
    });
    notify("Ответ отправлен. Действие зафиксировано.");
  }

  async function createSupply(
    id: string,
    productId: string,
    sku: string,
    qty: number,
  ) {
    const response = await fetch("/api/actions/supply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, sku, quantity: qty }),
    });

    if (!response.ok) {
      notify("Не удалось создать заявку.");
      return;
    }

    setCreatedSupplies((current) => [...current, id]);
    pushAudit({
      actor: "Расчёт поставок",
      action: `Создана заявка на поставку ${sku}`,
      result: `${qty} шт. · ожидает подтверждения склада`,
      tone: "info",
    });
    notify("Заявка на поставку создана.");
  }

  const title = sectionTitles[section];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">W</div>
          <div>
            <div className="brand-title">Маркетплейс ИИ</div>
            <div className="brand-subtitle">Центр управления</div>
          </div>
        </div>

        <div className="mode-pill">
          <span className="live-dot" />
          {dataMode === "live" ? "SUPABASE · ПОДКЛЮЧЕНО" : "ДЕМО-РЕЖИМ"}
        </div>

        <nav className="nav">
          {menu.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                className={active ? "nav-item active" : "nav-item"}
                key={item.id}
                onClick={() => setSection(item.id)}
              >
                <span className="nav-left">
                  <Icon size={18} strokeWidth={1.9} />
                  {item.label}
                </span>
                {item.badge && <span className="nav-badge">{item.badge}</span>}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <button className="nav-item">
            <span className="nav-left">
              <Settings size={18} />
              Настройки
            </span>
          </button>
          <div className="profile">
            <div className="avatar">И</div>
            <div>
              <strong>ИП Изотова</strong>
              <span>Демонстрационный контур</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="mobile-brand">Маркетплейс ИИ</div>
          <div className="search-box">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск по SKU, товару, кампании..."
            />
          </div>
          <div className="top-actions">
            <button className="icon-button" aria-label="Синхронизировать">
              <RefreshCw size={18} />
            </button>
            <button className="icon-button notification" aria-label="Уведомления">
              <Bell size={18} />
              <span>{attentionCount}</span>
            </button>
            <button className="help-button">
              <HelpCircle size={17} />
              Помощь
            </button>
          </div>
        </header>

        <div className="content">
          <div className="page-heading">
            <div>
              <h1>{title.title}</h1>
              <p>{title.subtitle}</p>
            </div>
            <div className="sync-state">
              <span className="sync-dot" />
              {dataMode === "live" ? "Supabase · данные в реальном времени" : "Демо-данные · резервный режим"}
            </div>
          </div>

          {section === "overview" && (
            <Overview
              onOpen={(next) => setSection(next)}
              campaigns={campaigns}
              audit={audit}
            />
          )}
          {section === "products" && <ProductCatalog />}
          {section === "advertising" && (
            <Advertising
              campaigns={filteredCampaigns}
              onApply={applyBid}
            />
          )}
          {section === "reviews" && (
            <Reviews items={reviews} sent={sentReviews} onSend={sendReview} />
          )}
          {section === "cards" && (
            <ProductCardStudio
              onGenerate={() => {
                setCardGenerated(true);
                pushAudit({
                  actor: "ИИ-контент",
                  action: "Создан черновик карточки HeatPro X500",
                  result: "Текст и медиа готовы к проверке перед публикацией",
                  tone: "info",
                });
                notify("Карточка создана и готова к проверке.");
              }}
            />
          )}
          {section === "inventory" && (
            <Inventory
              items={inventory}
              created={createdSupplies}
              onCreate={createSupply}
            />
          )}
          {section === "economics" && <Economics rows={economics} />}
          {section === "reconciliation" && (
            <Reconciliation rows={reconciliations} />
          )}
          {section === "audit" && <Audit events={audit} />}
          {section === "integrations" && <IntegrationsPanel />}
        </div>
      </main>

      {toast && (
        <div className="toast">
          <CheckCircle2 size={18} />
          <span>{toast}</span>
          <button onClick={() => setToast(null)} aria-label="Закрыть">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function Overview({
  onOpen,
  campaigns,
  audit,
}: {
  onOpen: (section: Section) => void;
  campaigns: Campaign[];
  audit: AuditEvent[];
}) {
  const criticalCampaigns = campaigns.filter((item) => item.drr > item.targetDrr);

  return (
    <>
      <section className="kpi-grid">
        {kpis.map((item) => (
          <article className="card kpi-card" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <div
              className={
                item.trend === "up"
                  ? "metric-delta positive"
                  : item.trend === "down"
                    ? "metric-delta negative"
                    : "metric-delta neutral"
              }
            >
              {item.trend === "up" && <ArrowUpRight size={14} />}
              {item.trend === "down" && <ArrowDownRight size={14} />}
              {item.delta}
            </div>
          </article>
        ))}
      </section>

      <section className="overview-grid">
        <article className="card attention-card">
          <div className="card-header">
            <div>
              <span className="eyebrow">Требует внимания</span>
              <h2>Операционные сигналы</h2>
            </div>
            <span className="count-chip">{attentionItems.length}</span>
          </div>

          <div className="attention-list">
            {attentionItems.map((item) => (
              <button
                className="attention-row"
                key={item.title}
                onClick={() => onOpen(item.section as Section)}
              >
                <span
                  className={
                    item.level === "critical"
                      ? "severity critical"
                      : "severity warning"
                  }
                >
                  <AlertTriangle size={18} />
                </span>
                <span className="attention-copy">
                  <strong>{item.title}</strong>
                  <span>{item.meta}</span>
                </span>
                <span className="attention-action">
                  {item.action}
                  <ChevronRight size={16} />
                </span>
              </button>
            ))}
          </div>
        </article>

        <article className="card ai-summary">
          <div className="card-header">
            <div>
              <span className="eyebrow">
                <Sparkles size={14} /> ИИ-сводка
              </span>
              <h2>Что изменилось</h2>
            </div>
            <span className="ai-chip">OpenRouter подключён</span>
          </div>

          <p>
            Маржинальная прибыль растёт медленнее выручки. Основной риск —
            рекламные расходы по HeatPro X500 и Mist Mini 3L: обе кампании
            превышают целевой ДРР.
          </p>

          <div className="summary-facts">
            <div>
              <span>Кампании выше цели</span>
              <strong>{criticalCampaigns.length}</strong>
            </div>
            <div>
              <span>Риск stockout</span>
              <strong>4 SKU</strong>
            </div>
            <div>
              <span>Расхождения данных</span>
              <strong>2</strong>
            </div>
          </div>

          <button className="primary-button" onClick={() => onOpen("advertising")}>
            Разобрать рекомендации
            <ChevronRight size={16} />
          </button>
        </article>
      </section>

      <section className="two-columns">
        <article className="card">
          <div className="card-header">
            <div>
              <span className="eyebrow">Реклама</span>
              <h2>Кампании с отклонениями</h2>
            </div>
            <button className="text-button" onClick={() => onOpen("advertising")}>
              Все кампании
            </button>
          </div>
          <div className="compact-table">
            <div className="compact-row compact-head">
              <span>Товар</span>
              <span>ДРР</span>
              <span>Ставка</span>
            </div>
            {criticalCampaigns.map((item) => (
              <div className="compact-row" key={item.id}>
                <span>
                  <strong>{item.product}</strong>
                  <small>{item.sku}</small>
                </span>
                <span className="bad-metric">{item.drr}%</span>
                <span>{rub(item.currentBid)}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <div className="card-header">
            <div>
              <span className="eyebrow">Журнал контроля</span>
              <h2>Последние действия</h2>
            </div>
            <button className="text-button" onClick={() => onOpen("audit")}>
              Весь журнал
            </button>
          </div>
          <div className="audit-mini">
            {audit.slice(0, 4).map((event) => (
              <div className="audit-mini-row" key={event.id}>
                <span className={`audit-dot ${event.tone}`} />
                <div>
                  <strong>{event.action}</strong>
                  <span>
                    {event.time} · {event.actor}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}

function Advertising({
  campaigns,
  onApply,
}: {
  campaigns: Campaign[];
  onApply: (campaign: Campaign) => void;
}) {
  return (
    <article className="card data-card">
      <div className="card-header table-title">
        <div>
          <span className="eyebrow">Демо API</span>
          <h2>Активные рекламные кампании</h2>
        </div>
        <div className="legend">
          <span><i className="legend-dot danger" /> выше цели</span>
          <span><i className="legend-dot good" /> в норме</span>
        </div>
      </div>

      <div className="data-table advertising-table">
        <div className="table-row table-head">
          <span>Товар / SKU</span>
          <span>Ставка</span>
          <span>Расход</span>
          <span>CTR</span>
          <span>CPC</span>
          <span>Заказы</span>
          <span>ДРР</span>
          <span>Рекомендация</span>
        </div>
        {campaigns.map((item) => {
          const bad = item.drr > item.targetDrr;
          const changed = item.currentBid === item.recommendedBid;
          return (
            <div className="table-row" key={item.id}>
              <span className="product-cell">
                <strong>{item.product}</strong>
                <small>{item.sku}</small>
                <MarketplaceLinks sku={item.sku} compact />
              </span>
              <span>{rub(item.currentBid)}</span>
              <span>{rub(item.spend)}</span>
              <span>{item.ctr}%</span>
              <span>{rub(item.cpc)}</span>
              <span>{item.orders}</span>
              <span>
                <b className={bad ? "status-value bad" : "status-value good"}>
                  {item.drr}%
                </b>
                <small className="cell-note">цель ≤ {item.targetDrr}%</small>
              </span>
              <span className="recommendation-cell">
                <div>
                  {item.recommendedBid < item.currentBid ? "Снизить" : item.recommendedBid > item.currentBid ? "Повысить" : "Применено"}
                  {!changed && (
                    <strong>
                      {rub(item.currentBid)} → {rub(item.recommendedBid)}
                    </strong>
                  )}
                </div>
                <button
                  className={changed ? "action-button done" : "action-button"}
                  disabled={changed}
                  onClick={() => onApply(item)}
                >
                  {changed ? <CheckCircle2 size={15} /> : <Activity size={15} />}
                  {changed ? "Применено" : "Применить"}
                </button>
              </span>
            </div>
          );
        })}
      </div>

      <div className="explain-box">
        <Bot size={19} />
        <div>
          <strong>Почему HeatPro X500 предлагается снизить?</strong>
          <span>
            Расход вырос, а число заказов не компенсирует рост стоимости
            привлечения. Рекомендация рассчитана правилами, ИИ используется
            только для объяснения решения человеку.
          </span>
        </div>
      </div>
    </article>
  );
}

function Reviews({
  items,
  sent,
  onSend,
}: {
  items: typeof reviewsSeed;
  sent: string[];
  onSend: (id: string, product: string) => void;
}) {
  const [answers, setAnswers] = useState<
    Record<
      string,
      {
        classification: string;
        risk: string;
        draft: string;
        policy: string;
        mode: "live" | "demo";
      }
    >
  >({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function refreshAnswer(review: (typeof reviewsSeed)[number]) {
    setLoadingId(review.id);
    try {
      const response = await fetch("/api/ai/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: review.product,
          author: review.author,
          rating: review.rating,
          text: review.text,
        }),
      });
      const payload = await response.json();
      if (response.ok && payload.data) {
        setAnswers((current) => ({
          ...current,
          [review.id]: { ...payload.data, mode: payload.mode },
        }));
      }
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="review-grid">
      {items.map((review) => {
        const isSent = sent.includes(review.id);
        const answer = answers[review.id] ?? {
          classification: review.classification,
          risk: review.risk,
          draft: review.draft,
          policy: review.policy,
          mode: "demo" as const,
        };
        return (
          <article className="card review-card" key={review.id}>
            <div className="review-top">
              <div>
                <div className="stars">
                  {"★★★★★".split("").map((star, index) => (
                    <span className={index < review.rating ? "filled" : ""} key={index}>
                      {star}
                    </span>
                  ))}
                </div>
                <strong>{review.product}</strong>
                <small>{review.author}</small>
                <MarketplaceLinks sku={review.product} compact />
              </div>
              <span className={review.rating <= 3 ? "risk-chip medium" : "risk-chip low"}>
                {answer.risk} риск
              </span>
            </div>

            <blockquote>{review.text}</blockquote>

            <div className="classification">
              <Tag size={15} />
              {answer.classification}
            </div>

            <div className="draft">
              <div className="draft-head">
                <span>
                  <WandSparkles size={15} />
                  ИИ-черновик · {answer.mode === "live" ? "LIVE" : "DEMO"}
                </span>
                <button
                  className="text-button"
                  disabled={loadingId === review.id}
                  onClick={() => refreshAnswer(review)}
                >
                  <RefreshCw size={13} />
                  {loadingId === review.id ? "Генерация..." : "Обновить ИИ"}
                </button>
              </div>
              <p>{answer.draft}</p>
              <div className="policy-line">{answer.policy}</div>
            </div>

            <div className="review-actions">
              <button className="secondary-button">Редактировать</button>
              <button
                className={isSent ? "primary-button success-button" : "primary-button"}
                disabled={isSent}
                onClick={() => onSend(review.id, review.product)}
              >
                {isSent ? <CheckCircle2 size={16} /> : <Send size={16} />}
                {isSent ? "Отправлено" : "Подтвердить и отправить"}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function Cards({
  generated,
  onGenerate,
}: {
  generated: boolean;
  onGenerate: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{
    title: string;
    description: string;
    bullets: string[];
    category: string;
    searchPhrases: string[];
    mode: "live" | "demo";
  } | null>(null);

  async function generateCard() {
    setLoading(true);
    try {
      const response = await fetch("/api/ai/product-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: "Электрический чайник HeatPro X500",
          brand: "HeatPro",
          volume: "1,7 л",
          power: "2200 Вт",
          features:
            "Нержавеющая сталь, автоотключение, защита от включения без воды, поворотная база 360°",
        }),
      });
      const payload = await response.json();
      if (response.ok && payload.data) {
        setPreview({ ...payload.data, mode: payload.mode });
        onGenerate();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="cards-workspace">
      <article className="card form-card">
        <div className="card-header">
          <div>
            <span className="eyebrow">Новая карточка</span>
            <h2>Исходные данные товара</h2>
          </div>
          <span className="demo-chip">Резервный режим ИИ</span>
        </div>

        <div className="form-grid">
          <label>
            Название товара
            <input defaultValue="Электрический чайник HeatPro X500" />
          </label>
          <label>
            Бренд
            <input defaultValue="HeatPro" />
          </label>
          <label>
            Объём
            <input defaultValue="1,7 л" />
          </label>
          <label>
            Мощность
            <input defaultValue="2200 Вт" />
          </label>
          <label className="wide">
            Особенности
            <textarea defaultValue="Нержавеющая сталь, автоотключение, защита от включения без воды, поворотная база 360°" />
          </label>
        </div>

        <div className="upload-zone">
          <ImagePlus size={26} />
          <div>
            <strong>Исходные фото товара</strong>
            <span>ImageRouter будет подключён через серверный ключ</span>
          </div>
          <button className="secondary-button">Выбрать файлы</button>
        </div>

        <button
          className="primary-button generate-button"
          onClick={generateCard}
          disabled={loading}
        >
          {loading ? <RefreshCw size={17} /> : <Sparkles size={17} />}
          {loading ? "Генерация..." : "Сгенерировать карточку"}
        </button>
      </article>

      <article className="card preview-card">
        {!generated ? (
          <div className="empty-preview">
            <WandSparkles size={34} />
            <strong>Здесь появится ИИ-черновик</strong>
            <span>
              Текст, характеристики и медиа проходят проверку перед отправкой в
              маркетплейс.
            </span>
          </div>
        ) : (
          <>
            <div className="card-header">
              <div>
                <span className="eyebrow">
                  Черновик готов · {preview?.mode === "live" ? "ИИ подключён" : "Демо ИИ"}
                </span>
                <h2>HeatPro X500</h2>
                <MarketplaceLinks sku="HP-X500-BLK" compact />
              </div>
              <span className="success-chip"><CheckCircle2 size={14} /> Проверено</span>
            </div>
            <div className="product-preview">
              <div className="fake-product-image">
                <PackageCheck size={54} />
                <span>ПРЕДПРОСМОТР</span>
              </div>
              <div>
                <span className="category-line">
                  {preview?.category ?? "Бытовая техника · Электрические чайники"}
                </span>
                <h3>
                  {preview?.title ??
                    "Электрический чайник HeatPro X500, 1,7 л, 2200 Вт"}
                </h3>
                <p>
                  {preview?.description ??
                    "Практичный электрический чайник для ежедневного использования дома и в офисе."}
                </p>
                <ul>
                  {(preview?.bullets ?? [
                    "Объём: 1,7 л",
                    "Мощность: 2200 Вт",
                    "Автоматическое отключение",
                    "Поворотная база 360°",
                  ]).map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="validation-row">
              <span><CheckCircle2 size={15} /> Обязательные поля заполнены</span>
              <span><CheckCircle2 size={15} /> Запрещённые обещания не найдены</span>
            </div>
            <button className="primary-button">
              Отправить на согласование
              <ChevronRight size={16} />
            </button>
          </>
        )}
      </article>
    </div>
  );
}

function Inventory({
  items,
  created,
  onCreate,
}: {
  items: Array<(typeof inventorySeed)[number] & { productId?: string }>;
  created: string[];
  onCreate: (id: string, productId: string, sku: string, qty: number) => void;
}) {
  return (
    <article className="card data-card">
      <div className="card-header table-title">
        <div>
          <span className="eyebrow">Расчёт поставок</span>
          <h2>Остатки и прогноз</h2>
        </div>
        <span className="formula-note">расчёт без LLM</span>
      </div>

      <div className="data-table inventory-table">
        <div className="table-row table-head">
          <span>Товар / SKU</span>
          <span>WB</span>
          <span>Свой склад</span>
          <span>Продажи / день</span>
          <span>Запас</span>
          <span>Рекомендация</span>
        </div>
        {items.map((item) => {
          const isCreated = created.includes(item.id);
          const critical = item.daysLeft < 7;
          return (
            <div className="table-row" key={item.id}>
              <span className="product-cell">
                <strong>{item.product}</strong>
                <small>{item.sku}</small>
              </span>
              <span>{item.wbStock} шт.</span>
              <span>{item.ownStock} шт.</span>
              <span>{item.dailySales}</span>
              <span>
                <b className={critical ? "status-value bad" : "status-value good"}>
                  {item.daysLeft} дня
                </b>
              </span>
              <span className="supply-cell">
                {item.recommendedSupply > 0 ? (
                  <>
                    <div>
                      <strong>{item.recommendedSupply} шт.</strong>
                      <small>рекомендуемая поставка</small>
                    </div>
                    <button
                      className={isCreated ? "action-button done" : "action-button"}
                      disabled={isCreated}
                      onClick={() =>
                        onCreate(
                          item.id,
                          item.productId ?? item.id,
                          item.sku,
                          item.recommendedSupply,
                        )
                      }
                    >
                      {isCreated ? <CheckCircle2 size={15} /> : <Truck size={15} />}
                      {isCreated ? "Создана" : "Создать заявку"}
                    </button>
                  </>
                ) : (
                  <span className="ok-text">Пополнение не требуется</span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <div className="formula-strip">
        <BarChart3 size={18} />
        <span>
          Пример логики: средние продажи × целевые дни покрытия + страховой запас −
          текущий доступный остаток.
        </span>
      </div>
    </article>
  );
}

function Economics({ rows }: { rows: typeof economicsRows }) {
  const totalProfit = rows.reduce((sum, row) => sum + row.profit, 0);

  return (
    <>
      <section className="economics-summary">
        <article className="card mini-kpi">
          <span>Средняя маржа</span>
          <strong>22,5%</strong>
          <small>по выбранным SKU</small>
        </article>
        <article className="card mini-kpi">
          <span>Маржинальная прибыль</span>
          <strong>{rub(totalProfit)}</strong>
          <small>на единицу по выборке</small>
        </article>
        <article className="card mini-kpi">
          <span>SKU ниже порога</span>
          <strong className="danger-text">1</strong>
          <small>порог маржи 15%</small>
        </article>
      </section>

      <article className="card data-card">
        <div className="card-header table-title">
          <div>
            <span className="eyebrow">Расчётная модель</span>
            <h2>Разложение маржи</h2>
          </div>
          <span className="formula-note">100% детерминированный расчёт</span>
        </div>

        <div className="data-table economics-table">
          <div className="table-row table-head">
            <span>SKU</span>
            <span>Цена</span>
            <span>Скидка</span>
            <span>Комиссия</span>
            <span>Логистика</span>
            <span>Реклама</span>
            <span>Себестоимость</span>
            <span>Прибыль</span>
            <span>Маржа</span>
          </div>
          {rows.map((row) => (
            <div className="table-row" key={row.sku}>
              <span className="product-cell">
                <strong>{row.product}</strong>
                <small>{row.sku}</small>
                <MarketplaceLinks sku={row.sku} compact />
              </span>
              <span>{rub(row.price)}</span>
              <span>−{rub(row.discount)}</span>
              <span>−{rub(row.commission)}</span>
              <span>−{rub(row.logistics + row.storage)}</span>
              <span>−{rub(row.ads)}</span>
              <span>−{rub(row.cost)}</span>
              <span><strong>{rub(row.profit)}</strong></span>
              <span>
                <b className={row.margin < 15 ? "status-value bad" : "status-value good"}>
                  {row.margin}%
                </b>
              </span>
            </div>
          ))}
        </div>
      </article>
    </>
  );
}

function Reconciliation({ rows }: { rows: typeof reconciliationRows }) {
  return (
    <article className="card data-card">
      <div className="card-header table-title">
        <div>
          <span className="eyebrow">Контрольный источник</span>
          <h2>WB ↔ учётная система</h2>
        </div>
        <button className="secondary-button">
          <RefreshCw size={15} />
          Запустить сверку
        </button>
      </div>

      <div className="data-table reconciliation-table">
        <div className="table-row table-head">
          <span>SKU</span>
          <span>WB</span>
          <span>Учётная система</span>
          <span>Разница</span>
          <span>Обновлено</span>
          <span>Статус</span>
        </div>
        {rows.map((row) => (
          <div className="table-row" key={row.sku}>
            <span className="product-cell">
              <strong>{row.sku}</strong>
              <MarketplaceLinks sku={row.sku} compact />
            </span>
            <span>{row.wb}</span>
            <span>{row.erp}</span>
            <span className={row.diff !== 0 ? "bad-metric" : "ok-text"}>
              {row.diff === 0 ? "0" : row.diff}
            </span>
            <span>{row.updated}</span>
            <span>
              {row.diff === 0 ? (
                <span className="inline-status success">
                  <CheckCircle2 size={15} /> Сходится
                </span>
              ) : (
                <span className="inline-status danger">
                  <AlertTriangle size={15} /> Разобрать
                </span>
              )}
            </span>
          </div>
        ))}
      </div>

      <div className="explain-box">
        <ShieldCheck size={19} />
        <div>
          <strong>Почему этот экран важнее «AI-аналитики»</strong>
          <span>
            Любое автоматическое действие должно опираться на проверенные
            источники. Здесь видно источник, время обновления и конкретное
            расхождение до того, как система примет решение.
          </span>
        </div>
      </div>
    </article>
  );
}

function Audit({ events }: { events: AuditEvent[] }) {
  return (
    <article className="card audit-card">
      <div className="card-header">
        <div>
          <span className="eyebrow">Журнал контроля</span>
          <h2>История решений и действий</h2>
        </div>
      </div>
      <div className="audit-list">
        {events.map((event) => (
          <div className="audit-row" key={event.id}>
            <div className="audit-time">{event.time}</div>
            <span className={`audit-dot ${event.tone}`} />
            <div className="audit-copy">
              <strong>{event.action}</strong>
              <span>{event.result}</span>
            </div>
            <span className="actor-chip">{event.actor}</span>
          </div>
        ))}
      </div>
    </article>
  );
}
