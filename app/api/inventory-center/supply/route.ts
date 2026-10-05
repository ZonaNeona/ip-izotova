import { NextResponse } from "next/server";
import {
  supabaseInsert,
  supabasePatch,
  supabaseSelect,
} from "@/lib/supabase-rest";

type Warehouse = {
  id: string;
  code: string;
  name: string;
  channel_id: string | null;
};

type StockRow = {
  id: string;
  product_id: string;
  warehouse_id: string;
  on_hand: number;
  in_transit: number;
};

type SupplyOrder = {
  id: string;
  code: string;
  destination_warehouse_id: string | null;
  status: string;
};

type SupplyLine = {
  id: string;
  supply_order_id: string;
  product_id: string;
  quantity: number;
};

async function writeAudit(
  action: string,
  result: string,
  entityId?: string,
) {
  await supabaseInsert("audit_log", {
    actor: "Оператор склада",
    action,
    result,
    tone: "success",
    entity_type: "supply_order",
    entity_id: entityId ?? null,
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    productId?: string;
    destinationWarehouseId?: string;
    quantity?: number;
    reason?: string;
  };

  if (
    !body.productId ||
    !body.destinationWarehouseId ||
    !body.quantity ||
    body.quantity <= 0
  ) {
    return NextResponse.json(
      { error: "Не указаны товар, склад назначения или количество." },
      { status: 400 },
    );
  }

  const [warehouses, products] = await Promise.all([
    supabaseSelect<Warehouse>("warehouses"),
    supabaseSelect<{ id: string; sku: string; name: string }>("products", {
      filters: { id: body.productId },
    }),
  ]);

  const source = warehouses?.find((row) => row.code === "OWN-TULA");
  const destination = warehouses?.find(
    (row) => row.id === body.destinationWarehouseId,
  );
  const product = products?.[0];

  if (!source || !destination || !product) {
    return NextResponse.json(
      { error: "Не удалось определить маршрут поставки." },
      { status: 404 },
    );
  }

  const code = `SUP-${new Date().toISOString().slice(2, 10).replaceAll("-", "")}-${Date.now().toString().slice(-5)}`;

  const inserted = await supabaseInsert<{ id: string; code: string }>(
    "supply_orders",
    {
      code,
      source_warehouse_id: source.id,
      destination_warehouse_id: destination.id,
      channel_id: destination.channel_id,
      status: "draft",
      eta: new Date(Date.now() + 4 * 86_400_000)
        .toISOString()
        .slice(0, 10),
      notes:
        body.reason ??
        "Создано оператором из рекомендации по покрытию запасов.",
    },
  );

  const order = inserted?.[0];
  if (!order) {
    return NextResponse.json(
      { error: "Не удалось создать поставку." },
      { status: 500 },
    );
  }

  const line = await supabaseInsert("supply_order_lines", {
    supply_order_id: order.id,
    product_id: body.productId,
    quantity: Math.round(body.quantity),
    recommended_quantity: Math.round(body.quantity),
    reason:
      body.reason ??
      "Пополнение до целевого запаса с учётом прогноза продаж.",
  });

  if (!line?.length) {
    return NextResponse.json(
      { error: "Поставка создана без строки товара." },
      { status: 500 },
    );
  }

  await writeAudit(
    `Создана поставка ${code}`,
    `${product.sku} · ${body.quantity} шт. → ${destination.name}`,
    order.id,
  );

  return NextResponse.json({ ok: true, orderId: order.id, code });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    orderId?: string;
    action?: "approve" | "dispatch" | "receive";
  };

  if (!body.orderId || !body.action) {
    return NextResponse.json(
      { error: "Не указана поставка или действие." },
      { status: 400 },
    );
  }

  const orders = await supabaseSelect<SupplyOrder>("supply_orders", {
    filters: { id: body.orderId },
  });
  const order = orders?.[0];

  if (!order) {
    return NextResponse.json({ error: "Поставка не найдена." }, { status: 404 });
  }

  const lines =
    (await supabaseSelect<SupplyLine>("supply_order_lines", {
      filters: { supply_order_id: order.id },
    })) ?? [];

  if (body.action === "approve") {
    await supabasePatch(
      "supply_orders",
      { id: order.id },
      { status: "approved", approved_at: new Date().toISOString() },
    );
    await writeAudit(
      `Подтверждена поставка ${order.code}`,
      "Поставка готова к отгрузке.",
      order.id,
    );
    return NextResponse.json({ ok: true, status: "approved" });
  }

  if (!order.destination_warehouse_id) {
    return NextResponse.json(
      { error: "У поставки не указан склад назначения." },
      { status: 400 },
    );
  }

  if (body.action === "dispatch") {
    for (const line of lines) {
      const stocks = await supabaseSelect<StockRow>("warehouse_stock", {
        filters: {
          product_id: line.product_id,
          warehouse_id: order.destination_warehouse_id,
        },
      });
      const stock = stocks?.[0];
      if (!stock) continue;

      await supabasePatch(
        "warehouse_stock",
        { id: stock.id },
        { in_transit: Number(stock.in_transit) + Number(line.quantity) },
      );
    }

    await supabasePatch(
      "supply_orders",
      { id: order.id },
      { status: "in_transit" },
    );
    await writeAudit(
      `Поставка ${order.code} отгружена`,
      "Количество добавлено в остаток «в пути».",
      order.id,
    );
    return NextResponse.json({ ok: true, status: "in_transit" });
  }

  for (const line of lines) {
    const stocks = await supabaseSelect<StockRow>("warehouse_stock", {
      filters: {
        product_id: line.product_id,
        warehouse_id: order.destination_warehouse_id,
      },
    });
    const stock = stocks?.[0];
    if (!stock) continue;

    await supabasePatch(
      "warehouse_stock",
      { id: stock.id },
      {
        on_hand: Number(stock.on_hand) + Number(line.quantity),
        in_transit: Math.max(
          Number(stock.in_transit) - Number(line.quantity),
          0,
        ),
        synced_at: new Date().toISOString(),
      },
    );
  }

  await supabasePatch(
    "supply_orders",
    { id: order.id },
    { status: "received" },
  );
  await writeAudit(
    `Поставка ${order.code} принята`,
    "Остатки склада обновлены.",
    order.id,
  );

  return NextResponse.json({ ok: true, status: "received" });
}
