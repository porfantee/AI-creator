import type { WorkCreateResponse, WorkListItem } from "@/lib/history-list";
import { getHistory } from "@/utils/history";

let guestMigrateTail: Promise<void> = Promise.resolve();

/** 串行执行，避免 React Strict Mode 或重复 effect 导致同一批本地记录 POST 两次 */
export function enqueueGuestHistoryMigration(task: () => Promise<void>): void {
  guestMigrateTail = guestMigrateTail.then(() => task()).catch((e) => {
    console.error("[enqueueGuestHistoryMigration]", e);
  });
}

/**
 * 将未登录时 localStorage 中的记录按从旧到新顺序 POST 到 /api/works。
 * @returns 未能写入数据库、需继续留在本地的条目（顺序与 getHistory 一致：新在前）
 */
export async function migrateLocalHistoryToCloud(): Promise<WorkListItem[]> {
  const local = getHistory();
  if (local.length === 0) return [];

  const failed: WorkListItem[] = [];
  const oldestFirst = [...local].reverse();

  for (const item of oldestFirst) {
    if (!item.prompt?.trim() || !item.completion?.trim()) {
      failed.push(item);
      continue;
    }
    try {
      const res = await fetch("/api/works", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          platform: item.platform,
          modelId: item.modelId,
          prompt: item.prompt,
          completion: item.completion,
          scene: item.scene ?? null,
          ...(item.structuredJson != null ? { structuredJson: item.structuredJson } : {}),
        }),
      });
      if (!res.ok) {
        failed.push(item);
        continue;
      }
      const data = (await res.json()) as WorkCreateResponse;
      if (!data?.work?.id) {
        failed.push(item);
      }
    } catch {
      failed.push(item);
    }
  }

  return failed.slice().reverse();
}
