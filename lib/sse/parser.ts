type ParseResult = { done: boolean; data: string[] };

export function createSSETextDeltaParser() {
  let buffer = "";
  let dataLines: string[] = [];

  const parseEvent = (rawEvent: string): ParseResult => {
    const deltas: string[] = [];

    const lines = rawEvent.split("\n");
    for (const line of lines) {
      const trimmed = line.trimEnd();
      if (!trimmed) continue;
      if (trimmed.startsWith("data:")) {
        dataLines.push(trimmed.slice("data:".length).trimStart());
      }
    }

    if (dataLines.length === 0) return { done: false, data: deltas };

    const payload = dataLines.join("\n").trim();
    dataLines = [];

    if (!payload) return { done: false, data: deltas };
    if (payload === "[DONE]") return { done: true, data: deltas };

    try {
      const json = JSON.parse(payload);
      const delta = json?.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta) deltas.push(delta);
    } catch {
      // ignore non-JSON payloads
    }

    return { done: false, data: deltas };
  };

  return {
    /**
     * Feed raw text chunk (already decoded) into parser.
     * Returns extracted deltas and whether stream is done.
     */
    feed(chunk: string): ParseResult {
      if (!chunk) return { done: false, data: [] };

      buffer += chunk;
      buffer = buffer.replaceAll("\r\n", "\n");

      const deltas: string[] = [];
      let done = false;

      let sepIdx: number;
      while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, sepIdx);
        buffer = buffer.slice(sepIdx + 2);

        const r = parseEvent(rawEvent);
        if (r.data.length) deltas.push(...r.data);
        if (r.done) {
          done = true;
          break;
        }
      }

      return { done, data: deltas };
    },

    /**
     * Flush remaining buffered data as a final event.
     */
    flush(): ParseResult {
      const remaining = buffer.trim();
      buffer = "";
      if (!remaining) return { done: false, data: [] };
      return parseEvent(remaining);
    },
  };
}