import type { Platform, SceneId } from "@/lib/types";

export type SceneOption = {
  id: SceneId;
  label: string;
};

/** 单一配置源：平台 → 场景列表（顺序第一项为默认场景） */
export const PLATFORM_SCENES: Record<Platform, readonly SceneOption[]> = {
  xhs: [
    { id: "xhs_seed", label: "种草好物" },
    { id: "xhs_daily", label: "日常分享" },
    { id: "xhs_guide", label: "攻略教程" },
  ],
  weibo: [
    { id: "weibo_hot", label: "热点短评" },
    { id: "weibo_notice", label: "活动预告" },
    { id: "weibo_story", label: "故事长文" },
  ],
  zhihu: [
    { id: "zhihu_qa", label: "问答回答" },
    { id: "zhihu_essay", label: "观点长文" },
    { id: "zhihu_explainer", label: "科普解释" },
  ],
} as const;

const PLATFORM_SCENE_IDS: Record<Platform, ReadonlySet<string>> = {
  xhs: new Set(PLATFORM_SCENES.xhs.map((s) => s.id)),
  weibo: new Set(PLATFORM_SCENES.weibo.map((s) => s.id)),
  zhihu: new Set(PLATFORM_SCENES.zhihu.map((s) => s.id)),
};

export function getSceneOptions(platform: Platform): SceneOption[] {
  return [...PLATFORM_SCENES[platform]];
}

export function getDefaultScene(platform: Platform): SceneId {
  return PLATFORM_SCENES[platform][0].id;
}

export function getSceneLabel(platform: Platform, sceneId: string): string {
  const list = PLATFORM_SCENES[platform];
  const hit = list.find((s) => s.id === sceneId);
  return hit?.label ?? sceneId;
}

export function isSceneIdForPlatform(platform: Platform, value: string): value is SceneId {
  return PLATFORM_SCENE_IDS[platform].has(value);
}

/**
 * 将任意字符串规范到当前平台下的合法 SceneId；非法或空则回退默认场景。
 * raw 为空、或不是该平台下的场景 id（
 * 例如从小红书切到微博，原来还是 xhs_seed）→ 改成该平台第一个默认场景（getDefaultScene(platform)）。
 */
export function normalizeSceneForPlatform(
  platform: Platform,
  raw: string | null | undefined
): SceneId {
  if (raw && isSceneIdForPlatform(platform, raw)) {
    return raw;
  }
  return getDefaultScene(platform);
}
