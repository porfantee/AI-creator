import type { Platform, SceneId } from "@/lib/types";
import { getPrompt } from "@/lib/prompts";

/**
 * 结构化生成专用 system / user，与 plain 流式生成的 user 文案分离。
 */
export function buildStructuredGeneratePrompts(
  platform: Platform,
  scene: SceneId,
  topic: string
): { system: string; user: string } {
  const styleGuide = getPrompt(platform, scene ?? null);

  const system = `${styleGuide}

【输出格式（必须严格遵守）】
你只允许输出**一个** JSON 对象，不要 markdown 代码块，不要任何前缀或后缀说明文字。
JSON 的键必须且仅为：
- title：字符串，标题；
- body：字符串，正文（允许使用 \\n 表示换行）；
- tags：字符串数组，每个元素为一个标签词，不要带 # 号。

标签数量建议 3～8 个。请确保 JSON 可被标准 JSON.parse 解析。`;

  const user = `用户主题为：「${topic}」
请严格遵循上述平台与场景的创作规则，并只输出符合格式的 JSON 对象。`;

  return { system, user };
}
