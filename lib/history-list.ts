import type { ModelId, Platform, StructuredContent } from "@/lib/types";
import { isPlatform, parseModelId } from "@/lib/guards";
import { structuredFromUnknown } from "@/lib/structured/parse";

/**
 * 历史面板 / 作品列表统一项（本地 localStorage 与云端 `/api/works` 在 UI 层共用）。
 */
export type WorkListItem = {
  id: string;
  platform: Platform;
  modelId: ModelId;
  prompt: string;
  completion: string;
  /** 毫秒时间戳，与现有 formatTime 一致 */
  createdAt: number;
  scene?: string | null;
  structuredJson?: StructuredContent | null;
};

/** @deprecated 语义上请优先使用 WorkListItem；保留别名以免大范围重命名 */
export type HistoryListItem = WorkListItem;

/** GET /api/works 200 响应体 */
export type WorksListResponse = {
  works: WorkApiRow[];
  /** 分页时存在；未传 limit 的全量响应为 false */
  hasMore?: boolean;
};

/** POST /api/works 201 响应体 */
export type WorkCreateResponse = {
  work: WorkApiRow;
};

export type WorkApiRow = {
  id: string;
  userId: string;
  platform: string;
  scene: string | null;
  modelId: string;
  prompt: string;
  completion: string;
  structuredJson?: unknown | null;
  createdAt: string;
  updatedAt: string;
};

/** 校验 API 字符串字段，非法组合返回 null（避免脏数据进 UI） */
export function workApiRowToListItem(w: WorkApiRow): WorkListItem | null {
  if (!isPlatform(w.platform)) return null;
  const modelId = parseModelId(w.modelId);
  if (!modelId) return null;
  const structuredJson = structuredFromUnknown(w.structuredJson ?? null);
  return {
    id: w.id,
    platform: w.platform,
    modelId,
    prompt: w.prompt,
    completion: w.completion,
    createdAt: new Date(w.createdAt).getTime(),
    scene: w.scene,
    structuredJson: structuredJson ?? undefined,
  };
}
