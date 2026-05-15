import type {
  StructuredParseFailureReason,
  StructuredParseResult,
} from "@/lib/structured/parse";

/** 客户端对 parseStructuredContent 失败的可读文案（与 reason 对齐） */
export function messageForStructuredParseFailure(
  result: Extract<StructuredParseResult, { ok: false }>
): string {
  switch (result.reason) {
    case "unsupported_version":
      return "当前结果版本暂不支持，请重新生成";
    case "empty_content":
      return "结构化结果缺少有效正文，请重试";
    case "invalid_shape":
    default:
      return "结构化结果格式异常，请重试";
  }
}

/** API 422 返回的 reason / detail / error → 用户可见文案 */
export function messageForStructuredHttp422(body: unknown): string {
  if (!body || typeof body !== "object") {
    return "结构化请求失败，请稍后重试。";
  }
  const o = body as {
    reason?: string;
    detail?: string;
    error?: string;
  };
  const r = o.reason as StructuredParseFailureReason | undefined;
  if (r === "unsupported_version") {
    return "当前结果版本暂不支持，请重新生成";
  }
  if (r === "empty_content") {
    return "结构化结果缺少有效正文，请重试";
  }
  if (r === "invalid_shape") {
    return "结构化结果格式异常，请重试";
  }
  return (typeof o.detail === "string" && o.detail.trim()
    ? o.detail
    : typeof o.error === "string" && o.error.trim()
      ? o.error
      : null) ?? "结构化请求失败，请稍后重试。";
}
