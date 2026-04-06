import type { Platform } from "@/lib/types";
import { isPlatform } from "@/lib/guards";
import { resolveSystemPrompt } from "./registry";

/**
 * 根据平台与场景返回系统提示词；非法 scene 在 registry 内已兜底到平台默认场景。
 */
export function getPrompt(
  platform: Platform | string,
  scene?: string | null
): string {
  const p: Platform = isPlatform(platform) ? platform : "xhs";
  return resolveSystemPrompt(p, scene ?? null);
}
