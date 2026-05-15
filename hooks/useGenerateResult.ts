import { useEffect, useRef, useState } from "react";

/** 结果区：纯文本 completion、流式刷新用的 rAF id */
export function useGenerateResult() {
  const [completion, setCompletion] = useState("");
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
    rafIdRef,
  };
}
