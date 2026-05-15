import type { StructuredContent, StructuredContentV1 } from "@/lib/types";

/** 显式解析结果，便于 API 与日志区分失败原因 */
export type StructuredParseFailureReason =
  | "invalid_shape"
  | "unsupported_version"
  | "empty_content";

export type StructuredParseResult =
  | { ok: true; data: StructuredContent }
  | {
      ok: false;
      reason: StructuredParseFailureReason;
      message: string;
    };

/** 去掉模型偶发包裹的 markdown 代码围栏 */
export function stripMarkdownJsonFence(raw: string): string {
  let t = raw.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }
  return t;
}

/** 旧版 body 字符串 → content 段落数组 */
function contentFromLegacyBody(body: string): string[] {
  const t = body.trim();
  if (!t) return [];
  const paras = t
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return paras.length > 0 ? paras : [t];
}

/**
 * 运行时类型守卫：是否为已标准化的 V1 结构（字段类型严格）。
 */
export function isStructuredContentV1(input: unknown): input is StructuredContentV1 {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const o = input as Record<string, unknown>;
  if (o.schemaVersion !== 1) return false;
  if (typeof o.title !== "string") return false;
  if (!Array.isArray(o.content)) return false;
  if (!o.content.every((x) => typeof x === "string")) return false;
  if (!Array.isArray(o.tags)) return false;
  if (!o.tags.every((x) => typeof x === "string")) return false;
  return true;
}

/**
 * 将模型或存储中的未知对象修成可接受的 V1；无法修则返回 null。
 * - title 非字符串视为空串
 * - content 可为字符串（转单项数组）、字符串数组；与 legacy `body` 二选一/兼容
 * - tags 仅保留字符串项，trim 并去掉空串
 */
export function normalizeStructuredContentV1(
  input: unknown
): StructuredContentV1 | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const o = input as Record<string, unknown>;

  const title = typeof o.title === "string" ? o.title.trim() : "";

  let content: string[] | null = null;

  if ("content" in o && o.content !== undefined) {
    const c = o.content;
    if (typeof c === "string") {
      const t = c.trim();
      content = t ? [t] : [];
    } else if (Array.isArray(c)) {
      content = c
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (c != null) {
      return null;
    }
  }

  if (content === null) {
    if (typeof o.body === "string") {
      content = contentFromLegacyBody(o.body);
    } else {
      return null;
    }
  }

  const tagsRaw = o.tags;
  const tags: string[] = Array.isArray(tagsRaw)
    ? tagsRaw
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  if (!title && content.length === 0) return null;

  return {
    schemaVersion: 1,
    title: title || "（无标题）",
    content,
    tags,
  };
}

function inferStructuredParseFailure(parsed: unknown): StructuredParseResult {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      ok: false,
      reason: "invalid_shape",
      message: "顶层必须是 JSON 对象",
    };
  }
  const o = parsed as Record<string, unknown>;

  if ("content" in o && o.content !== undefined && o.content !== null) {
    const c = o.content;
    if (typeof c !== "string" && !Array.isArray(c)) {
      return {
        ok: false,
        reason: "invalid_shape",
        message: "content 必须是字符串或字符串数组",
      };
    }
  }

  const recognizable =
    "title" in o ||
    "body" in o ||
    "content" in o ||
    "tags" in o ||
    o.schemaVersion !== undefined;

  if (recognizable) {
    return {
      ok: false,
      reason: "empty_content",
      message: "标题与正文均为空",
    };
  }

  return {
    ok: false,
    reason: "invalid_shape",
    message: "缺少有效的结构化字段（title / content / body）",
  };
}

/**
 * 版本迁移入口：当前仅支持 schemaVersion === 1，及无版本号的 legacy（title/body/tags 或 content）。
 * 未来可在此分支 v2 → v1 等。
 */
export function upgradeStructuredContent(input: unknown): StructuredContent | null {
  if (input == null) return null;
  if (typeof input !== "object" || Array.isArray(input)) return null;
  const o = input as Record<string, unknown>;
  const sv = o.schemaVersion;

  if (sv !== undefined && sv !== null) {
    if (typeof sv !== "number") return null;
    if (sv !== 1) return null;
  }

  return normalizeStructuredContentV1(input);
}

/**
 * 解析（字符串 JSON 或已解析对象）+ 校验版本 + 标准化。
 */
export function parseStructuredContent(input: unknown): StructuredParseResult {
  let parsed: unknown;
  if (typeof input === "string") {
    try {
      const t = stripMarkdownJsonFence(input);
      parsed = JSON.parse(t) as unknown;
    } catch {
      return {
        ok: false,
        reason: "invalid_shape",
        message: "JSON 解析失败",
      };
    }
  } else {
    parsed = input;
  }

  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      ok: false,
      reason: "invalid_shape",
      message: "顶层必须是 JSON 对象",
    };
  }

  const o = parsed as Record<string, unknown>;
  const sv = o.schemaVersion;

  if (sv !== undefined && sv !== null) {
    if (typeof sv !== "number") {
      return {
        ok: false,
        reason: "unsupported_version",
        message: "schemaVersion 必须是数字",
      };
    }
    if (sv !== 1) {
      return {
        ok: false,
        reason: "unsupported_version",
        message: `不支持的 schemaVersion: ${sv}`,
      };
    }
  }

  const data = normalizeStructuredContentV1(parsed);
  if (data) {
    return { ok: true, data };
  }

  return inferStructuredParseFailure(parsed);
}

/** 将 Prisma / API 的 Json 字段安全转为 StructuredContent（含 legacy） */
export function structuredFromUnknown(value: unknown): StructuredContent | null {
  const r = parseStructuredContent(value);
  return r.ok ? r.data : null;
}
