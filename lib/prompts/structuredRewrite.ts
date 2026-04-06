import type { Platform, RewriteAction, SceneId, StructuredContent } from "@/lib/types";
import { getPrompt } from "@/lib/prompts";
import { getSceneLabel } from "@/lib/scenes";

const PLATFORM_LABEL: Record<Platform, string> = {
  xhs: "小红书",
  weibo: "微博",
  zhihu: "知乎",
};

const JSON_CONTRACT = `【输出格式（必须严格遵守）】
你只允许输出**一个** JSON 对象，不要 markdown 代码块，不要任何前缀或后缀说明文字。
JSON 的键必须且仅为：
- title：字符串，标题；
- body：字符串，正文（允许使用 \\n 表示换行）；
- tags：字符串数组，每个元素为一个标签词，不要带 # 号。

标签数量建议 3～8 个。请确保 JSON 可被标准 JSON.parse 解析。`;

/**
 * 结构化文案的改写：输入当前 JSON 三字段，输出同结构的新 JSON。
 */
export function buildStructuredRewriteMessages(
  action: RewriteAction,
  platform: Platform,
  scene: SceneId,
  originalPrompt: string,
  structured: StructuredContent
): { system: string; user: string } {
  const styleGuide = getPrompt(platform, scene ?? null);
  const platformLabel = PLATFORM_LABEL[platform];
  const sceneLabel = getSceneLabel(platform, scene);
  const topic =
    originalPrompt.trim() || "（用户未填写单独主题，请以当前结构化内容本身为准）";
  const draftJson = JSON.stringify(structured, null, 2);

  if (action === "regenerate") {
    const system = `${styleGuide}

${JSON_CONTRACT}

【二次创作任务】
用户已有一版**结构化**文案（title / body / tags）。请基于**同一主题与上文创作规则**，再输出**一版全新**的 JSON：
- 切入点、结构或叙事应与上一版有明显差异，禁止只做同义词替换或小幅润色。
- 仍需满足该平台与场景下的格式与风格要求。
- 只输出 JSON 对象，不要解释。`;

    const user = `【用户原始需求 / 主题】
${topic}

【上一版结构化文案（勿照抄句子；可作信息与语气参考）】
${draftJson}`;

    return { system, user };
  }

  const contextBlock = `平台：${platformLabel}；场景：${sceneLabel}。
【原主题】${topic}

【当前结构化文案（JSON）】
${draftJson}`;

  if (action === "shorter") {
    const system = `${styleGuide}

${JSON_CONTRACT}

【改写任务】
在保留原意、关键信息与「${platformLabel}」常见调性的前提下，将 title、body **明显精简缩短**；tags 可酌情减少但仍要贴切。只输出改写后的 JSON，不要解释。`;
    return { system, user: contextBlock };
  }

  if (action === "colloquial") {
    const system = `${styleGuide}

${JSON_CONTRACT}

【改写任务】
将 title、body 改得更口语化、亲切、好读；tags 可略作口语化但仍为简短名词或短语。只输出改写后的 JSON，不要解释。`;
    return { system, user: contextBlock };
  }

  const system = `${styleGuide}

${JSON_CONTRACT}

【改写任务】
将 title、body 改得更正式、专业、条理清晰；tags 可更偏专业检索词。只输出改写后的 JSON，不要解释。`;
  return { system, user: contextBlock };
}
