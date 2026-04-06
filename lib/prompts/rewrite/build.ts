import type { Platform, RewriteAction, SceneId } from "@/lib/types";
import { getPrompt } from "@/lib/prompts";
import { getSceneLabel } from "@/lib/scenes";

const PLATFORM_LABEL: Record<Platform, string> = {
  xhs: "小红书",
  weibo: "微博",
  zhihu: "知乎",
};

/**
 * 根据改写动作构造 system / user，与「从零生成」的 getPrompt 分离维护。
 */
export function buildRewriteMessages(
  action: RewriteAction,
  platform: Platform,
  scene: SceneId,
  originalPrompt: string,
  currentContent: string
): { system: string; user: string } {
  const platformLabel = PLATFORM_LABEL[platform];
  const sceneLabel = getSceneLabel(platform, scene);
  const topic = originalPrompt.trim() || "（用户未填写单独主题，请以正文本身为准）";

  if (action === "regenerate") {
    const base = getPrompt(platform, scene);
    const system = `${base}

【二次创作任务】
用户已有一版文案。请基于**同一主题与上文创作规则**，再写**一版全新文案**：
- 切入点、结构或叙事应与上一版有明显差异，禁止只做同义词替换或小幅润色。
- 仍需满足该平台与场景下的格式与风格要求。
- 只输出新版本正文，不要解释。`;

    const user = `【用户原始需求 / 主题】
${topic}

【上一版文案（勿照抄句子；可作信息与语气参考）】
${currentContent}`;

    return { system, user };
  }

  const contextBlock = `平台：${platformLabel}；场景：${sceneLabel}。
【原主题】${topic}

--- 待改文稿 ---
${currentContent}
----------------`;

  if (action === "shorter") {
    return {
      system: `你是一位资深文案编辑。任务：在保留原意、关键信息与「${platformLabel}」常见调性的前提下，将用户给出的文稿明显精简缩短。可删冗余修辞，不可遗漏核心卖点或观点。只输出改写后的正文，不要解释。`,
      user: contextBlock,
    };
  }

  if (action === "colloquial") {
    return {
      system: `你是一位资深文案编辑。任务：将用户给出的文稿改得更口语化、亲切、好读，像真人在说话，仍符合「${platformLabel}」上常见的表达方式。保留核心信息。只输出改写后的正文，不要解释。`,
      user: contextBlock,
    };
  }

  // professional
  return {
    system: `你是一位资深文案编辑。任务：将用户给出的文稿改得更正式、专业、条理清晰，适合「${platformLabel}」上偏严肃、可信的语境。保留事实与结论，避免口水化。只输出改写后的正文，不要解释。`,
    user: contextBlock,
  };
}
