import { NextResponse } from "next/server";
import { supabasePatch, supabaseSelect } from "@/lib/supabase-rest";

type DraftRow = {
  id: string;
  product_id: string;
  target_channel: string;
  status: string;
  title: string | null;
  description: string | null;
  bullets: string[];
  attributes: unknown;
  search_phrases: string[];
  research_enabled: boolean;
  research_summary: string | null;
  research_sources: unknown;
  visual_style: unknown;
  source_image_url: string | null;
  generated_at: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

type MediaRow = {
  id: string;
  draft_id: string;
  media_kind: string;
  aspect_ratio: string | null;
  public_url: string | null;
  source_media_id: string | null;
  mode: string;
  cost: number | null;
  latency_ms: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const draftId = url.searchParams.get("id");

  if (!draftId) {
    return NextResponse.json(
      { error: "Не указан черновик." },
      { status: 400 },
    );
  }

  const drafts = await supabaseSelect<DraftRow>("product_card_drafts", {
    filters: { id: draftId },
  });
  const draft = drafts?.[0];

  if (!draft) {
    return NextResponse.json({ error: "Черновик не найден." }, { status: 404 });
  }

  const media =
    (await supabaseSelect<MediaRow>("product_studio_media", {
      filters: { draft_id: draft.id },
      order: "created_at.asc",
    })) ?? [];

  return NextResponse.json({ draft, media });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    id?: string;
    title?: string;
    description?: string;
    bullets?: string[];
    attributes?: unknown;
    searchPhrases?: string[];
    status?: "draft" | "review" | "approved";
  };

  if (!body.id) {
    return NextResponse.json(
      { error: "Не указан черновик." },
      { status: 400 },
    );
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body.title !== undefined) patch.title = body.title;
  if (body.description !== undefined) patch.description = body.description;
  if (body.bullets !== undefined) patch.bullets = body.bullets;
  if (body.attributes !== undefined) patch.attributes = body.attributes;
  if (body.searchPhrases !== undefined) {
    patch.search_phrases = body.searchPhrases;
  }
  if (body.status !== undefined) {
    patch.status = body.status;
    if (body.status === "approved") {
      patch.approved_at = new Date().toISOString();
    }
  }

  const updated = await supabasePatch<DraftRow>(
    "product_card_drafts",
    { id: body.id },
    patch,
  );

  if (!updated?.[0]) {
    return NextResponse.json(
      { error: "Не удалось сохранить черновик." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, draft: updated[0] });
}
