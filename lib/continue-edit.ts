import type { ModelId, Platform } from "@/lib/types";
import { isPlatform, parseModelId } from "@/lib/guards";

const STORAGE_KEY = "continue_edit_v1";

/** 从作品库「继续编辑」写入 sessionStorage 的载荷 */
export type ContinueEditPayload = {
  platform: Platform;
  scene: string | null;
  modelId: ModelId;
  prompt: string;
  completion: string;
};

export function saveContinueEditPayload(payload: ContinueEditPayload): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

/**
 * 首页挂载时读取并清除，避免刷新重复应用。
 */
export function consumeContinueEditPayload(): ContinueEditPayload | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(STORAGE_KEY);
  try {
    const j = JSON.parse(raw) as unknown;
    return parseContinueEditPayload(j);
  } catch {
    return null;
  }
}

function parseContinueEditPayload(data: unknown): ContinueEditPayload | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  if (typeof o.platform !== "string" || !isPlatform(o.platform)) return null;
  const modelId = parseModelId(o.modelId);
  if (!modelId) return null;
  if (typeof o.prompt !== "string") return null;
  if (typeof o.completion !== "string") return null;
  const scene =
    o.scene === null || o.scene === undefined
      ? null
      : typeof o.scene === "string"
        ? o.scene
        : null;

  return {
    platform: o.platform,
    scene,
    modelId,
    prompt: o.prompt,
    completion: o.completion,
  };
}
