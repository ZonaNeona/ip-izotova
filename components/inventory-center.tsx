"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Boxes,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  PackageCheck,
  RefreshCw,
  Search,
  Send,
  Truck,
  Warehouse,
  X,
} from "lucide-react";
import { MarketplaceLinks } from "@/components/marketplace-links";
import { ModalPortal } from "@/components/modal-portal";

type WarehouseRow = {
  id: string;
  code: string;
  name: string;
  type: string;
  region: string | null;
  channel: string | null;
};

type StockItem = {
  id: string;
  product: {
    id: string;
    sku: string;
    name: string;
    brand: string;
    category: string;
    thumbnailUrl: string | null;
  };
  warehouse: {
    id: string;
    code: string;
    name: string;
    type: string;
    region: string | null;
  } | null;
  channel: {
    id: string;
    code: string;
    name: string;
    externalProductId: string | null;
  } | null;
  onHand: number;
  reserved: number;
  available: number;
  inTransit: number;
  dailySales: number;
  daysCover: number;
  safetyStock: number;
  targetStock: number;
  recommendedSupply: number;
  ownAvailable: number;
  syncedAt: string;
  health: "normal" | "critical" | "low" | "excess";
  hasDiscrepancy: boolean;
  discrepancyCount: number;
};

type SupplyLine = {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  thumbnailUrl: string | null;
  quantity: number;
  recommendedQuantity: number;
  reason: string | null;
};

type SupplyOrder = {
  id: string;
  code: string;
  status: string;
  eta: string | null;
  createdAt: string;
  approvedAt: string | null;
  notes: string | null;
  source: { id: string; code: string; name: string } | null;
  destination: {
    id: string;
    code: string;
    name: string;
    type: string;
  } | null;
  channel: { code: string; name: string } | null;
  totalQuantity: number;
  lines: SupplyLine[];
};

type Reconciliation = {
  id: string;
  product: {
    id: string;
    sku: string;
    name: string;
    thumbnailUrl: string | null;
  };
  warehouse: { id: string; code: string; name: string } | null;
  channel: {
    code: string;
    name: string;
    externalProductId: string | null;
  } | null;
  metric: string;
  expectedValue: number | null;
  actualValue: number | null;
  difference: number;
  status: string;
  sourceName: string | null;
  checkedAt: string;
};

type InventoryPayload = {
  warehouses: WarehouseRow[];
  stock: StockItem[];
  orders: SupplyOrder[];
  reconciliations: Reconciliation[];
};

type Tab = "stock" | "supplies" | "reconciliation";
type ChannelFilter = "all" | "own" | "wb" | "ozon";
type HealthFilter =
  | "all"
  | "critical"
  | "low"
  | "excess"
  | "discrepancy";
type SortKey = "cover" | "available" | "sales" | "recommended";

function number(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 1,
  }).format(value);
}

function supplyStatus(value: string) {
  const map: Record<string, string> = {
    draft: "Черновик",
    approved: "Подтверждена",
    in_transit: "В пути",
    received: "Принята",
    canceled: "Отменена",
  };
  return map[value] ?? value;
}

function healthTitle(value: StockItem["health"]) {
  if (value === "critical") return "Критично";
  if (value === "low") return "Низкий запас";
  if (value === "excess") return "Излишек";
  return "В норме";
}

export function InventoryCenter({
  initialTab = "stock",
}: {
  initialTab?: Tab;
}) {
  const [data, setData] = useState<InventoryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>(initialTab);

  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState<ChannelFilter>("all");
  const [warehouseId, setWarehouseId] = useState("all");
  const [health, setHealth] = useState<HealthFilter>("all");
  const [sort, setSort] = useState<SortKey>("cover");
  const [descending, setDescending] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [restockItem, setRestockItem] = useState<StockItem | null>(null);
  const [restockQty, setRestockQty] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<SupplyOrder | null>(null);
  const [selectedRecon, setSelectedRecon] =
    useState<Reconciliation | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const response = await fetch("/api/inventory-center", {
        cache: "no-store",
      });
      const payload = await response.json();
      if (response.ok) setData(payload);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, channel, warehouseId, health, sort, descending, pageSize]);

  useEffect(() => {
    const modalOpen = restockItem || selectedOrder || selectedRecon;
    if (!modalOpen) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setRestockItem(null);
        setSelectedOrder(null);
        setSelectedRecon(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [restockItem, selectedOrder, selectedRecon]);

  const stock = data?.stock ?? [];
  const orders = data?.orders ?? [];
  const reconciliations = data?.reconciliations ?? [];

  const totals = useMemo(() => {
    const marketplace = stock.filter(
      (item) => item.warehouse?.type !== "own",
    );
    const own = stock.filter((item) => item.warehouse?.type === "own");
    return {
      marketplaceAvailable: marketplace.reduce(
        (sum, item) => sum + item.available,
        0,
      ),
      ownAvailable: own.reduce((sum, item) => sum + item.available, 0),
      inTransit: marketplace.reduce((sum, item) => sum + item.inTransit, 0),
      critical: marketplace.filter((item) => item.health === "critical")
        .length,
      activeOrders: orders.filter(
        (item) => !["received", "canceled"].includes(item.status),
      ).length,
      discrepancies: reconciliations.filter(
        (item) => item.status === "attention",
      ).length,
    };
  }, [stock, orders, reconciliations]);

  const filteredStock = useMemo(() => {
    const query = search.trim().toLowerCase();

    const list = stock.filter((item) => {
      if (
        query &&
        !item.product.name.toLowerCase().includes(query) &&
        !item.product.sku.toLowerCase().includes(query) &&
        !(item.warehouse?.name ?? "").toLowerCase().includes(query)
      ) {
        return false;
      }

      if (warehouseId !== "all" && item.warehouse?.id !== warehouseId) {
        return false;
      }

      if (channel === "own" && item.warehouse?.type !== "own") return false;
      if (
        (channel === "wb" || channel === "ozon") &&
        item.channel?.code !== channel
      ) {
        return false;
      }

      if (health === "discrepancy" && !item.hasDiscrepancy) return false;
      if (
        health !== "all" &&
        health !== "discrepancy" &&
        item.health !== health
      ) {
        return false;
      }

      return true;
    });

    const getter = (item: StockItem) => {
      if (sort === "available") return item.available;
      if (sort === "sales") return item.dailySales;
      if (sort === "recommended") return item.recommendedSupply;
      return item.daysCover;
    };

    return [...list].sort((a, b) =>
      descending ? getter(b) - getter(a) : getter(a) - getter(b),
    );
  }, [stock, search, channel, warehouseId, health, sort, descending]);

  const pageCount = Math.max(1, Math.ceil(filteredStock.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paginatedStock = filteredStock.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  function openRestock(item: StockItem) {
    if (item.warehouse?.type === "own") return;
    setRestockItem(item);
    setRestockQty(
      Math.min(
        Math.max(Math.round(item.recommendedSupply), 1),
        Math.max(item.ownAvailable, 1),
      ),
    );
    setActionMessage(null);
  }

  async function createSupply() {
    if (!restockItem?.warehouse || actionBusy || restockQty <= 0) return;

    setActionBusy(true);
    setActionMessage(null);

    try {
      const response = await fetch("/api/inventory-center/supply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: restockItem.product.id,
          destinationWarehouseId: restockItem.warehouse.id,
          quantity: restockQty,
          reason: `Покрытие ${number(restockItem.daysCover)} дн. · цель 21 день`,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setActionMessage(payload.error ?? "Не удалось создать поставку.");
        return;
      }

      setActionMessage(`Поставка ${payload.code} создана.`);
      await loadData();
    } catch {
      setActionMessage("Не удалось создать поставку.");
    } finally {
      setActionBusy(false);
    }
  }

  async function supplyAction(
    order: SupplyOrder,
    action: "approve" | "dispatch" | "receive",
  ) {
    if (actionBusy) return;

    setActionBusy(true);
    setActionMessage(null);

    try {
      const response = await fetch("/api/inventory-center/supply", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, action }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setActionMessage(payload.error ?? "Не удалось обновить поставку.");
        return;
      }

      setActionMessage("Статус поставки обновлён.");
      await loadData();
      setSelectedOrder((current) =>
        current ? { ...current, status: payload.status } : current,
      );
    } catch {
      setActionMessage("Не удалось обновить поставку.");
    } finally {
      setActionBusy(false);
    }
  }

  async function reconciliationAction(
    item: Reconciliation,
    action: "resolve" | "recheck",
  ) {
    if (actionBusy) return;

    setActionBusy(true);
    setActionMessage(null);

    try {
      const response = await fetch(
        "/api/inventory-center/reconciliation",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: item.id, action }),
        },
      );
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setActionMessage(payload.error ?? "Не удалось выполнить сверку.");
        return;
      }

      setActionMessage(
        action === "resolve"
          ? "Расхождение закрыто."
          : "Данные перечитаны и время проверки обновлено.",
      );
      await loadData();
      setSelectedRecon((current) =>
        current ? { ...current, status: payload.status } : current,
      );
    } catch {
      setActionMessage("Не удалось выполнить сверку.");
    } finally {
      setActionBusy(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="inventory-loading card">
        <RefreshCw size={24} className="spin" />
        <strong>Загружаем складской контур…</strong>
        <span>Остатки, поставки и сверка по всем складам</span>
      </div>
    );
  }

  return (
    <div className="inventory-center">
      <section className="inventory-kpis">
        <article className="card inventory-kpi">
          <span>На маркетплейсах</span>
          <strong>{number(totals.marketplaceAvailable)} шт.</strong>
          <small>доступный остаток</small>
        </article>
        <article className="card inventory-kpi">
          <span>Собственный склад</span>
          <strong>{number(totals.ownAvailable)} шт.</strong>
          <small>доступно к распределению</small>
        </article>
        <article className="card inventory-kpi">
          <span>В пути</span>
          <strong>{number(totals.inTransit)} шт.</strong>
          <small>{totals.activeOrders} активных поставок</small>
        </article>
        <article className="card inventory-kpi attention">
          <span>Критичное покрытие</span>
          <strong>{totals.critical}</strong>
          <small>менее 3 дней на складе</small>
        </article>
        <article className="card inventory-kpi warning">
          <span>Расхождения</span>
          <strong>{totals.discrepancies}</strong>
          <small>требуют проверки</small>
        </article>
      </section>

      <nav className="inventory-tabs card">
        <button
          className={tab === "stock" ? "active" : ""}
          onClick={() => setTab("stock")}
        >
          <Boxes size={16} />
          Остатки
          <span>{stock.length}</span>
        </button>
        <button
          className={tab === "supplies" ? "active" : ""}
          onClick={() => setTab("supplies")}
        >
          <Truck size={16} />
          Поставки
          <span>{orders.length}</span>
        </button>
        <button
          className={tab === "reconciliation" ? "active" : ""}
          onClick={() => setTab("reconciliation")}
        >
          <ClipboardCheck size={16} />
          Сверка
          <span>{totals.discrepancies}</span>
        </button>
      </nav>

      {tab === "stock" && (
        <section className="card inventory-stock-card">
          <div className="inventory-toolbar">
            <div className="search-box inventory-search">
              <Search size={17} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Товар, SKU или склад"
              />
            </div>

            <div className="inventory-channel-switch">
              {([
                ["all", "Все"],
                ["own", "Свой склад"],
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
              value={warehouseId}
              onChange={(event) => setWarehouseId(event.target.value)}
            >
              <option value="all">Все склады</option>
              {(data?.warehouses ?? []).map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>

            <select
              value={health}
              onChange={(event) =>
                setHealth(event.target.value as HealthFilter)
              }
            >
              <option value="all">Все состояния</option>
              <option value="critical">Критично · &lt;3 дней</option>
              <option value="low">Низкий запас · 3–7 дней</option>
              <option value="excess">Излишек · &gt;35 дней</option>
              <option value="discrepancy">Есть расхождение</option>
            </select>
          </div>

          <div className="inventory-subtoolbar">
            <span>{filteredStock.length} складских позиций</span>
            <div className="inventory-sort">
              <span>Сортировка</span>
              <select
                value={sort}
                onChange={(event) =>
                  setSort(event.target.value as SortKey)
                }
              >
                <option value="cover">Дни покрытия</option>
                <option value="available">Доступный остаток</option>
                <option value="sales">Продажи в день</option>
                <option value="recommended">Рекомендация поставки</option>
              </select>
              <button onClick={() => setDescending((value) => !value)}>
                {descending ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
              </button>
            </div>
          </div>

          <div className="inventory-table-wrap">
            <div className="inventory-table">
              <div className="inventory-row inventory-head">
                <span>Товар</span>
                <span>Склад</span>
                <span>Доступно</span>
                <span>Резерв</span>
                <span>В пути</span>
                <span>Продажи/день</span>
                <span>Покрытие</span>
                <span>Рекомендация</span>
                <span>Состояние</span>
                <span />
              </div>

              {paginatedStock.map((item) => (
                <div
                  className={`inventory-row inventory-data-row ${item.health}`}
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openRestock(item)}
                  onKeyDown={(event) => {
                    if (
                      (event.key === "Enter" || event.key === " ") &&
                      item.warehouse?.type !== "own"
                    ) {
                      event.preventDefault();
                      openRestock(item);
                    }
                  }}
                >
                  <div className="inventory-product-cell">
                    <span className="inventory-product-thumb">
                      {item.product.thumbnailUrl ? (
                        <img src={item.product.thumbnailUrl} alt="" />
                      ) : (
                        <Boxes size={17} />
                      )}
                    </span>
                    <span>
                      <strong>{item.product.name}</strong>
                      <small>{item.product.sku}</small>
                      {item.channel && (
                        <MarketplaceLinks
                          sku={item.product.sku}
                          wbId={
                            item.channel.code === "wb"
                              ? item.channel.externalProductId
                              : null
                          }
                          ozonId={
                            item.channel.code === "ozon"
                              ? item.channel.externalProductId
                              : null
                          }
                          only={
                            item.channel.code === "wb" ? "wb" : "ozon"
                          }
                          compact
                        />
                      )}
                    </span>
                  </div>

                  <span className="inventory-warehouse-cell">
                    <strong>{item.warehouse?.name ?? "—"}</strong>
                    <small>
                      {item.channel?.code === "wb"
                        ? "Wildberries"
                        : item.channel?.code === "ozon"
                          ? "Ozon"
                          : "Собственный"}
                    </small>
                  </span>

                  <span><strong>{item.available}</strong></span>
                  <span>{item.reserved}</span>
                  <span>{item.inTransit}</span>
                  <span>{number(item.dailySales)}</span>
                  <span>
                    <strong
                      className={
                        item.health === "critical"
                          ? "danger-text"
                          : item.health === "low"
                            ? "warning-text"
                            : ""
                      }
                    >
                      {item.warehouse?.type === "own"
                        ? "—"
                        : `${number(item.daysCover)} дн.`}
                    </strong>
                  </span>
                  <span>
                    {item.warehouse?.type === "own" ? (
                      "—"
                    ) : item.recommendedSupply > 0 ? (
                      <strong>{Math.round(item.recommendedSupply)} шт.</strong>
                    ) : (
                      "Не требуется"
                    )}
                  </span>
                  <span>
                    <i className={`inventory-health ${item.health}`}>
                      {healthTitle(item.health)}
                    </i>
                    {item.hasDiscrepancy && (
                      <i className="inventory-discrepancy-dot" title="Есть расхождение" />
                    )}
                  </span>
                  <span className="inventory-chevron">
                    {item.warehouse?.type !== "own" && (
                      <ChevronRight size={16} />
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="inventory-pagination">
            <div>
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
                {filteredStock.length === 0
                  ? "0 позиций"
                  : `${(safePage - 1) * pageSize + 1}–${Math.min(
                      safePage * pageSize,
                      filteredStock.length,
                    )} из ${filteredStock.length}`}
              </span>
            </div>
            <div>
              <button
                disabled={safePage <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Назад
              </button>
              <span>{safePage} / {pageCount}</span>
              <button
                disabled={safePage >= pageCount}
                onClick={() =>
                  setPage((value) => Math.min(pageCount, value + 1))
                }
              >
                Далее
              </button>
            </div>
          </div>
        </section>
      )}

      {tab === "supplies" && (
        <section className="card supply-list-card">
          <div className="inventory-section-head">
            <div>
              <span className="eyebrow">Логистика</span>
              <h2>Активные поставки</h2>
            </div>
            <span>
              Поставки проходят стадии: черновик → подтверждение → в пути → приёмка
            </span>
          </div>

          <div className="supply-orders">
            {orders.map((order) => (
              <button
                key={order.id}
                className="supply-order-row"
                onClick={() => {
                  setSelectedOrder(order);
                  setActionMessage(null);
                }}
              >
                <span className="supply-order-icon">
                  <Truck size={18} />
                </span>
                <span>
                  <strong>{order.code}</strong>
                  <small>
                    {order.source?.name ?? "—"} → {order.destination?.name ?? "—"}
                  </small>
                </span>
                <span>
                  <strong>{order.lines.length}</strong>
                  <small>SKU</small>
                </span>
                <span>
                  <strong>{order.totalQuantity}</strong>
                  <small>шт.</small>
                </span>
                <span>
                  <strong>
                    {order.eta
                      ? new Date(order.eta).toLocaleDateString("ru-RU")
                      : "—"}
                  </strong>
                  <small>ETA</small>
                </span>
                <span>
                  <i className={`supply-status ${order.status}`}>
                    {supplyStatus(order.status)}
                  </i>
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        </section>
      )}

      {tab === "reconciliation" && (
        <section className="card reconciliation-center-card">
          <div className="inventory-section-head">
            <div>
              <span className="eyebrow">Контроль данных</span>
              <h2>Сверка складских остатков</h2>
            </div>
            <span>
              API маркетплейсов сравнивается с учётной системой
            </span>
          </div>

          <div className="reconciliation-center-table">
            <div className="reconciliation-center-row head">
              <span>Товар</span>
              <span>Склад</span>
              <span>Источник</span>
              <span>API</span>
              <span>Учёт</span>
              <span>Разница</span>
              <span>Статус</span>
              <span />
            </div>
            {reconciliations.map((item) => (
              <div
                className="reconciliation-center-row"
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setSelectedRecon(item);
                  setActionMessage(null);
                }}
              >
                <span className="reconciliation-product">
                  <strong>{item.product.name}</strong>
                  <small>{item.product.sku}</small>
                </span>
                <span>{item.warehouse?.name ?? "—"}</span>
                <span>{item.sourceName ?? "—"}</span>
                <span>{item.expectedValue ?? "—"}</span>
                <span>{item.actualValue ?? "—"}</span>
                <span className={item.difference ? "danger-text" : "ok-text"}>
                  {item.difference > 0 ? "+" : ""}
                  {item.difference}
                </span>
                <span>
                  <i
                    className={
                      item.status === "attention"
                        ? "recon-status attention"
                        : item.status === "resolved"
                          ? "recon-status resolved"
                          : "recon-status ok"
                    }
                  >
                    {item.status === "attention"
                      ? "Проверить"
                      : item.status === "resolved"
                        ? "Закрыто"
                        : "Совпадает"}
                  </i>
                </span>
                <ChevronRight size={16} />
              </div>
            ))}
          </div>
        </section>
      )}

      {restockItem && restockItem.warehouse && (
        <ModalPortal>
          <div
            className="inventory-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setRestockItem(null);
            }}
          >
            <section className="inventory-modal" role="dialog" aria-modal="true">
              <div className="inventory-modal-head">
                <div>
                  <span className="eyebrow">Рекомендация поставки</span>
                  <h3>{restockItem.product.name}</h3>
                  <p>{restockItem.warehouse.name}</p>
                </div>
                <button onClick={() => setRestockItem(null)}>
                  <X size={19} />
                </button>
              </div>

              <div className="inventory-modal-body">
                <div className="restock-evidence">
                  <div>
                    <span>Доступно</span>
                    <strong>{restockItem.available} шт.</strong>
                  </div>
                  <div>
                    <span>Продажи / день</span>
                    <strong>{number(restockItem.dailySales)}</strong>
                  </div>
                  <div>
                    <span>Покрытие</span>
                    <strong>{number(restockItem.daysCover)} дн.</strong>
                  </div>
                  <div>
                    <span>В пути</span>
                    <strong>{restockItem.inTransit} шт.</strong>
                  </div>
                  <div>
                    <span>Целевой запас</span>
                    <strong>{restockItem.targetStock} шт.</strong>
                  </div>
                  <div>
                    <span>Свой склад</span>
                    <strong>{restockItem.ownAvailable} шт.</strong>
                  </div>
                </div>

                <div className="restock-recommendation">
                  <AlertTriangle size={18} />
                  <div>
                    <span>Расчётная рекомендация</span>
                    <strong>
                      {Math.round(restockItem.recommendedSupply)} шт.
                    </strong>
                    <p>
                      Пополнение до 21 дня покрытия с учётом текущего остатка и
                      товара уже в пути.
                    </p>
                  </div>
                </div>

                <label className="restock-quantity">
                  <span>Количество в новой поставке</span>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(restockItem.ownAvailable, 1)}
                    value={restockQty}
                    onChange={(event) =>
                      setRestockQty(Math.max(1, Number(event.target.value)))
                    }
                  />
                  <small>
                    Доступно на собственном складе: {restockItem.ownAvailable} шт.
                  </small>
                </label>

                {actionMessage && (
                  <div className="inventory-action-message">{actionMessage}</div>
                )}
              </div>

              <div className="inventory-modal-footer">
                <span>
                  Поставка создаётся черновиком и требует подтверждения.
                </span>
                <div>
                  <button
                    className="secondary-button"
                    onClick={() => setRestockItem(null)}
                  >
                    Закрыть
                  </button>
                  <button
                    className="primary-button"
                    onClick={createSupply}
                    disabled={actionBusy || restockQty <= 0}
                  >
                    <Truck size={15} />
                    Создать поставку
                  </button>
                </div>
              </div>
            </section>
          </div>
        </ModalPortal>
      )}

      {selectedOrder && (
        <ModalPortal>
          <div
            className="inventory-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setSelectedOrder(null);
            }}
          >
            <section className="inventory-modal supply-modal" role="dialog" aria-modal="true">
              <div className="inventory-modal-head">
                <div>
                  <span className="eyebrow">Поставка</span>
                  <h3>{selectedOrder.code}</h3>
                  <p>
                    {selectedOrder.source?.name} → {selectedOrder.destination?.name}
                  </p>
                </div>
                <button onClick={() => setSelectedOrder(null)}>
                  <X size={19} />
                </button>
              </div>

              <div className="inventory-modal-body">
                <div className="supply-modal-summary">
                  <div>
                    <span>Статус</span>
                    <strong>{supplyStatus(selectedOrder.status)}</strong>
                  </div>
                  <div>
                    <span>Товаров</span>
                    <strong>{selectedOrder.lines.length} SKU</strong>
                  </div>
                  <div>
                    <span>Количество</span>
                    <strong>{selectedOrder.totalQuantity} шт.</strong>
                  </div>
                  <div>
                    <span>Ожидаемая дата</span>
                    <strong>
                      {selectedOrder.eta
                        ? new Date(selectedOrder.eta).toLocaleDateString("ru-RU")
                        : "—"}
                    </strong>
                  </div>
                </div>

                <div className="supply-lines">
                  {selectedOrder.lines.map((line) => (
                    <div key={line.id}>
                      <span className="supply-line-thumb">
                        {line.thumbnailUrl ? (
                          <img src={line.thumbnailUrl} alt="" />
                        ) : (
                          <Boxes size={15} />
                        )}
                      </span>
                      <span>
                        <strong>{line.productName}</strong>
                        <small>{line.sku}</small>
                      </span>
                      <strong>{line.quantity} шт.</strong>
                    </div>
                  ))}
                </div>

                {actionMessage && (
                  <div className="inventory-action-message">{actionMessage}</div>
                )}
              </div>

              <div className="inventory-modal-footer">
                <span>{selectedOrder.notes}</span>
                <div>
                  <button
                    className="secondary-button"
                    onClick={() => setSelectedOrder(null)}
                  >
                    Закрыть
                  </button>
                  {selectedOrder.status === "draft" && (
                    <button
                      className="primary-button"
                      onClick={() => supplyAction(selectedOrder, "approve")}
                      disabled={actionBusy}
                    >
                      <CheckCircle2 size={15} /> Подтвердить
                    </button>
                  )}
                  {selectedOrder.status === "approved" && (
                    <button
                      className="primary-button"
                      onClick={() => supplyAction(selectedOrder, "dispatch")}
                      disabled={actionBusy}
                    >
                      <Send size={15} /> Отгрузить
                    </button>
                  )}
                  {selectedOrder.status === "in_transit" && (
                    <button
                      className="primary-button"
                      onClick={() => supplyAction(selectedOrder, "receive")}
                      disabled={actionBusy}
                    >
                      <PackageCheck size={15} /> Принять
                    </button>
                  )}
                </div>
              </div>
            </section>
          </div>
        </ModalPortal>
      )}

      {selectedRecon && (
        <ModalPortal>
          <div
            className="inventory-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setSelectedRecon(null);
            }}
          >
            <section className="inventory-modal" role="dialog" aria-modal="true">
              <div className="inventory-modal-head">
                <div>
                  <span className="eyebrow">Сверка остатков</span>
                  <h3>{selectedRecon.product.name}</h3>
                  <p>{selectedRecon.warehouse?.name ?? "—"}</p>
                </div>
                <button onClick={() => setSelectedRecon(null)}>
                  <X size={19} />
                </button>
              </div>

              <div className="inventory-modal-body">
                <div className="recon-compare">
                  <div>
                    <span>API маркетплейса</span>
                    <strong>{selectedRecon.expectedValue ?? "—"}</strong>
                  </div>
                  <div>
                    <span>Учётная система</span>
                    <strong>{selectedRecon.actualValue ?? "—"}</strong>
                  </div>
                  <div>
                    <span>Расхождение</span>
                    <strong className="danger-text">
                      {selectedRecon.difference > 0 ? "+" : ""}
                      {selectedRecon.difference}
                    </strong>
                  </div>
                </div>
                <div className="recon-source-note">
                  <ClipboardCheck size={17} />
                  <span>
                    {selectedRecon.sourceName}. Последняя проверка:{" "}
                    {new Date(selectedRecon.checkedAt).toLocaleString("ru-RU")}.
                  </span>
                </div>
                {actionMessage && (
                  <div className="inventory-action-message">{actionMessage}</div>
                )}
              </div>

              <div className="inventory-modal-footer">
                <span>
                  Закрывайте расхождение только после подтверждения источника истины.
                </span>
                <div>
                  <button
                    className="secondary-button"
                    onClick={() =>
                      reconciliationAction(selectedRecon, "recheck")
                    }
                    disabled={actionBusy}
                  >
                    <RefreshCw size={14} /> Перепроверить
                  </button>
                  {selectedRecon.status === "attention" && (
                    <button
                      className="primary-button"
                      onClick={() =>
                        reconciliationAction(selectedRecon, "resolve")
                      }
                      disabled={actionBusy}
                    >
                      <CheckCircle2 size={15} /> Закрыть расхождение
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
