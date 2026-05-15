import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { WorkListItem } from "@/lib/history-list";

type SidebarHiddenIds = Record<string, true>;

/** 登录后「自动拉一次作品列表」的状态（跨 F5 仅持久化 success） */
export type WorksHydrationStatus = "idle" | "pending" | "success" | "error";

function pruneHiddenForItems(
  hidden: SidebarHiddenIds,
  items: WorkListItem[]
): SidebarHiddenIds {
  const ids = new Set(items.map((w) => w.id));
  const next: SidebarHiddenIds = {};
  for (const id of Object.keys(hidden)) {
    if (ids.has(id)) next[id] = true;
  }
  return next;
}

type SetWorksOptions = {
  clearSidebarHidden?: boolean;
  /** 分页：是否还有下一页 */
  hasMore?: boolean;
};

type CloudWorksState = {
  worksItems: WorkListItem[];
  /** 当前列表之后是否还有未拉取的页 */
  worksHasMore: boolean;
  sidebarHiddenIds: SidebarHiddenIds;
  worksHydrationStatus: WorksHydrationStatus;
  worksHydratedForUserId: string | null;
  /**
   * 自动拉列表（登录后首次）前调用：同用户已成功（含 0 条，空列表亦已水合）或 pending 中则返回 false。
   * 返回 true 表示调用方应发起 GET，并在结束后调用 completeAutoHydration。
   */
  tryBeginAutoHydration: (userId: string) => boolean;
  completeAutoHydration: (userId: string, success: boolean) => void;
  setWorksFromFetch: (items: WorkListItem[], options?: SetWorksOptions) => void;
  /** 分页：追加一页，按 id 去重 */
  appendWorksFromFetch: (items: WorkListItem[], hasMore: boolean) => void;
  /** POST 新建成功后插入队首，去重同 id；不修改 worksHasMore（尾部是否还有更多与插入头部无关） */
  prependWorkFromPost: (item: WorkListItem) => void;
  hideSidebarId: (id: string) => void;
  removeWork: (id: string) => void;
  /** 检测到登录用户切换时：清空列表与水合标记，避免短暂显示上一用户数据 */
  clearWorksForUserSwitch: () => void;
  /** 任意一次从接口成功写入列表后，标记当前缓存属于该用户（含手动「刷新」、生成后拉列表） */
  trustWorksListForUser: (userId: string) => void;
  reset: () => void;
};

const initialHydration = {
  worksHydrationStatus: "idle" as WorksHydrationStatus,
  worksHydratedForUserId: null as string | null,
};

function persistableSlice(state: CloudWorksState) {
  const uid = state.worksHydratedForUserId;
  if (!uid) return {};
  const trusted =
    state.worksHydrationStatus === "success" ||
    (state.worksHydrationStatus === "pending" && state.worksItems.length > 0);
  if (!trusted) return {};
  return {
    worksItems: state.worksItems,
    worksHasMore: state.worksHasMore,
    sidebarHiddenIds: state.sidebarHiddenIds,
    worksHydratedForUserId: uid,
    worksHydrationStatus: "success" as const,
  };
}

export const useCloudWorksStore = create<CloudWorksState>()(
  persist(
    (set, get) => ({
      worksItems: [],
      worksHasMore: false,
      sidebarHiddenIds: {},
      ...initialHydration,

      tryBeginAutoHydration(userId: string) {
        const s = get();
        if (s.worksHydratedForUserId === userId) {
          /** success 且含 0 条：视为已拉过，避免 F5/每次进首页重复 GET */
          if (s.worksHydrationStatus === "success") {
            return false;
          }
          if (s.worksHydrationStatus === "pending") return false;
          if (s.worksHydrationStatus === "error") {
            set({
              worksHydrationStatus: "pending",
              worksHydratedForUserId: userId,
            });
            return true;
          }
        }
        set({
          worksHydrationStatus: "pending",
          worksHydratedForUserId: userId,
        });
        return true;
      },

      completeAutoHydration(userId: string, success: boolean) {
        const s = get();
        if (s.worksHydratedForUserId !== userId) return;
        set({
          worksHydrationStatus: success ? "success" : "error",
          worksHydratedForUserId: userId,
        });
      },

      setWorksFromFetch(items, options) {
        const clear = options?.clearSidebarHidden === true;
        const hasMore = options?.hasMore ?? false;

        if (clear) {
          set({
            worksItems: items,
            worksHasMore: hasMore,
            sidebarHiddenIds: {},
          });
          return;
        }
        const hidden = pruneHiddenForItems(get().sidebarHiddenIds, items);
        set({
          worksItems: items,
          worksHasMore: hasMore,
          sidebarHiddenIds: hidden,
        });
      },

      appendWorksFromFetch(items, hasMore) {
        set((s) => {
          const existingIds = new Set(s.worksItems.map((w) => w.id));
          const merged = [...s.worksItems];
          for (const w of items) {
            if (!existingIds.has(w.id)) {
              existingIds.add(w.id);
              merged.push(w);
            }
          }
          const hidden = pruneHiddenForItems(s.sidebarHiddenIds, merged);
          return {
            worksItems: merged,
            worksHasMore: hasMore,
            sidebarHiddenIds: hidden,
          };
        });
      },

      prependWorkFromPost(item) {
        set((s) => {
          const rest = s.worksItems.filter((w) => w.id !== item.id);
          const worksItems = [item, ...rest];
          const hidden = pruneHiddenForItems(s.sidebarHiddenIds, worksItems);
          return { worksItems, sidebarHiddenIds: hidden };
        });
      },

      hideSidebarId(id) {
        set((s) => ({
          sidebarHiddenIds: { ...s.sidebarHiddenIds, [id]: true },
        }));
      },

      removeWork(id) {
        set((s) => {
          const sidebarHiddenIds = { ...s.sidebarHiddenIds };
          delete sidebarHiddenIds[id];
          const nextWorksItems = s.worksItems.filter((w) => w.id !== id);
          return {
            worksItems: nextWorksItems,
            sidebarHiddenIds,
            ...(nextWorksItems.length === 0 ? { worksHasMore: false } : {}),
          };
        });
      },

      clearWorksForUserSwitch() {
        set({
          worksItems: [],
          worksHasMore: false,
          sidebarHiddenIds: {},
          ...initialHydration,
        });
      },

      trustWorksListForUser(userId: string) {
        set({
          worksHydrationStatus: "success",
          worksHydratedForUserId: userId,
        });
      },

      reset() {
        set({
          worksItems: [],
          worksHasMore: false,
          sidebarHiddenIds: {},
          ...initialHydration,
        });
      },
    }),
    {
      name: "xhs-cloud-works",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => persistableSlice(state),
    }
  )
);

const TRUSTED_EMPTY_LIST: WorkListItem[] = [];

/**
 * 仅当列表水合状态与当前登录用户一致时才展示 worksItems，避免切换账号瞬间看到上一用户数据。
 * pending 期间已清空列表，通常为空直至 GET 返回。
 */
export function selectTrustedWorksItems(
  state: Pick<
    CloudWorksState,
    "worksItems" | "worksHydratedForUserId" | "worksHydrationStatus"
  >,
  userKey: string | null
): WorkListItem[] {
  if (!userKey) return TRUSTED_EMPTY_LIST;
  if (state.worksHydratedForUserId !== userKey) return TRUSTED_EMPTY_LIST;
  if (
    state.worksHydrationStatus !== "success" &&
    state.worksHydrationStatus !== "pending"
  ) {
    return TRUSTED_EMPTY_LIST;
  }
  return state.worksItems;
}

export function selectTrustedWorksHasMore(
  state: Pick<
    CloudWorksState,
    | "worksHasMore"
    | "worksHydratedForUserId"
    | "worksHydrationStatus"
  >,
  userKey: string | null
): boolean {
  if (!userKey) return false;
  if (state.worksHydratedForUserId !== userKey) return false;
  if (
    state.worksHydrationStatus !== "success" &&
    state.worksHydrationStatus !== "pending"
  ) {
    return false;
  }
  return state.worksHasMore;
}
