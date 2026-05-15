import type { StructuredContent } from "@/lib/types";

/** 段落拼成单一正文块（复制、CSV、completion 等） */
export function structuredContentAsPlainBody(s: StructuredContent): string {
  return s.content.join("\n\n");
}

/** 用于 completion 字段、改写输入、纯文本预览 */
export function formatStructuredAsPlain(s: StructuredContent): string {
  const tagLine = s.tags.length
    ? s.tags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ")
    : "";
  const bodyBlock = structuredContentAsPlainBody(s);
  const parts = [s.title, "", bodyBlock];
  if (tagLine) {
    parts.push("", tagLine);
  }
  return parts.join("\n").trim();
}
