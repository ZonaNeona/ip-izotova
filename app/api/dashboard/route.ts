import { NextResponse } from "next/server";
import {
  auditSeed,
  campaignsSeed,
  economicsRows,
  inventorySeed,
  reconciliationRows,
  reviewsSeed,
} from "@/lib/demo-data";
import { isSupabaseConfigured, supabaseSelect } from "@/lib/supabase-rest";

type Product = { id: string; sku: string; name: string };
type CampaignRow = {
  id: string;
  product_id: string;
  current_bid: number;
  recommended_bid: number;
  spend: number;
  ctr: number;
  cpc: number;
  orders: number;
  drr: number;
  target_drr: number;
};
type InventoryRow = {
  id: string;
  product_id: string;
  wb_stock: number;
  own_stock: number;
  daily_sales: number;
  days_left: number;
  recommended_supply: number;
};
type EconomicsRow = {
  product_id: string;
  price: number;
  discount: number;
  commission: number;
  logistics: number;
  storage: number;
  ads: number;
  cost: number;
  profit: number;
  margin: number;
};
type ReviewRow = {
  id: string;
  product_id: string;
  author: string;
  rating: number;
  body: string;
  classification: string;
  risk: string;
  ai_draft: string;
  policy: string;
  status: string;
};
type ReconciliationRow = {
  id: string;
  product_id: string;
  wb_value: number;
  erp_value: number;
  difference: number;
  wb_updated_at: string;
  erp_updated_at: string;
};
type AuditRow = {
  id: string;
  actor: string;
  action: string;
  result: string;
  tone: "success" | "warning" | "info";
  created_at: string;
};

function demoPayload() {
  return {
    mode: "demo" as const,
    campaigns: campaignsSeed,
    inventory: inventorySeed,
    economics: economicsRows,
    reviews: reviewsSeed,
    reconciliations: reconciliationRows,
    audit: auditSeed,
  };
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(demoPayload());
  }

  const [products, campaigns, inventory, economics, reviews, reconciliations, audit] =
    await Promise.all([
      supabaseSelect<Product>("products"),
      supabaseSelect<CampaignRow>("campaigns", { order: "updated_at.desc" }),
      supabaseSelect<InventoryRow>("inventory", { order: "days_left.asc" }),
      supabaseSelect<EconomicsRow>("unit_economics"),
      supabaseSelect<ReviewRow>("reviews", { order: "created_at.desc" }),
      supabaseSelect<ReconciliationRow>("reconciliations", { order: "checked_at.desc" }),
      supabaseSelect<AuditRow>("audit_log", { order: "created_at.desc" }),
    ]);

  if (!products || !campaigns || !inventory || !economics || !reviews || !reconciliations || !audit) {
    return NextResponse.json(demoPayload());
  }

  const productById = new Map(products.map((product) => [product.id, product]));

  return NextResponse.json({
    mode: "live",
    campaigns: campaigns.map((row) => ({
      id: row.id,
      product: productById.get(row.product_id)?.name ?? "Неизвестный товар",
      sku: productById.get(row.product_id)?.sku ?? "—",
      currentBid: row.current_bid,
      recommendedBid: row.recommended_bid,
      spend: Number(row.spend),
      ctr: Number(row.ctr),
      cpc: Number(row.cpc),
      orders: row.orders,
      drr: Number(row.drr),
      targetDrr: Number(row.target_drr),
    })),
    inventory: inventory.map((row) => ({
      id: row.id,
      productId: row.product_id,
      product: productById.get(row.product_id)?.name ?? "Неизвестный товар",
      sku: productById.get(row.product_id)?.sku ?? "—",
      wbStock: row.wb_stock,
      ownStock: row.own_stock,
      dailySales: Number(row.daily_sales),
      daysLeft: Number(row.days_left),
      recommendedSupply: row.recommended_supply,
    })),
    economics: economics.map((row) => ({
      sku: productById.get(row.product_id)?.sku ?? "—",
      product: productById.get(row.product_id)?.name ?? "Неизвестный товар",
      price: Number(row.price),
      discount: Number(row.discount),
      commission: Number(row.commission),
      logistics: Number(row.logistics),
      storage: Number(row.storage),
      ads: Number(row.ads),
      cost: Number(row.cost),
      profit: Number(row.profit),
      margin: Number(row.margin),
    })),
    reviews: reviews.map((row) => ({
      id: row.id,
      rating: row.rating,
      product: productById.get(row.product_id)?.name ?? "Неизвестный товар",
      author: row.author,
      text: row.body,
      classification: row.classification,
      risk: row.risk,
      draft: row.ai_draft,
      policy: row.policy,
      status: row.status,
    })),
    reconciliations: reconciliations.map((row) => ({
      id: row.id,
      sku: productById.get(row.product_id)?.sku ?? "—",
      wb: Number(row.wb_value),
      erp: Number(row.erp_value),
      diff: Number(row.difference),
      updated: [
        row.wb_updated_at ? new Date(row.wb_updated_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "—",
        row.erp_updated_at ? new Date(row.erp_updated_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "—",
      ].join(" / "),
    })),
    audit: audit.map((row) => ({
      id: row.id,
      time: new Date(row.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      actor: row.actor,
      action: row.action,
      result: row.result,
      tone: row.tone,
    })),
  });
}
