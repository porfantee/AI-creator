import type { StructuredContent } from "@/lib/types";

/** 用于 completion 字段、改写输入、纯文本预览 */
export function formatStructuredAsPlain(s: StructuredContent): string {
  const tagLine = s.tags.length
    ? s.tags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ")
    : "";
  const parts = [s.title, "", s.body];
  if (tagLine) {
    parts.push("", tagLine);
  }
  return parts.join("\n").trim();
}
