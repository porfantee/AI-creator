import { isPlatform } from "@/lib/guards";
import { isRewriteAction } from "@/lib/rewrite-actions";
import { buildRewriteMessages } from "@/lib/prompts/rewrite/build";
import { streamUpstreamTextResponse } from "@/lib/llm/streamUpstreamResponse";
import { DEFAULT_MODEL_ID, isModelId } from "@/lib/models";
import { normalizeSceneForPlatform } from "@/lib/scenes";
import type { ModelId, Platform, RewriteAction, SceneId } from "@/lib/types";

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
      platform?: string;
      scene?: string | null;
      modelId?: string;
      originalPrompt?: string;
      currentContent?: string;
      action?: string;
    };

    const actionRaw = body.action;
    if (typeof actionRaw !== "string" || !isRewriteAction(actionRaw)) {
      return new Response(JSON.stringify({ error: "无效 action" }), {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }
    const action = actionRaw as RewriteAction;

    const safePlatform: Platform =
      typeof body.platform === "string" && isPlatform(body.platform)
        ? body.platform
        : "xhs";

    const scene: SceneId = normalizeSceneForPlatform(
      safePlatform,
      typeof body.scene === "string" ? body.scene : null
    );

    const safeModelId: ModelId =
      typeof body.modelId === "string" && isModelId(body.modelId)
        ? body.modelId
        : DEFAULT_MODEL_ID;

    const originalPrompt =
      typeof body.originalPrompt === "string" ? body.originalPrompt : "";
    const currentContent =
      typeof body.currentContent === "string" ? body.currentContent : "";

    if (!currentContent.trim()) {
      return new Response(JSON.stringify({ error: "缺少 currentContent" }), {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    const keyError = validateModelKey(safeModelId);
    if (keyError) return keyError;

    const { system, user } = buildRewriteMessages(
      action,
      safePlatform,
      scene,
      originalPrompt,
      currentContent
    );

    return streamUpstreamTextResponse({
      req,
      modelId: safeModelId,
      system,
      user,
    });
  } catch (error) {
    console.error("rewrite 后端报错:", error);
    return new Response(JSON.stringify({ error: "改写失败" }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
}
