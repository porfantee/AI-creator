import { getPrompt } from "@/lib/prompts";
import { isPlatform } from "@/lib/guards";
import { streamUpstreamTextResponse } from "@/lib/llm/streamUpstreamResponse";
import { DEFAULT_MODEL_ID, isModelId } from "@/lib/models";
import type { ModelId, Platform } from "@/lib/types";

function missingKeyResponse(key: string) {
  return new Response(JSON.stringify({ error: `缺少 ${key}` }), {
    status: 500,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function validateModelKey(modelId: ModelId): Response | null {
  if (
    (modelId === "qwen-plus" || modelId === "qwen-turbo") &&
    !process.env.DASHSCOPE_API_KEY
  ) {
    return missingKeyResponse("DASHSCOPE_API_KEY");
  }

  if (modelId === "gpt-4o-mini" && !process.env.OPENAI_API_KEY) {
    return missingKeyResponse("OPENAI_API_KEY");
  }

  if (
    modelId === "gemini-1.5-flash" &&
    !process.env.GOOGLE_GENERATIVE_AI_API_KEY
  ) {
    return missingKeyResponse("GOOGLE_GENERATIVE_AI_API_KEY");
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      prompt?: string;
      platform?: string;
      modelId?: string;
      scene?: string | null;
    };

    const safePlatform: Platform =
      typeof body.platform === "string" && isPlatform(body.platform)
        ? body.platform
        : "xhs";

    const topic = typeof body.prompt === "string" ? body.prompt : "";
    if (!topic.trim()) {
      return new Response(JSON.stringify({ error: "缺少 prompt" }), {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    const safeModelId: ModelId =
      typeof body.modelId === "string" && isModelId(body.modelId)
        ? body.modelId
        : DEFAULT_MODEL_ID;

    const keyError = validateModelKey(safeModelId);
    if (keyError) return keyError;

    const system = getPrompt(safePlatform, body.scene ?? null);
    const user = `请为以下主题创作文案：${topic}`;

    return streamUpstreamTextResponse({
      req,
      modelId: safeModelId,
      system,
      user,
    });
  } catch (error) {
    console.error("后端报错详情:", error);
    return new Response(JSON.stringify({ error: "生成失败" }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
}
