import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamQwen } from "@/lib/llm/qwen";
import { createSSETextDeltaParser } from "@/lib/sse/parser";
import type { ModelId } from "@/lib/types";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

function resolveSdkModel(modelId: ModelId) {
  switch (modelId) {
    case "gpt-4o-mini":
      return openai(modelId);
    case "gemini-1.5-flash":
      return google(modelId);
    default:
      return openai("gpt-4o-mini");
  }
}

export type StreamUpstreamArgs = {
  req: Request;
  modelId: ModelId;
  system: string;
  user: string;
};

/**
 * 统一 Qwen（SSE 手动解析）与 OpenAI / Google（AI SDK 文本流）出口，供 /api/generate 与 /api/rewrite 复用。
 * 不修改 qwen.ts、sse/parser 实现，仅复用调用方式。
 */
export async function streamUpstreamTextResponse({
  req,
  modelId,
  system,
  user,
}: StreamUpstreamArgs): Promise<Response> {
  const upstreamAbort = new AbortController();
  const timeoutMs = Number(process.env.AI_TIMEOUT_MS ?? 90_000);
  const timeoutId = setTimeout(() => upstreamAbort.abort(), timeoutMs);

  const abortOnClientDisconnect = () => upstreamAbort.abort();
  if (req.signal.aborted) abortOnClientDisconnect();
  req.signal.addEventListener("abort", abortOnClientDisconnect, { once: true });

  const cleanup = () => {
    clearTimeout(timeoutId);
    req.signal.removeEventListener("abort", abortOnClientDisconnect);
  };

  if (modelId === "qwen-plus" || modelId === "qwen-turbo") {
    let resp: Response;
    try {
      resp = await streamQwen(system, user, upstreamAbort.signal, modelId);
    } catch (e) {
      cleanup();
      const raw =
        e instanceof Error
          ? e.message
          : typeof e === "string"
            ? e
            : "上游网络请求失败";
      const hint =
        /timeout|timed out|fetch failed|ECONNRESET|ECONNREFUSED|ENOTFOUND|network/i.test(
          raw
        )
          ? "无法连接阿里云 DashScope（常见：网络/代理/防火墙导致超时）。请检查本机网络、HTTP(S)_PROXY、或稍后重试。"
          : raw;
      return new Response(
        JSON.stringify({
          error: "生成失败",
          message: hint,
          ...(process.env.NODE_ENV === "development" ? { detail: raw } : {}),
        }),
        {
          status: 502,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        }
      );
    }

    if (!resp.ok) {
      cleanup();
      const text = await resp.text().catch(() => "");
      console.error("DashScope 请求失败:", resp.status, text);

      let message = "DashScope 调用失败";
      if (resp.status === 401) {
        message =
          "DashScope 返回 401：API Key 无效或未授权。请检查 .env.local 里的 DASHSCOPE_API_KEY 是否正确、是否已开通该模型，修改后需重启 npm run dev。";
      } else if (resp.status === 403) {
        message =
          "DashScope 返回 403：无权限或账号未开通对应模型，请到阿里云百炼控制台确认。";
      } else if (resp.status === 429) {
        message = "DashScope 返回 429：请求过于频繁或额度不足，请稍后再试。";
      } else if (resp.status >= 500) {
        message = "DashScope 服务端异常，请稍后重试。";
      }

      return new Response(
        JSON.stringify({
          error: "生成失败",
          status: resp.status,
          message,
          ...(process.env.NODE_ENV === "development" && text
            ? { upstream: text.slice(0, 500) }
            : {}),
        }),
        {
          status: 502,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        }
      );
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        if (!resp.body) {
          cleanup();
          controller.close();
          return;
        }

        const reader = resp.body.getReader();
        const parser = createSSETextDeltaParser();

        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) {
              const textChunk = decoder.decode(value, { stream: true });
              const { done: sseDone, data } = parser.feed(textChunk);
              for (const delta of data) controller.enqueue(encoder.encode(delta));
              if (sseDone) {
                upstreamAbort.abort();
                return;
              }
            }
          }
          const flushed = parser.flush();
          for (const delta of flushed.data) controller.enqueue(encoder.encode(delta));
          if (flushed.done) upstreamAbort.abort();
        } finally {
          cleanup();
          try {
            await reader.cancel();
          } catch {
            /* ignore */
          }
          controller.close();
        }
      },
      cancel() {
        upstreamAbort.abort();
        cleanup();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  }

  const result = streamText({
    model: resolveSdkModel(modelId),
    system,
    prompt: user,
    abortSignal: upstreamAbort.signal,
  });

  void result.text.then(
    () => cleanup(),
    () => cleanup()
  );

  return result.toTextStreamResponse({
    status: 200,
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
