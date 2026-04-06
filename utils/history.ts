import { DEFAULT_MODEL_ID } from "@/lib/models";
import type { WorkListItem } from "@/lib/history-list";
import { structuredFromUnknown } from "@/lib/structured/parse";

/** 与 `WorkListItem` 同形，本地历史专用导出名 */
export type HistoryItem = WorkListItem;

const STORAGE_KEY = "history_v2";
const MAX_ITEMS = 20;

function safeParse(raw: string | null): unknown {
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveHistory(item: Omit<HistoryItem, "id" | "createdAt">) {
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = safeParse(raw);
  const list: HistoryItem[] = Array.isArray(parsed) ? (parsed as HistoryItem[]) : [];

  const record: HistoryItem = {
    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    createdAt: Date.now(),
    ...item,
  };

  list.unshift(record);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_ITEMS)));
}

export function getHistory(): HistoryItem[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = safeParse(raw);

  if (Array.isArray(parsed)) {
    if (parsed.length > 0 && typeof parsed[0] === "string") {
      return (parsed as string[]).map((prompt, idx) => ({
        id: `legacy_${idx}`,
        platform: "xhs",
        modelId: DEFAULT_MODEL_ID,
        prompt,
        completion: "",
        createdAt: Date.now(),
      }));
    }
    return (parsed as Array<Partial<HistoryItem>>).map((item, idx) => ({
      id: item.id ?? `legacy_obj_${idx}`,
      platform: item.platform ?? "xhs",
      modelId: item.modelId ?? DEFAULT_MODEL_ID,
      prompt: item.prompt ?? "",
      completion: item.completion ?? "",
      createdAt: item.createdAt ?? Date.now(),
      scene:
        item.scene === null
          ? null
          : typeof item.scene === "string"
            ? item.scene
            : undefined,
      structuredJson: structuredFromUnknown(item.structuredJson ?? null) ?? undefined,
    }));
  }

  return [];
}

export function deleteHistory(id: string) {
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = safeParse(raw);
  const list: HistoryItem[] = Array.isArray(parsed) ? (parsed as HistoryItem[]) : [];
  const next = list.filter((x) => x?.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(0, MAX_ITEMS)));
}

export function clearHistory() {
  localStorage.removeItem(STORAGE_KEY);
}

/** 用完整列表覆盖本地历史（用于登录迁移后仅保留失败项） */
export function replaceHistory(list: HistoryItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_ITEMS)));
}
