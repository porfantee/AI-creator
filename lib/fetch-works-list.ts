import {
  workApiRowToListItem,
  type WorksListResponse,
  type WorkListItem,
} from "@/lib/history-list";
import { WORKS_PAGE_SIZE } from "@/lib/works-pagination";

export type FetchWorksListResult =
  | { ok: true; items: WorkListItem[]; hasMore: boolean }
  | { ok: false; kind: "unauthorized" | "http" | "parse" | "network"; status?: number };

function parseWorksPayload(data: unknown): {
  items: WorkListItem[];
  hasMore: boolean;
} | null {
  if (!data || typeof data !== "object") return null;
  const rec = data as WorksListResponse;
  if (!Array.isArray(rec.works)) return null;
  const items = rec.works
    .map(workApiRowToListItem)
    .filter((x): x is WorkListItem => x != null);
  const hasMore = rec.hasMore === true;
  return { items, hasMore };
}

/** 分页拉取（首页、作品库、加载更多） */
export async function fetchWorksPageFromApi(options: {
  offset: number;
  limit?: number;
}): Promise<FetchWorksListResult> {
  const limit = options.limit ?? WORKS_PAGE_SIZE;
  const offset = Math.max(0, options.offset);
  const qs = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  try {
    const res = await fetch(`/api/works?${qs}`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (res.status === 401) return { ok: false, kind: "unauthorized" };
    if (!res.ok) return { ok: false, kind: "http", status: res.status };
    const data = (await res.json()) as unknown;
    const parsed = parseWorksPayload(data);
    if (!parsed) return { ok: false, kind: "parse" };
    return { ok: true, items: parsed.items, hasMore: parsed.hasMore };
  } catch {
    return { ok: false, kind: "network" };
  }
}

/**
 * 全量拉取（仅迁移等）：请求不带 limit，服务端最多 WORKS_FULL_FETCH_MAX 条。
 */
export async function fetchWorksListFullFromApi(): Promise<FetchWorksListResult> {
  try {
    const res = await fetch("/api/works", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (res.status === 401) return { ok: false, kind: "unauthorized" };
    if (!res.ok) return { ok: false, kind: "http", status: res.status };
    const data = (await res.json()) as unknown;
    const parsed = parseWorksPayload(data);
    if (!parsed) return { ok: false, kind: "parse" };
    return { ok: true, items: parsed.items, hasMore: parsed.hasMore };
  } catch {
    return { ok: false, kind: "network" };
  }
}
