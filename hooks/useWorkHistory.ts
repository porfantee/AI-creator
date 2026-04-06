import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import type { Session } from "next-auth";
import type { ModelId, Platform, SceneId, StructuredContent } from "@/lib/types";
import {
  fetchWorksListFullFromApi,
  fetchWorksPageFromApi,
} from "@/lib/fetch-works-list";
import {
  workApiRowToListItem,
  type WorkCreateResponse,
  type WorkListItem,
} from "@/lib/history-list";
import { WORKS_PAGE_SIZE } from "@/lib/works-pagination";
import {
  enqueueGuestHistoryMigration,
  migrateLocalHistoryToCloud,
} from "@/lib/migrate-local-history";
import {
  clearHistory,
  deleteHistory,
  getHistory,
  replaceHistory,
  saveHistory,
} from "@/utils/history";
import { sessionWorksUserKey } from "@/lib/session-user-key";
import {
  selectTrustedWorksHasMore,
  selectTrustedWorksItems,
  useCloudWorksStore,
} from "@/stores/cloudWorksStore";
import { useSessionWorksStoreSync } from "@/hooks/useSessionWorksStoreSync";

type SessionStatus = "loading" | "authenticated" | "unauthenticated";

export function useWorkHistory(
  sessionRef: MutableRefObject<Session | null>,
  session: Session | null,
  status: SessionStatus
) {
  const [localHistory, setLocalHistory] = useState<WorkListItem[]>([]);

  const trustKey = sessionWorksUserKey(session);
  const trustedWorksItems = useCloudWorksStore((s) =>
    selectTrustedWorksItems(s, trustKey)
  );
  const trustedWorksHasMore = useCloudWorksStore((s) =>
    selectTrustedWorksHasMore(s, trustKey)
  );
  const sidebarHiddenIds = useCloudWorksStore((s) => s.sidebarHiddenIds);
  const cloudSidebarHistory = useMemo(
    () => trustedWorksItems.filter((w) => !sidebarHiddenIds[w.id]),
    [trustedWorksItems, sidebarHiddenIds]
  );

  const isAuthed = status === "authenticated" && !!session?.user;
  const history = isAuthed ? cloudSidebarHistory : localHistory;
  const authedUserKey =
    session?.user?.id ?? session?.user?.email ?? session?.user?.name ?? null;

  const prevAuthedRef = useRef(false);
  const { persistRehydrated } = useSessionWorksStoreSync(session, status);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyRefreshing, setHistoryRefreshing] = useState(false);
  /** 串行化「首页/侧栏」侧所有作品列表请求，避免 refresh 与 loadMore 并发导致 offset/覆盖错乱 */
  const worksListFetchChainRef = useRef(Promise.resolve<void>(undefined));

  const enqueueWorksListFetch = useCallback(<T,>(work: () => Promise<T>): Promise<T> => {
    const next = worksListFetchChainRef.current.then(() => work());
    worksListFetchChainRef.current = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }, []);

  const loadHistoryList = useCallback(
    async (
      clearSidebarHidden = false,
      options?: { full?: boolean }
    ): Promise<boolean> => {
      if (status === "loading") return false;

      if (status !== "authenticated" || !session?.user) {
        setLocalHistory(getHistory());
        return false;
      }

      return enqueueWorksListFetch(async () => {
        setHistoryRefreshing(true);
        try {
          const result = options?.full
            ? await fetchWorksListFullFromApi()
            : await fetchWorksPageFromApi({ offset: 0 });
          if (result.ok === false) {
            if (result.kind === "unauthorized") {
              useCloudWorksStore.getState().reset();
              setLocalHistory(getHistory());
              return false;
            }
            if (result.kind === "http") {
              console.error("[loadHistoryList] /api/works HTTP", result.status);
            } else if (result.kind === "parse") {
              console.error("[loadHistoryList] invalid JSON: missing works[]");
            } else {
              console.error("[loadHistoryList] fetch/parse error");
            }
            useCloudWorksStore.getState().setWorksFromFetch([], {
              clearSidebarHidden,
              hasMore: false,
            });
            return false;
          }

          useCloudWorksStore.getState().setWorksFromFetch(result.items, {
            clearSidebarHidden,
            hasMore: result.hasMore,
          });
          const key = sessionWorksUserKey(session);
          if (key) useCloudWorksStore.getState().trustWorksListForUser(key);
          return true;
        } finally {
          setHistoryRefreshing(false);
        }
      });
    },
    [enqueueWorksListFetch, session, status]
  );

  const loadMoreHistory = useCallback(async (): Promise<boolean> => {
    if (status !== "authenticated" || !session?.user) return false;

    return enqueueWorksListFetch(async () => {
      const snap = useCloudWorksStore.getState();
      if (!snap.worksHasMore) return false;
      setHistoryLoadingMore(true);
      try {
        const offset = snap.worksItems.length;
        const result = await fetchWorksPageFromApi({ offset });
        if (result.ok === false) {
          if (result.kind === "http") {
            console.error("[loadMoreHistory] /api/works HTTP", result.status);
          } else if (result.kind === "parse") {
            console.error("[loadMoreHistory] invalid JSON");
          } else {
            console.error("[loadMoreHistory] fetch error");
          }
          return false;
        }
        useCloudWorksStore.getState().appendWorksFromFetch(
          result.items,
          result.hasMore
        );
        const key = sessionWorksUserKey(session);
        if (key) useCloudWorksStore.getState().trustWorksListForUser(key);
        return true;
      } finally {
        setHistoryLoadingMore(false);
      }
    });
  }, [enqueueWorksListFetch, session, status]);

  useEffect(() => {
    if (status === "loading") return;

    if (!isAuthed) {
      prevAuthedRef.current = false;
      useCloudWorksStore.getState().reset();
      setLocalHistory(getHistory());
      return;
    }

    if (!persistRehydrated) return;

    const userKey = authedUserKey ?? "";
    if (!userKey) return;

    const becameAuthed = !prevAuthedRef.current;
    prevAuthedRef.current = true;

    if (!becameAuthed) return;

    const api = useCloudWorksStore.getState();
    if (!api.tryBeginAutoHydration(userKey)) return;

    const guestLocal = getHistory();

    if (guestLocal.length > 0) {
      enqueueGuestHistoryMigration(async () => {
        try {
          const remaining = await migrateLocalHistoryToCloud();
          if (remaining.length === 0) clearHistory();
          else replaceHistory(remaining);
          const ok = await loadHistoryList(true, { full: true });
          useCloudWorksStore.getState().completeAutoHydration(userKey, ok);
        } catch (e) {
          useCloudWorksStore.getState().completeAutoHydration(userKey, false);
          console.error("[guestHistoryMigration]", e);
        }
      });
      return;
    }

    void loadHistoryList(true).then((ok) => {
      useCloudWorksStore.getState().completeAutoHydration(userKey, ok);
    });
  }, [authedUserKey, isAuthed, loadHistoryList, persistRehydrated, status]);

  const persistSuccess = useCallback(
    async (
      submittedPlatform: Platform,
      submittedScene: SceneId,
      submittedModelId: ModelId,
      submittedPrompt: string,
      text: string,
      structured: StructuredContent | null = null
    ) => {
      if (!text.trim()) return;

      if (sessionRef.current?.user) {
        const res = await fetch("/api/works", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platform: submittedPlatform,
            modelId: submittedModelId,
            prompt: submittedPrompt,
            completion: text,
            scene: submittedScene,
            ...(structured != null ? { structuredJson: structured } : {}),
          }),
        });
        if (res.ok) {
          const snap = useCloudWorksStore.getState();
          const multiPageOrTailPending =
            snap.worksHasMore || snap.worksItems.length > WORKS_PAGE_SIZE;
          let created: WorkListItem | null = null;
          try {
            const data = (await res.json()) as WorkCreateResponse;
            if (data?.work) {
              created = workApiRowToListItem(data.work);
            }
          } catch {
            created = null;
          }
          if (created && multiPageOrTailPending) {
            useCloudWorksStore.getState().prependWorkFromPost(created);
            const key = sessionWorksUserKey(sessionRef.current);
            if (key) useCloudWorksStore.getState().trustWorksListForUser(key);
          } else {
            await loadHistoryList(false);
          }
        }
        return;
      }

      saveHistory({
        prompt: submittedPrompt,
        platform: submittedPlatform,
        modelId: submittedModelId,
        completion: text,
        scene: submittedScene,
        ...(structured != null ? { structuredJson: structured } : {}),
      });
      setLocalHistory(getHistory());
    },
    [sessionRef, loadHistoryList]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (sessionRef.current?.user) {
        useCloudWorksStore.getState().hideSidebarId(id);
        return;
      }
      deleteHistory(id);
      setLocalHistory(getHistory());
    },
    [sessionRef]
  );

  return {
    history,
    historyHasMore: isAuthed ? trustedWorksHasMore : false,
    historyLoadingMore,
    historyRefreshing,
    loadHistoryList,
    loadMoreHistory,
    persistSuccess,
    handleDelete,
  };
}
