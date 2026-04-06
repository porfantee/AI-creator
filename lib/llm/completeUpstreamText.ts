import { generateText } from "ai";
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

export type CompleteUpstreamArgs = {
  modelId: ModelId;
  system: string;
  user: string;
  signal: AbortSignal;
};

/**
 * 非流式：拉取完整文本。Qwen 仍走 streamQwen + SSE 解析器累积 delta（不修改 qwen.ts / parser 实现）。
 */
export async function completeUpstreamText({
  modelId,
  system,
  user,
  signal,
}: CompleteUpstreamArgs): Promise<string> {
  if (modelId === "qwen-plus" || modelId === "qwen-turbo") {
    const resp = await streamQwen(system, user, signal, modelId);
    if (!resp.ok) {
      const errBody = await resp.text().catch(() => "");
      let message = "DashScope 调用失败";
      if (resp.status === 401) {
        message =
          "DashScope 返回 401：请检查 DASHSCOPE_API_KEY 与模型开通情况，修改后需重启 dev。";
      } else if (resp.status === 403) {
        message = "DashScope 返回 403：无权限或未开通对应模型。";
      } else if (resp.status === 429) {
        message = "DashScope 返回 429：请求过于频繁或额度不足。";
      } else if (resp.status >= 500) {
        message = "DashScope 服务端异常，请稍后重试。";
      }
      throw new Error(
        process.env.NODE_ENV === "development" && errBody
          ? `${message} ${errBody.slice(0, 200)}`
          : message
      );
    }
    if (!resp.body) {
      throw new Error("DashScope 响应体为空");
    }

    const decoder = new TextDecoder();
    const reader = resp.body.getReader();
    const parser = createSSETextDeltaParser();
    let full = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const { done: sseDone, data } = parser.feed(chunk);
          for (const d of data) full += d;
          if (sseDone) break;
        }
      }
      const flushed = parser.flush();
      for (const d of flushed.data) full += d;
    } finally {
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
    }

    return full;
  }

  const { text } = await generateText({
    model: resolveSdkModel(modelId),
    system,
    prompt: user,
    abortSignal: signal,
  });

  return text ?? "";
}
