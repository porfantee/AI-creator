import type { Platform } from "@/lib/types";
import { normalizeSceneForPlatform } from "@/lib/scenes";
import { XHS_SCENE_PROMPTS } from "./platforms/xhs";
import { WEIBO_SCENE_PROMPTS } from "./platforms/weibo";
import { ZHIHU_SCENE_PROMPTS } from "./platforms/zhihu";

const REGISTRY: Record<Platform, Record<string, string>> = {
  xhs: XHS_SCENE_PROMPTS,
  weibo: WEIBO_SCENE_PROMPTS,
  zhihu: ZHIHU_SCENE_PROMPTS,
};

export function resolveSystemPrompt(
  platform: Platform,
  scene: string | null | undefined
): string {
  const safeScene = normalizeSceneForPlatform(platform, scene);
  const table = REGISTRY[platform];
  const text = table[safeScene];
  if (typeof text === "string" && text.trim()) {
    return text.trim();
  }
  const fallback = normalizeSceneForPlatform(platform, null);
  return table[fallback]!.trim();
}
