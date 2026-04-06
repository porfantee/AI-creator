import type { ModelId } from "@/lib/types";

export type ModelOption = {
  id: ModelId;
  label: string;
  provider: "dashscope" | "openai" | "google";
};

export const DEFAULT_MODEL_ID: ModelId = "qwen-plus";

export const MODEL_OPTIONS: ModelOption[] = [
  { id: "qwen-plus", label: "Qwen Plus（DashScope）", provider: "dashscope" },
  { id: "qwen-turbo", label: "Qwen Turbo（DashScope）", provider: "dashscope" },
  { id: "gpt-4o-mini", label: "GPT-4o mini（OpenAI）", provider: "openai" },
  { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash（Google）", provider: "google" },
];

export function isModelId(value: string): value is ModelId {
  return MODEL_OPTIONS.some((m) => m.id === value);
}

export function getModelOption(modelId: ModelId): ModelOption {
  return MODEL_OPTIONS.find((m) => m.id === modelId) ?? MODEL_OPTIONS[0];
}

