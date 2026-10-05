import { NextResponse } from "next/server";
import { supabaseSelect } from "@/lib/supabase-rest";
import { mediaProxyUrl } from "@/lib/media-url";

type Warehouse = {
  id: string;
  code: string;
  name: string;
  warehouse_type: string;
  channel_id: string | null;
  region: string | null;
  is_active: boolean;
};

type StockRow = {
  id: string;
  product_id: string;
  warehouse_id: string;
  on_hand: number;
  reserved: number;
  in_transit: number;
  daily_sales: number;
  days_cover: number;
  safety_stock: number;
  target_stock: number;
  source_value: number | null;
  synced_at: string;
};

type Product = {
  id: string;
  sku: string;
  name: string;
  brand: string;
  category: string;
  thumbnail_path: string | null;
};

type SalesChannel = {
  id: string;
  code: string;
  name: string;
};

type ProductChannel = {
  id: string;
  product_id: string;
  channel_id: string;
  external_product_id: string | null;
};

type SupplyOrder = {
  id: string;
  code: string;
  source_warehouse_id: string | null;
  destination_warehouse_id: string | null;
  channel_id: string | null;
  status: string;
  eta: string | null;
  created_at: string;
  approved_at: string | null;
  notes: string | null;
};

type SupplyLine = {
  id: string;
  supply_order_id: string;
  product_id: string;
  quantity: number;
  recommended_quantity: number;
  reason: string | null;
};

type Reconciliation = {
  id: string;
  product_id: string;
  product_channel_id: string | null;
  metric: string;
  difference: number;
  status: string;
  checked_at: string;
  warehouse_id: string | null;
  source_name: string | null;
  expected_value: number | null;
  actual_value: number | null;
};

function publicImage(path: string | null) {
  return path ? mediaProxyUrl("product-thumbnails", path) : null;
}

export async function GET() {
  const [
    warehouses,
    stocks,
    products,
    channels,
    productChannels,
    supplyOrders,
    supplyLines,
    reconciliations,
  ] = await Promise.all([
    supabaseSelect<Warehouse>("warehouses"),
    supabaseSelect<StockRow>("warehouse_stock"),
    supabaseSelect<Product>("products"),
    supabaseSelect<SalesChannel>("sales_channels"),
    supabaseSelect<ProductChannel>("product_channels"),
    supabaseSelect<SupplyOrder>("supply_orders", { order: "created_at.desc" }),
    supabaseSelect<SupplyLine>("supply_order_lines"),
    supabaseSelect<Reconciliation>("reconciliations", {
      order: "checked_at.desc",
    }),
  ]);

  if (
    !warehouses ||
    !stocks ||
    !products ||
    !channels ||
    !productChannels ||
    !supplyOrders ||
    !supplyLines ||
    !reconciliations
  ) {
    return NextResponse.json(
      { error: "Не удалось загрузить складские данные." },
      { status: 500 },
    );
  }

  const warehouseById = new Map(warehouses.map((row) => [row.id, row]));
  const productById = new Map(products.map((row) => [row.id, row]));
  const channelById = new Map(channels.map((row) => [row.id, row]));
  const productChannelByKey = new Map(
    productChannels.map((row) => [
      `${row.product_id}:${row.channel_id}`,
      row,
    ]),
  );

  const ownWarehouse = warehouses.find((row) => row.warehouse_type === "own");
  const ownAvailable = new Map<string, number>();
  if (ownWarehouse) {
    for (const stock of stocks) {
      if (stock.warehouse_id !== ownWarehouse.id) continue;
      ownAvailable.set(
        stock.product_id,
        Math.max(Number(stock.on_hand) - Number(stock.reserved), 0),
      );
    }
  }

  const discrepancyByKey = new Map<string, Reconciliation[]>();
  for (const row of reconciliations) {
    const key = `${row.product_id}:${row.warehouse_id ?? "none"}`;
    const list = discrepancyByKey.get(key) ?? [];
    list.push(row);
    discrepancyByKey.set(key, list);
  }

  const stockItems = stocks.map((stock) => {
    const product = productById.get(stock.product_id);
    const warehouse = warehouseById.get(stock.warehouse_id);
    const channel = warehouse?.channel_id
      ? channelById.get(warehouse.channel_id)
      : undefined;
    const productChannel = warehouse?.channel_id
      ? productChannelByKey.get(
          `${stock.product_id}:${warehouse.channel_id}`,
        )
      : undefined;

    const onHand = Number(stock.on_hand);
    const reserved = Number(stock.reserved);
    const inTransit = Number(stock.in_transit);
    const available = Math.max(onHand - reserved, 0);
    const target = Number(stock.target_stock);
    const recommended = Math.max(target - available - inTransit, 0);
    const daysCover = Number(stock.days_cover);
    const discrepancies =
      discrepancyByKey.get(`${stock.product_id}:${stock.warehouse_id}`) ??
      [];

    let health = "normal";
    if (warehouse?.warehouse_type !== "own") {
      if (daysCover < 3) health = "critical";
      else if (daysCover < 7) health = "low";
      else if (daysCover > 35) health = "excess";
    }

    return {
      id: stock.id,
      product: {
        id: product?.id ?? stock.product_id,
        sku: product?.sku ?? "—",
        name: product?.name ?? "Неизвестный товар",
        brand: product?.brand ?? "—",
        category: product?.category ?? "—",
        thumbnailUrl: publicImage(product?.thumbnail_path ?? null),
      },
      warehouse: warehouse
        ? {
            id: warehouse.id,
            code: warehouse.code,
            name: warehouse.name,
            type: warehouse.warehouse_type,
            region: warehouse.region,
          }
        : null,
      channel: channel
        ? {
            id: channel.id,
            code: channel.code,
            name: channel.name,
            externalProductId: productChannel?.external_product_id ?? null,
          }
        : null,
      onHand,
      reserved,
      available,
      inTransit,
      dailySales: Number(stock.daily_sales),
      daysCover,
      safetyStock: Number(stock.safety_stock),
      targetStock: target,
      recommendedSupply: recommended,
      ownAvailable: ownAvailable.get(stock.product_id) ?? 0,
      syncedAt: stock.synced_at,
      health,
      hasDiscrepancy: discrepancies.some((item) => item.status === "attention"),
      discrepancyCount: discrepancies.length,
    };
  });

  const linesByOrder = new Map<string, SupplyLine[]>();
  for (const line of supplyLines) {
    const list = linesByOrder.get(line.supply_order_id) ?? [];
    list.push(line);
    linesByOrder.set(line.supply_order_id, list);
  }

  const orders = supplyOrders.map((order) => {
    const source = order.source_warehouse_id
      ? warehouseById.get(order.source_warehouse_id)
      : undefined;
    const destination = order.destination_warehouse_id
      ? warehouseById.get(order.destination_warehouse_id)
      : undefined;
    const channel = order.channel_id
      ? channelById.get(order.channel_id)
      : undefined;

    const lines = (linesByOrder.get(order.id) ?? []).map((line) => {
      const product = productById.get(line.product_id);
      return {
        id: line.id,
        productId: line.product_id,
        sku: product?.sku ?? "—",
        productName: product?.name ?? "Неизвестный товар",
        thumbnailUrl: publicImage(product?.thumbnail_path ?? null),
        quantity: line.quantity,
        recommendedQuantity: line.recommended_quantity,
        reason: line.reason,
      };
    });

    return {
      id: order.id,
      code: order.code,
      status: order.status,
      eta: order.eta,
      createdAt: order.created_at,
      approvedAt: order.approved_at,
      notes: order.notes,
      source: source
        ? { id: source.id, code: source.code, name: source.name }
        : null,
      destination: destination
        ? {
            id: destination.id,
            code: destination.code,
            name: destination.name,
            type: destination.warehouse_type,
          }
        : null,
      channel: channel ? { code: channel.code, name: channel.name } : null,
      totalQuantity: lines.reduce((sum, line) => sum + line.quantity, 0),
      lines,
    };
  });

  const discrepancyItems = reconciliations.map((item) => {
    const product = productById.get(item.product_id);
    const warehouse = item.warehouse_id
      ? warehouseById.get(item.warehouse_id)
      : undefined;
    const productChannel = item.product_channel_id
      ? productChannels.find((row) => row.id === item.product_channel_id)
      : undefined;
    const channel = productChannel
      ? channelById.get(productChannel.channel_id)
      : undefined;

    return {
      id: item.id,
      product: {
        id: product?.id ?? item.product_id,
        sku: product?.sku ?? "—",
        name: product?.name ?? "Неизвестный товар",
        thumbnailUrl: publicImage(product?.thumbnail_path ?? null),
      },
      warehouse: warehouse
        ? { id: warehouse.id, code: warehouse.code, name: warehouse.name }
        : null,
      channel: channel
        ? {
            code: channel.code,
            name: channel.name,
            externalProductId: productChannel?.external_product_id ?? null,
          }
        : null,
      metric: item.metric,
      expectedValue:
        item.expected_value === null ? null : Number(item.expected_value),
      actualValue:
        item.actual_value === null ? null : Number(item.actual_value),
      difference: Number(item.difference),
      status: item.status,
      sourceName: item.source_name,
      checkedAt: item.checked_at,
    };
  });

  return NextResponse.json({
    warehouses: warehouses.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      type: row.warehouse_type,
      region: row.region,
      channel: row.channel_id
        ? channelById.get(row.channel_id)?.code ?? null
        : null,
    })),
    stock: stockItems,
    orders,
    reconciliations: discrepancyItems,
  });
}
