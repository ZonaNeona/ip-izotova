export type Campaign = {
  id: string;
  product: string;
  sku: string;
  currentBid: number;
  recommendedBid: number;
  spend: number;
  ctr: number;
  cpc: number;
  orders: number;
  drr: number;
  targetDrr: number;
};

export type InventoryRow = {
  id: string;
  product: string;
  sku: string;
  wbStock: number;
  ownStock: number;
  dailySales: number;
  daysLeft: number;
  recommendedSupply: number;
};

export type AuditEvent = {
  id: string;
  time: string;
  actor: string;
  action: string;
  result: string;
  tone: "success" | "warning" | "info";
};

export const kpis = [
  { label: "Выручка", value: "4,82 млн ₽", delta: "+8,4%", trend: "up" },
  { label: "Маржинальная прибыль", value: "1,14 млн ₽", delta: "+3,1%", trend: "up" },
  { label: "Расход на рекламу", value: "684 200 ₽", delta: "+12,7%", trend: "down" },
  { label: "ДРР", value: "14,2%", delta: "цель ≤ 15%", trend: "neutral" },
];

export const attentionItems = [
  {
    level: "critical",
    title: "3 рекламные кампании выше целевого ДРР",
    meta: "Потенциальная экономия: 31 400 ₽ / нед.",
    action: "Открыть рекламу",
    section: "advertising",
  },
  {
    level: "warning",
    title: "4 SKU закончатся менее чем через 7 дней",
    meta: "Критичный товар закончится примерно через 4,2 дня",
    action: "Открыть остатки",
    section: "inventory",
  },
  {
    level: "warning",
    title: "3 отзыва требуют ответа",
    meta: "1 негативный отзыв ждёт согласования",
    action: "Открыть отзывы",
    section: "reviews",
  },
  {
    level: "critical",
    title: "2 расхождения WB ↔ учётная система",
    meta: "Максимальная разница по остатку: 2 шт.",
    action: "Проверить данные",
    section: "reconciliation",
  },
];

export const campaignsSeed: Campaign[] = [
  {
    id: "cmp-1",
    product: "Чайник электрический HeatPro X500",
    sku: "HP-X500-BLK",
    currentBid: 420,
    recommendedBid: 360,
    spend: 18320,
    ctr: 4.1,
    cpc: 31,
    orders: 84,
    drr: 21.1,
    targetDrr: 15,
  },
  {
    id: "cmp-2",
    product: "Вертикальный пылесос AirFlow V9",
    sku: "AF-V9-WHT",
    currentBid: 310,
    recommendedBid: 340,
    spend: 8410,
    ctr: 5.7,
    cpc: 22,
    orders: 71,
    drr: 11.3,
    targetDrr: 15,
  },
  {
    id: "cmp-3",
    product: "Увлажнитель Mist Mini 3L",
    sku: "MM-3L-WHT",
    currentBid: 260,
    recommendedBid: 230,
    spend: 12150,
    ctr: 3.6,
    cpc: 28,
    orders: 49,
    drr: 18.8,
    targetDrr: 15,
  },
];

export const inventorySeed: InventoryRow[] = [
  {
    id: "inv-1",
    product: "Чайник электрический HeatPro X500",
    sku: "HP-X500-BLK",
    wbStock: 42,
    ownStock: 310,
    dailySales: 9.9,
    daysLeft: 4.2,
    recommendedSupply: 180,
  },
  {
    id: "inv-2",
    product: "Вертикальный пылесос AirFlow V9",
    sku: "AF-V9-WHT",
    wbStock: 65,
    ownStock: 145,
    dailySales: 10.8,
    daysLeft: 6.0,
    recommendedSupply: 120,
  },
  {
    id: "inv-3",
    product: "Увлажнитель Mist Mini 3L",
    sku: "MM-3L-WHT",
    wbStock: 190,
    ownStock: 260,
    dailySales: 8.1,
    daysLeft: 23.5,
    recommendedSupply: 0,
  },
  {
    id: "inv-4",
    product: "Тостер ToastOne T2",
    sku: "TO-T2-CRM",
    wbStock: 31,
    ownStock: 117,
    dailySales: 5.4,
    daysLeft: 5.7,
    recommendedSupply: 90,
  },
];

export const economicsRows = [
  {
    sku: "HP-X500-BLK",
    product: "HeatPro X500",
    price: 4990,
    discount: 500,
    commission: 673,
    logistics: 286,
    storage: 41,
    ads: 530,
    cost: 1780,
    profit: 1180,
    margin: 23.6,
  },
  {
    sku: "AF-V9-WHT",
    product: "AirFlow V9",
    price: 8990,
    discount: 700,
    commission: 1214,
    logistics: 390,
    storage: 68,
    ads: 640,
    cost: 3310,
    profit: 2668,
    margin: 29.7,
  },
  {
    sku: "MM-3L-WHT",
    product: "Mist Mini 3L",
    price: 3290,
    discount: 300,
    commission: 444,
    logistics: 241,
    storage: 33,
    ads: 510,
    cost: 1290,
    profit: 472,
    margin: 14.3,
  },
];

export const reviewsSeed = [
  {
    id: "rev-1",
    rating: 2,
    product: "HeatPro X500",
    author: "Анна",
    text: "Чайник хороший, но через неделю начала заедать кнопка крышки.",
    classification: "Проблема с товаром",
    risk: "Средний",
    draft:
      "Анна, спасибо за обратную связь. Нам жаль, что возникла проблема с кнопкой крышки. Пожалуйста, оформите обращение через поддержку заказа — мы поможем решить вопрос по товару.",
    policy: "Требует подтверждения",
  },
  {
    id: "rev-2",
    rating: 5,
    product: "AirFlow V9",
    author: "Михаил",
    text: "Лёгкий, мощный, зарядки хватает на квартиру. Покупкой доволен.",
    classification: "Позитивный отзыв",
    risk: "Низкий",
    draft:
      "Михаил, спасибо за высокую оценку! Рады, что AirFlow V9 подошёл вам по мощности и времени работы.",
    policy: "Можно отправить автоматически",
  },
];

export const reconciliationRows = [
  { sku: "HP-X500-BLK", wb: 42, erp: 42, diff: 0, updated: "11:32 / 11:30" },
  { sku: "AF-V9-WHT", wb: 65, erp: 63, diff: -2, updated: "11:32 / 11:30" },
  { sku: "MM-3L-WHT", wb: 190, erp: 190, diff: 0, updated: "11:32 / 11:30" },
  { sku: "TO-T2-CRM", wb: 31, erp: 30, diff: -1, updated: "11:32 / 11:30" },
];

export const auditSeed: AuditEvent[] = [
  {
    id: "aud-1",
    time: "11:43",
    actor: "AI Recommendation",
    action: "Подготовлена рекомендация по ставке HP-X500-BLK",
    result: "Ожидает решения: 420 ₽ → 360 ₽",
    tone: "warning",
  },
  {
    id: "aud-2",
    time: "11:32",
    actor: "Data Monitor",
    action: "Сверка остатков",
    result: "Найдено 2 расхождения",
    tone: "warning",
  },
  {
    id: "aud-3",
    time: "10:15",
    actor: "System",
    action: "Обновление unit economics",
    result: "1 248 строк пересчитано без ошибок",
    tone: "success",
  },
];
