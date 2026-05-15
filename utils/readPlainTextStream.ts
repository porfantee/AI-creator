import type { MutableRefObject } from "react";

export type PlainTextStreamSink = {
  isCurrent: () => boolean;
  setText: (v: string | ((prev: string) => string)) => void;
  rafRef: MutableRefObject<number | null>;
};

/**
 * 消费与 /api/generate、/api/rewrite 一致的纯文本流（含无 body 时的单次 text()）。
 * chunk 先入 buffer，每帧最多 flush 一次到 UI，结束时再同步 flush 尾段，降低 React 更新频率。
 */
export async function readPlainTextStreamResponse(
  res: Response,
  sink: PlainTextStreamSink
): Promise<string> {
  if (!res.body) {
    const text = await res.text();
    if (sink.isCurrent()) sink.setText(text);
    return text;
  }

  /** 仅在有 body 分支创建；finally 里用可选链，避免与无 body 早退混用时误 release */
  let reader: ReturnType<ReadableStream<Uint8Array>["getReader"]> | null =
    res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  const { isCurrent, setText, rafRef } = sink;

  let fullText = "";
  let pendingBuffer = "";
  let flushScheduled = false;

  /** 与 discardInFlightGeneration 配套：取消挂帧后必须把 rafRef 置 null，避免脏 id。 */
  const clearRaf = () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = null;
    flushScheduled = false;
  };

  const flushBuffer = () => {
    rafRef.current = null;
    flushScheduled = false;

    if (!isCurrent()) {
      pendingBuffer = "";
      return;
    }

    if (!pendingBuffer) return;

    const chunk = pendingBuffer;
    pendingBuffer = "";

    setText((prev) => prev + chunk);
  };

  const scheduleFlush = () => {
    if (flushScheduled) return;
    flushScheduled = true;
    rafRef.current = requestAnimationFrame(flushBuffer);
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (!isCurrent()) {
        clearRaf();
        return fullText;
      }

      if (!value) continue;

      const textChunk = decoder.decode(value, { stream: true });
      if (!textChunk) continue;

      fullText += textChunk;
      pendingBuffer += textChunk;

      scheduleFlush();
    }

    const tail = decoder.decode();
    if (tail) {
      fullText += tail;
      pendingBuffer += tail;
    }

    clearRaf();

    if (isCurrent() && pendingBuffer) {
      const chunk = pendingBuffer;
      pendingBuffer = "";
      setText((prev) => prev + chunk);
    }

    return fullText;
  } finally {
    clearRaf();
    reader?.releaseLock();
    reader = null;
  }
}
