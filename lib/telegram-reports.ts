import { supabaseSelect } from "@/lib/supabase-rest";

export type TelegramReportCode =
  | "overview"
  | "advertising"
  | "feedback"
  | "inventory"
  | "economics"
  | "alerts";

type ProductSummary = {
  sku: string;
  name: string;
  revenue_30d: number;
  profit_30d: number;
  margin_30d: number;
  drr_30d: number;
  severity: string | null;
  incident_title: string | null;
};

type Campaign = {
  id: string;
  product_id: string;
  current_bid: number;
  recommended_bid: number;
  drr: number;
  target_drr: number;
  status: string;
};

type Review = {
  product_id: string;
  rating: number;
  status: string;
  body: string;
};

type Question = {
  product_id: string;
  status: string;
  body: string;
};

type Product = {
  id: string;
  sku: string;
  name: string;
};

type Warehouse = {
  id: string;
  name: string;
  warehouse_type: string;
};

type WarehouseStock = {
  product_id: string;
  warehouse_id: string;
  on_hand: number;
  reserved: number;
  in_transit: number;
  days_cover: number;
};

type SupplyOrder = {
  id: string;
  code: string;
  status: string;
};

type Reconciliation = {
  status: string;
};

type Economics = {
  product_id: string;
  channel: string;
  sku: string;
  name: string;
  revenue_30d: number;
  profit_30d: number;
  ad_spend_30d: number;
};

type Incident = {
  product_id: string;
  severity: string;
  title: string;
  status: string;
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function money(value: number) {
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

function n(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(value);
}

function nowLabel() {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow",
  }).format(new Date());
}

function productMap(products: Product[]) {
  return new Map(products.map((product) => [product.id, product]));
}

function footer() {
  return `\n\n<i>Обновлено: ${escapeHtml(nowLabel())} · Маркетплейс ИИ</i>`;
}

async function overviewReport() {
  const [
    products,
    campaigns,
    reviews,
    questions,
    stocks,
    warehouses,
    reconciliations,
  ] = await Promise.all([
    supabaseSelect<ProductSummary>("product_catalog_summary"),
    supabaseSelect<Campaign>("campaigns"),
    supabaseSelect<Review>("reviews"),
    supabaseSelect<Question>("questions"),
    supabaseSelect<WarehouseStock>("warehouse_stock"),
    supabaseSelect<Warehouse>("warehouses"),
    supabaseSelect<Reconciliation>("reconciliations"),
  ]);

  const rows = products ?? [];
  const revenue = rows.reduce((sum, row) => sum + Number(row.revenue_30d), 0);
  const profit = rows.reduce((sum, row) => sum + Number(row.profit_30d), 0);
  const margin = revenue ? (profit / revenue) * 100 : 0;
  const openIssues = rows.filter((row) => Boolean(row.severity)).length;

  const highDrr = (campaigns ?? []).filter(
    (row) => Number(row.drr) > Number(row.target_drr) * 1.05,
  ).length;

  const pendingFeedback =
    (reviews ?? []).filter((row) => row.status !== "answered").length +
    (questions ?? []).filter((row) => row.status !== "answered").length;

  const marketplaceWarehouseIds = new Set(
    (warehouses ?? [])
      .filter((row) => row.warehouse_type === "marketplace")
      .map((row) => row.id),
  );
  const criticalStock = (stocks ?? []).filter(
    (row) =>
      marketplaceWarehouseIds.has(row.warehouse_id) &&
      Number(row.days_cover) < 3,
  ).length;

  const discrepancies = (reconciliations ?? []).filter(
    (row) => row.status === "attention",
  ).length;

  return [
    "<b>📊 Обзор</b>",
    "",
    `Выручка за 30 дней: <b>${escapeHtml(money(revenue))}</b>`,
    `Прибыль: <b>${escapeHtml(money(profit))}</b>`,
    `Маржа: <b>${escapeHtml(pct(margin))}</b>`,
    "",
    "<b>Требуют внимания</b>",
    `• Товары с инцидентами: <b>${openIssues}</b>`,
    `• Рекламные кампании выше цели: <b>${highDrr}</b>`,
    `• Критичные складские позиции: <b>${criticalStock}</b>`,
    `• Необработанные отзывы/вопросы: <b>${pendingFeedback}</b>`,
    `• Расхождения учёта: <b>${discrepancies}</b>`,
  ].join("\n") + footer();
}

async function advertisingReport() {
  const [campaigns, products] = await Promise.all([
    supabaseSelect<Campaign>("campaigns"),
    supabaseSelect<Product>("products"),
  ]);
  const productsById = productMap(products ?? []);
  const rows = (campaigns ?? [])
    .map((row) => ({
      ...row,
      delta: Number(row.drr) - Number(row.target_drr),
    }))
    .sort((a, b) => b.delta - a.delta);

  const spendPressure = rows.filter((row) => row.delta > 0);
  const recommendations = rows.filter(
    (row) => Number(row.current_bid) !== Number(row.recommended_bid),
  );

  const top = spendPressure.slice(0, 5).map((row) => {
    const product = productsById.get(row.product_id);
    return `• ${escapeHtml(product?.sku ?? "SKU")} · ДРР <b>${escapeHtml(
      pct(Number(row.drr)),
    )}</b> при цели ${escapeHtml(pct(Number(row.target_drr)))}`;
  });

  return [
    "<b>📣 Реклама и ставки</b>",
    "",
    `Кампаний: <b>${rows.length}</b>`,
    `Выше целевого ДРР: <b>${spendPressure.length}</b>`,
    `Есть рекомендация по ставке: <b>${recommendations.length}</b>`,
    "",
    "<b>Главные отклонения</b>",
    ...(top.length ? top : ["• Отклонений выше цели нет"]),
  ].join("\n") + footer();
}

async function feedbackReport() {
  const [reviews, questions, products] = await Promise.all([
    supabaseSelect<Review>("reviews"),
    supabaseSelect<Question>("questions"),
    supabaseSelect<Product>("products"),
  ]);

  const productsById = productMap(products ?? []);
  const reviewRows = reviews ?? [];
  const questionRows = questions ?? [];
  const negative = reviewRows.filter((row) => Number(row.rating) <= 2);
  const pendingNegative = negative.filter((row) => row.status !== "answered");
  const waitingReviews = reviewRows.filter(
    (row) => row.status !== "answered",
  ).length;
  const waitingQuestions = questionRows.filter(
    (row) => row.status !== "answered",
  ).length;

  const topNegative = pendingNegative.slice(0, 4).map((row) => {
    const product = productsById.get(row.product_id);
    const short =
      row.body.length > 90 ? row.body.slice(0, 87) + "…" : row.body;
    return `• ${escapeHtml(product?.sku ?? "SKU")} · ${row.rating}★ · ${escapeHtml(short)}`;
  });

  return [
    "<b>💬 Отзывы и вопросы</b>",
    "",
    `Отзывов ждут ответа: <b>${waitingReviews}</b>`,
    `Вопросов ждут ответа: <b>${waitingQuestions}</b>`,
    `Негативных отзывов 1–2★: <b>${negative.length}</b>`,
    `Из них не обработано: <b>${pendingNegative.length}</b>`,
    "",
    "<b>Негатив в очереди</b>",
    ...(topNegative.length ? topNegative : ["• Необработанного негатива нет"]),
  ].join("\n") + footer();
}

async function inventoryReport() {
  const [stocks, warehouses, products, orders, reconciliations] =
    await Promise.all([
      supabaseSelect<WarehouseStock>("warehouse_stock"),
      supabaseSelect<Warehouse>("warehouses"),
      supabaseSelect<Product>("products"),
      supabaseSelect<SupplyOrder>("supply_orders"),
      supabaseSelect<Reconciliation>("reconciliations"),
    ]);

  const warehouseById = new Map(
    (warehouses ?? []).map((warehouse) => [warehouse.id, warehouse]),
  );
  const productsById = productMap(products ?? []);

  const marketplaceStocks = (stocks ?? []).filter(
    (row) =>
      warehouseById.get(row.warehouse_id)?.warehouse_type === "marketplace",
  );

  const critical = marketplaceStocks
    .filter((row) => Number(row.days_cover) < 3)
    .sort((a, b) => Number(a.days_cover) - Number(b.days_cover));
  const low = marketplaceStocks.filter(
    (row) => Number(row.days_cover) >= 3 && Number(row.days_cover) < 7,
  );

  const activeOrders = (orders ?? []).filter(
    (row) => !["received", "canceled"].includes(row.status),
  ).length;
  const discrepancies = (reconciliations ?? []).filter(
    (row) => row.status === "attention",
  ).length;

  const top = critical.slice(0, 5).map((row) => {
    const product = productsById.get(row.product_id);
    const warehouse = warehouseById.get(row.warehouse_id);
    return `• ${escapeHtml(product?.sku ?? "SKU")} · ${escapeHtml(
      warehouse?.name ?? "склад",
    )} · <b>${escapeHtml(
      new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(
        Number(row.days_cover),
      ),
    )} дн.</b>`;
  });

  return [
    "<b>📦 Склады и поставки</b>",
    "",
    `Критично (&lt;3 дней): <b>${critical.length}</b>`,
    `Низкий запас (3–7 дней): <b>${low.length}</b>`,
    `Активных поставок: <b>${activeOrders}</b>`,
    `Расхождений учёта: <b>${discrepancies}</b>`,
    "",
    "<b>Минимальное покрытие</b>",
    ...(top.length ? top : ["• Критичных позиций нет"]),
  ].join("\n") + footer();
}

async function economicsReport() {
  const rows =
    (await supabaseSelect<Economics>("unit_economics_summary")) ?? [];

  const revenue = rows.reduce((sum, row) => sum + Number(row.revenue_30d), 0);
  const profit = rows.reduce((sum, row) => sum + Number(row.profit_30d), 0);
  const ads = rows.reduce((sum, row) => sum + Number(row.ad_spend_30d), 0);
  const margin = revenue ? (profit / revenue) * 100 : 0;
  const drr = revenue ? (ads / revenue) * 100 : 0;

  const low = rows
    .map((row) => ({
      ...row,
      margin: Number(row.revenue_30d)
        ? (Number(row.profit_30d) / Number(row.revenue_30d)) * 100
        : 0,
    }))
    .filter((row) => row.margin < 15)
    .sort((a, b) => a.margin - b.margin);

  return [
    "<b>💰 Юнит-экономика</b>",
    "",
    `Выручка: <b>${escapeHtml(money(revenue))}</b>`,
    `Прибыль: <b>${escapeHtml(money(profit))}</b>`,
    `Маржа: <b>${escapeHtml(pct(margin))}</b>`,
    `ДРР: <b>${escapeHtml(pct(drr))}</b>`,
    `Позиций ниже 15% маржи: <b>${low.length}</b>`,
    "",
    "<b>Минимальная маржа</b>",
    ...low.slice(0, 5).map(
      (row) =>
        `• ${escapeHtml(row.sku)} · ${row.channel === "wb" ? "WB" : "Ozon"} · <b>${escapeHtml(
          pct(row.margin),
        )}</b>`,
    ),
  ].join("\n") + footer();
}

async function alertsReport() {
  const [incidents, campaigns, reviews, questions, stocks, warehouses, products] =
    await Promise.all([
      supabaseSelect<Incident>("incidents"),
      supabaseSelect<Campaign>("campaigns"),
      supabaseSelect<Review>("reviews"),
      supabaseSelect<Question>("questions"),
      supabaseSelect<WarehouseStock>("warehouse_stock"),
      supabaseSelect<Warehouse>("warehouses"),
      supabaseSelect<Product>("products"),
    ]);

  const productById = productMap(products ?? []);
  const warehouseById = new Map(
    (warehouses ?? []).map((row) => [row.id, row]),
  );

  const incidentRows = (incidents ?? []).filter(
    (row) => row.status === "open" && ["critical", "high"].includes(row.severity),
  );
  const highDrr = (campaigns ?? []).filter(
    (row) => Number(row.drr) > Number(row.target_drr) * 1.2,
  );
  const negative = (reviews ?? []).filter(
    (row) => Number(row.rating) <= 2 && row.status !== "answered",
  );
  const pendingQuestions = (questions ?? []).filter(
    (row) => row.status === "new",
  );
  const criticalStocks = (stocks ?? []).filter((row) => {
    const warehouse = warehouseById.get(row.warehouse_id);
    return (
      warehouse?.warehouse_type === "marketplace" &&
      Number(row.days_cover) < 3
    );
  });

  const lines: string[] = [
    "<b>🚨 Критические события</b>",
    "",
    `Инциденты: <b>${incidentRows.length}</b>`,
    `Кампании с сильным превышением ДРР: <b>${highDrr.length}</b>`,
    `Негативные отзывы без ответа: <b>${negative.length}</b>`,
    `Новые вопросы: <b>${pendingQuestions.length}</b>`,
    `Остаток менее 3 дней: <b>${criticalStocks.length}</b>`,
  ];

  const priority: string[] = [];
  for (const item of incidentRows.slice(0, 3)) {
    const product = productById.get(item.product_id);
    priority.push(
      `• ${escapeHtml(product?.sku ?? "SKU")} · ${escapeHtml(item.title)}`,
    );
  }
  for (const item of criticalStocks.slice(0, Math.max(0, 5 - priority.length))) {
    const product = productById.get(item.product_id);
    const warehouse = warehouseById.get(item.warehouse_id);
    priority.push(
      `• ${escapeHtml(product?.sku ?? "SKU")} · запас ${escapeHtml(
        Number(item.days_cover).toFixed(1),
      )} дн. · ${escapeHtml(warehouse?.name ?? "склад")}`,
    );
  }

  lines.push("", "<b>Приоритет</b>", ...(priority.length ? priority : ["• Критичных событий нет"]));
  return lines.join("\n") + footer();
}

export async function buildTelegramReport(code: TelegramReportCode) {
  if (code === "advertising") return advertisingReport();
  if (code === "feedback") return feedbackReport();
  if (code === "inventory") return inventoryReport();
  if (code === "economics") return economicsReport();
  if (code === "alerts") return alertsReport();
  return overviewReport();
}

export const telegramReportCodes: TelegramReportCode[] = [
  "overview",
  "advertising",
  "feedback",
  "inventory",
  "economics",
  "alerts",
];
