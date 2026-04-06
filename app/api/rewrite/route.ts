import { NextResponse } from "next/server";
import { isGenerateMode, isPlatform } from "@/lib/guards";
import { isRewriteAction } from "@/lib/rewrite-actions";
import { buildRewriteMessages } from "@/lib/prompts/rewrite/build";
import { buildStructuredRewriteMessages } from "@/lib/prompts/structuredRewrite";
import { completeUpstreamText } from "@/lib/llm/completeUpstreamText";
import { streamUpstreamTextResponse } from "@/lib/llm/streamUpstreamResponse";
import { parseStructuredContent, structuredFromUnknown } from "@/lib/structured/parse";
import { DEFAULT_MODEL_ID, isModelId } from "@/lib/models";
import { normalizeSceneForPlatform } from "@/lib/scenes";
import type { ModelId, Platform, RewriteAction, SceneId } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      platform?: string;
      scene?: string | null;
      modelId?: string;
      originalPrompt?: string;
      currentContent?: string;
      action?: string;
      mode?: string;
      structuredJson?: unknown;
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

    const mode =
      typeof body.mode === "string" && isGenerateMode(body.mode)
        ? body.mode
        : "plain";

    if (mode === "structured") {
      const structuredIn = structuredFromUnknown(body.structuredJson);
      if (!structuredIn) {
        return new Response(JSON.stringify({ error: "缺少或无效 structuredJson" }), {
          status: 400,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        });
      }

      if (
        (safeModelId === "qwen-plus" || safeModelId === "qwen-turbo") &&
        !process.env.DASHSCOPE_API_KEY
      ) {
        return new Response(JSON.stringify({ error: "缺少 DASHSCOPE_API_KEY" }), {
          status: 500,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        });
      }

      if (safeModelId === "gpt-4o-mini" && !process.env.OPENAI_API_KEY) {
        return new Response(JSON.stringify({ error: "缺少 OPENAI_API_KEY" }), {
          status: 500,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        });
      }

      if (
        safeModelId === "gemini-1.5-flash" &&
        !process.env.GOOGLE_GENERATIVE_AI_API_KEY
      ) {
        return new Response(
          JSON.stringify({ error: "缺少 GOOGLE_GENERATIVE_AI_API_KEY" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json; charset=utf-8" },
          }
        );
      }

      const { system, user } = buildStructuredRewriteMessages(
        action,
        safePlatform,
        scene,
        originalPrompt,
        structuredIn
      );

      const upstreamAbort = new AbortController();
      const timeoutMs = Number(process.env.AI_TIMEOUT_MS ?? 90_000);
      const timeoutId = setTimeout(() => upstreamAbort.abort(), timeoutMs);
      const onReqAbort = () => upstreamAbort.abort();
      if (req.signal.aborted) onReqAbort();
      req.signal.addEventListener("abort", onReqAbort, { once: true });
      const cleanup = () => {
        clearTimeout(timeoutId);
        req.signal.removeEventListener("abort", onReqAbort);
      };

      try {
        const raw = await completeUpstreamText({
          modelId: safeModelId,
          system,
          user,
          signal: upstreamAbort.signal,
        });
        cleanup();
        const structured = parseStructuredContent(raw);
        if (!structured) {
          return NextResponse.json(
            {
              error: "结构化改写解析失败",
              ...(process.env.NODE_ENV === "development"
                ? { rawPreview: raw.slice(0, 800) }
                : {}),
            },
            { status: 422 }
          );
        }
        return NextResponse.json({ mode: "structured" as const, structured });
      } catch (e) {
        cleanup();
        console.error("structured 改写失败:", e);
        const msg = e instanceof Error ? e.message : "改写失败";
        return NextResponse.json({ error: msg }, { status: 502 });
      }
    }

    if (!currentContent.trim()) {
      return new Response(JSON.stringify({ error: "缺少 currentContent" }), {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    if (
      (safeModelId === "qwen-plus" || safeModelId === "qwen-turbo") &&
      !process.env.DASHSCOPE_API_KEY
    ) {
      return new Response(JSON.stringify({ error: "缺少 DASHSCOPE_API_KEY" }), {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    if (safeModelId === "gpt-4o-mini" && !process.env.OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "缺少 OPENAI_API_KEY" }), {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    if (
      safeModelId === "gemini-1.5-flash" &&
      !process.env.GOOGLE_GENERATIVE_AI_API_KEY
    ) {
      return new Response(
        JSON.stringify({ error: "缺少 GOOGLE_GENERATIVE_AI_API_KEY" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        }
      );
    }

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
    return new Response(JSON.stringify({ error: "改写失败" }), { status: 500 });
  }
}
