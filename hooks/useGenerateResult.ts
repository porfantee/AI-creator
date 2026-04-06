import { useEffect, useRef, useState } from "react";
import type { StructuredContent } from "@/lib/types";

/** 结果区：纯文本 completion、结构化预览、流式刷新用的 rAF id */
export function useGenerateResult() {
  const [completion, setCompletion] = useState("");
  const [structuredResult, setStructuredResult] = useState<StructuredContent | null>(null);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    };
  }, []);

  return {
    completion,
    setCompletion,
    structuredResult,
    setStructuredResult,
    rafIdRef,
  };
}
