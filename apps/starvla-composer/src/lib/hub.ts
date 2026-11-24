import { CATALOG } from "./data";

export const HUB_BASE = "https://huggingface.co/api";
export const OFFICIAL_IDS = new Set(CATALOG.map((e) => e.id));

export interface HubModel {
  id: string;
  lastModified: string | null;
  createdAt: string | null;
  downloads: number | null;
  likes: number | null;
  pipelineTag: string | null;
  baseModels: string[];
}

export type HubResult =
  | { ok: true; live: true; fetchedAt: string; model: HubModel }
  | { ok: false; live: false; fetchedAt: string; reason: string };

export type HubListResult =
  | { ok: true; live: true; fetchedAt: string; count: number; ids: string[]; added: string[]; missing: string[] }
  | { ok: false; live: false; fetchedAt: string; reason: string };

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown) => (typeof v === "string" && v.length > 0 ? v : null);

/** Parse one /api/models/{id} payload. Returns null when the payload is not a StarVLA model record. */
export function parseHubModel(payload: unknown): HubModel | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const id = str(p.id) ?? str(p.modelId);
  if (!id || !id.startsWith("StarVLA/")) return null;
  const tags = Array.isArray(p.tags) ? p.tags.filter((t): t is string => typeof t === "string") : [];
  return {
    id,
    lastModified: str(p.lastModified),
    createdAt: str(p.createdAt),
    downloads: num(p.downloads),
    likes: num(p.likes),
    pipelineTag: str(p.pipeline_tag),
    baseModels: tags.filter((t) => t.startsWith("base_model:") && !t.startsWith("base_model:finetune:")).map((t) => t.slice(11)),
  };
}

/** Parse /api/models?author=StarVLA. Compares live ids to the vendored 45-model snapshot. */
export function parseHubList(payload: unknown): { ids: string[]; added: string[]; missing: string[] } | null {
  if (!Array.isArray(payload)) return null;
  const ids = payload
    .map((m) => (m && typeof m === "object" ? str((m as Record<string, unknown>).id) : null))
    .filter((id): id is string => !!id && id.startsWith("StarVLA/"));
  const live = new Set(ids);
  return {
    ids,
    added: ids.filter((id) => !OFFICIAL_IDS.has(id)),
    missing: [...OFFICIAL_IDS].filter((id) => !live.has(id)),
  };
}

/** Only vendored official ids may be looked up, so the route can never become an open proxy. */
export function isOfficialRepo(id: string): boolean {
  return OFFICIAL_IDS.has(id);
}
