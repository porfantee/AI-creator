import type { StructuredContent } from "@/lib/types";

/** 去掉模型偶发包裹的 markdown 代码围栏 */
export function stripMarkdownJsonFence(raw: string): string {
  let t = raw.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }
  return t;
}

function normalizeStructuredShape(j: unknown): StructuredContent | null {
  if (!j || typeof j !== "object" || Array.isArray(j)) return null;
  const o = j as Record<string, unknown>;
  const title = typeof o.title === "string" ? o.title.trim() : "";
  const body = typeof o.body === "string" ? o.body.trim() : "";
  const tagsRaw = o.tags;
  const tags: string[] = Array.isArray(tagsRaw)
    ? tagsRaw
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  if (!title && !body) return null;
  return {
    title: title || "（无标题）",
    body,
    tags,
  };
}

/** 解析并校验模型输出为 StructuredContent；失败返回 null */
export function parseStructuredContent(raw: string): StructuredContent | null {
  try {
    const t = stripMarkdownJsonFence(raw);
    const j = JSON.parse(t) as unknown;
    return normalizeStructuredShape(j);
  } catch {
    return null;
  }
}

/** 将 Prisma / API 的 Json 字段安全转为 StructuredContent */
export function structuredFromUnknown(value: unknown): StructuredContent | null {
  if (value == null) return null;
  if (typeof value === "string") {
    return parseStructuredContent(value);
  }
  return normalizeStructuredShape(value);
}
