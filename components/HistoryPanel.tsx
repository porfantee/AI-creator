"use client";

import type { WorkListItem } from "@/lib/history-list";
import VirtualWorkList from "@/components/VirtualWorkList";
import { Button } from "@/components/ui/button";

type Props = {
  history: WorkListItem[];
  onSelect: (item: WorkListItem) => void;
  onDelete: (id: string) => void;
  /** 已登录：单条移除仅侧栏隐藏，不删库 */
  sidebarOnlyRemoval?: boolean;
  /** 已登录且侧栏为空时显示：与作品库共用缓存，有数据则恢复侧栏，无则请求接口 */
  onSyncFromWorksPage?: () => void;
  /** 已登录：云端列表是否还有下一页 */
  historyHasMore?: boolean;
  onLoadMoreHistory?: () => void;
  historyLoadingMore?: boolean;
  /** 已登录：正在刷新首页列表（与「加载更多」互斥） */
  historyRefreshing?: boolean;
  headerAction?: React.ReactNode;
};

export default function HistoryPanel({
  history,
  onSelect,
  onDelete,
  headerAction,
  sidebarOnlyRemoval = false,
  onSyncFromWorksPage,
  historyHasMore = false,
  onLoadMoreHistory,
  historyLoadingMore = false,
  historyRefreshing = false,
}: Props) {
  const showPanel =
    history.length > 0 ||
    (sidebarOnlyRemoval && typeof onSyncFromWorksPage === "function");

  if (!showPanel) return null;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-bold">历史记录</h3>

        <div className="flex items-center gap-2">
          {headerAction}

          {sidebarOnlyRemoval &&
            onSyncFromWorksPage &&
            history.length === 0 ? (
            <Button
              type="button"
              variant="link"
              size="xs"
              className="h-auto p-0 text-blue-600 hover:text-blue-800"
              onClick={() => void onSyncFromWorksPage()}
            >
              从作品库同步
            </Button>
          ) : null}
        </div>
      </div>

      {sidebarOnlyRemoval ? (
        <p className="mb-2 text-xs text-muted-foreground">
          登录后首页与作品库共用缓存（sessionStorage 持久化，含分页已加载部分）。登录后自动拉首页；生成成功会刷新首页列表。更多条会在滚动到底部时自动加载。侧栏移除仅隐藏；删除作品请在作品库操作。
        </p>
      ) : null}

      {history.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">
          侧栏暂无记录。若作品库已刷新、缓存里有数据，可点「从作品库同步」；若缓存仍为空，同步后这里也会是空的。
        </p>
      ) : (
        <VirtualWorkList
          items={history}
          hasMore={
            sidebarOnlyRemoval &&
            historyHasMore &&
            typeof onLoadMoreHistory === "function"
          }
          loading={historyLoadingMore || historyRefreshing}
          loadMore={onLoadMoreHistory}
          onSelect={onSelect}
          onDelete={onDelete}
          sidebarOnlyRemoval={sidebarOnlyRemoval}
          scrollStorageKey="home-history-scroll"
        />
      )}
    </div>
  );
}