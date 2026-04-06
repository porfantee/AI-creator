import type { GenerateMode, ModelId, Platform } from "@/lib/types";
import { isModelId } from "@/lib/models";

export function isPlatform(value: string): value is Platform {
  return value === "xhs" || value === "weibo" || value === "zhihu";
}

export function parseModelId(value: unknown): ModelId | null {
  return typeof value === "string" && isModelId(value) ? value : null;
}

export function isGenerateMode(value: string): value is GenerateMode {
  return value === "plain" || value === "structured";
}
