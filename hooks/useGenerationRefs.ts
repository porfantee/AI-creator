import { useEffect, useRef } from "react";
import type { Session } from "next-auth";

/**
 * 与生成相关的可变引用：最新 session、请求代次、当前 AbortController，以及提交锁 / 停止冷却 / 继续编辑一次性标记。
 */
export function useGenerationRefs(session: Session | null) {
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const continueEditAppliedRef = useRef(false);
  const submitLockRef = useRef(false);
  const stopCooldownUntilRef = useRef(0);

  return {
    sessionRef,
    requestIdRef,
    abortControllerRef,
    continueEditAppliedRef,
    submitLockRef,
    stopCooldownUntilRef,
  };
}
