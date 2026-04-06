import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Session } from "next-auth";
import { sessionWorksUserKey } from "@/lib/session-user-key";
import { useCloudWorksStore } from "@/stores/cloudWorksStore";

type SessionStatus = "loading" | "authenticated" | "unauthenticated";

/** 模块级：首页与作品页各跑一次 hook，共用同一「上一用户」引用 */
const lastSessionUserKeyRef: { current: string | null } = { current: null };

/**
 * persist 就绪后，若检测到登录用户 id 变化，先清空列表与水合状态，再交给各页拉数逻辑。
 * 需在已使用 useWorkHistory 或作品页的页面各调用一次。
 */
export function useSessionWorksStoreSync(
  session: Session | null,
  status: SessionStatus
): { persistRehydrated: boolean } {
  const [persistRehydrated, setPersistRehydrated] = useState(false);

  useEffect(() => {
    const p = useCloudWorksStore.persist;
    if (p.hasHydrated()) {
      setPersistRehydrated(true);
      return;
    }
    return p.onFinishHydration(() => {
      setPersistRehydrated(true);
    });
  }, []);

  const isAuthed = status === "authenticated" && !!session?.user;
  const userKey = sessionWorksUserKey(session);

  useLayoutEffect(() => {
    if (!persistRehydrated) return;
    if (!isAuthed || !userKey) {
      lastSessionUserKeyRef.current = null;
      return;
    }
    const prev = lastSessionUserKeyRef.current;
    if (prev !== null && prev !== userKey) {
      useCloudWorksStore.getState().clearWorksForUserSwitch();
    }
    lastSessionUserKeyRef.current = userKey;
  }, [isAuthed, persistRehydrated, userKey]);

  const prevLoadingRef = useRef(true);
  useEffect(() => {
    if (status === "loading") {
      prevLoadingRef.current = true;
      return;
    }
    prevLoadingRef.current = false;
    if (!isAuthed) {
      lastSessionUserKeyRef.current = null;
    }
  }, [isAuthed, status]);

  return { persistRehydrated };
}
