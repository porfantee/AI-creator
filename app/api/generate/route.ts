import { getPrompt } from '@/lib/prompts';
import { buildStructuredGeneratePrompts } from '@/lib/prompts/structuredGenerate';
import { isPlatform, isGenerateMode } from '@/lib/guards';
import { streamUpstreamTextResponse } from '@/lib/llm/streamUpstreamResponse';
import { completeUpstreamText } from '@/lib/llm/completeUpstreamText';
import { parseStructuredContent } from '@/lib/structured/parse';
import { normalizeSceneForPlatform } from '@/lib/scenes';
import { DEFAULT_MODEL_ID, isModelId } from '@/lib/models';
import type { GenerateMode, ModelId, Platform, SceneId } from '@/lib/types';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      prompt?: string;
      platform?: string;
      modelId?: string;
      scene?: string | null;
      mode?: string;
    };

    const safePlatform: Platform =
      typeof body.platform === 'string' && isPlatform(body.platform) ? body.platform : 'xhs';
    const topic = typeof body.prompt === 'string' ? body.prompt : '';
    if (!topic.trim()) {
      return new Response(JSON.stringify({ error: '缺少 prompt' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    const mode: GenerateMode =
      typeof body.mode === 'string' && isGenerateMode(body.mode) ? body.mode : 'plain';

    const safeModelId: ModelId =
      typeof body.modelId === 'string' && isModelId(body.modelId) ? body.modelId : DEFAULT_MODEL_ID;

    if ((safeModelId === 'qwen-plus' || safeModelId === 'qwen-turbo') && !process.env.DASHSCOPE_API_KEY) {
      return new Response(JSON.stringify({ error: '缺少 DASHSCOPE_API_KEY' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    if (safeModelId === 'gpt-4o-mini' && !process.env.OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: '缺少 OPENAI_API_KEY' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    if (safeModelId === 'gemini-1.5-flash' && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return new Response(JSON.stringify({ error: '缺少 GOOGLE_GENERATIVE_AI_API_KEY' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    if (mode === 'structured') {
      const scene: SceneId = normalizeSceneForPlatform(
        safePlatform,
        typeof body.scene === 'string' ? body.scene : null
      );
      const { system, user } = buildStructuredGeneratePrompts(safePlatform, scene, topic);

      const upstreamAbort = new AbortController();
      const timeoutMs = Number(process.env.AI_TIMEOUT_MS ?? 90_000);
      const timeoutId = setTimeout(() => upstreamAbort.abort(), timeoutMs);
      const onReqAbort = () => upstreamAbort.abort();
      if (req.signal.aborted) onReqAbort();
      req.signal.addEventListener('abort', onReqAbort, { once: true });
      const cleanup = () => {
        clearTimeout(timeoutId);
        req.signal.removeEventListener('abort', onReqAbort);
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
              error: '结构化解析失败',
              ...(process.env.NODE_ENV === 'development' ? { rawPreview: raw.slice(0, 800) } : {}),
            },
            { status: 422 }
          );
        }
        return NextResponse.json({ mode: 'structured' as const, structured });
      } catch (e) {
        cleanup();
        console.error('structured 生成失败:', e);
        const msg = e instanceof Error ? e.message : '生成失败';
        return NextResponse.json({ error: msg }, { status: 502 });
      }
    }

    const system = getPrompt(safePlatform, body.scene ?? null);
    const user = `请为以下主题创作文案：${topic}`;

    return streamUpstreamTextResponse({
      req,
      modelId: safeModelId,
      system,
      user,
    });
  } catch (error) {
    console.error('后端报错详情:', error);
    return new Response(JSON.stringify({ error: '生成失败' }), { status: 500 });
  }
}
