import { NextResponse } from "next/server";
import { supabaseSelect } from "@/lib/supabase-rest";

type CatalogRow = {
  id: string;
  catalog_index: number;
  sku: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  base_cost: number;
  revenue_30d: number;
  units_30d: number;
  profit_30d: number;
  ad_spend_30d: number;
  margin_30d: number;
  drr_30d: number;
  wb_revenue_30d: number;
  ozon_revenue_30d: number;
  wb_units_30d: number;
  ozon_units_30d: number;
  wb_stock: number;
  ozon_stock: number;
  wb_price: number;
  ozon_price: number;
  wb_rating: number;
  ozon_rating: number;
  wb_reviews: number;
  ozon_reviews: number;
  revenue_growth_pct: number;
  severity: string | null;
  incident_type: string | null;
  incident_title: string | null;
};

export async function GET() {
  const rows = await supabaseSelect<CatalogRow>("product_catalog_summary", {
    order: "revenue_30d.desc",
  });

  if (!rows) {
    return NextResponse.json(
      { error: "Catalog data is unavailable" },
      { status: 503 },
    );
  }

  return NextResponse.json({
    items: rows.map((row) => ({
      id: row.id,
      index: row.catalog_index,
      sku: row.sku,
      name: row.name,
      brand: row.brand,
      category: row.category,
      price: Number(row.price),
      cost: Number(row.base_cost),
      revenue30d: Number(row.revenue_30d),
      units30d: Number(row.units_30d),
      profit30d: Number(row.profit_30d),
      adSpend30d: Number(row.ad_spend_30d),
      margin30d: Number(row.margin_30d),
      drr30d: Number(row.drr_30d),
      wbRevenue30d: Number(row.wb_revenue_30d),
      ozonRevenue30d: Number(row.ozon_revenue_30d),
      wbUnits30d: Number(row.wb_units_30d),
      ozonUnits30d: Number(row.ozon_units_30d),
      wbStock: Number(row.wb_stock),
      ozonStock: Number(row.ozon_stock),
      wbPrice: Number(row.wb_price),
      ozonPrice: Number(row.ozon_price),
      wbRating: Number(row.wb_rating),
      ozonRating: Number(row.ozon_rating),
      wbReviews: Number(row.wb_reviews),
      ozonReviews: Number(row.ozon_reviews),
      growth: Number(row.revenue_growth_pct),
      severity: row.severity,
      incidentType: row.incident_type,
      incidentTitle: row.incident_title,
    })),
  });
}
