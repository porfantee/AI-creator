import type { MutableRefObject } from "react";

export type PlainTextStreamSink = {
  isCurrent: () => boolean;
  setText: (t: string) => void;
  rafRef: MutableRefObject<number | null>;
};

/**
 * 消费与 /api/generate、/api/rewrite 一致的纯文本流（含无 body 时的单次 text()）。
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

  const textStream = res.body.pipeThrough(new TextDecoderStream("utf-8"));
  const reader = textStream.getReader();
  let fullText = "";

  const scheduleFlush = () => {
    if (sink.rafRef.current != null) {
      cancelAnimationFrame(sink.rafRef.current);
      sink.rafRef.current = null;
    }
    const nextText = fullText;
    sink.rafRef.current = requestAnimationFrame(() => {
      sink.rafRef.current = null;
      if (!sink.isCurrent()) return;
      sink.setText(nextText);
    });
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      fullText += value;
      scheduleFlush();
    }
  }

  if (sink.rafRef.current != null) {
    cancelAnimationFrame(sink.rafRef.current);
    sink.rafRef.current = null;
  }
  if (sink.isCurrent()) sink.setText(fullText);
  return fullText;
}
