import type { WorkListItem } from "@/lib/history-list";
import { getModelOption } from "@/lib/models";

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
};

export default function HistoryPanel({
  history,
  onSelect,
  onDelete,
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

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 className="font-bold">历史记录</h3>
        <div className="flex flex-wrap items-center gap-2">
          {sidebarOnlyRemoval &&
          onSyncFromWorksPage &&
          history.length === 0 ? (
            <button
              type="button"
              className="text-xs text-blue-600 hover:text-blue-800"
              onClick={() => void onSyncFromWorksPage()}
            >
              从作品库同步
            </button>
          ) : null}
        </div>
      </div>

      {sidebarOnlyRemoval ? (
        <p className="text-xs text-gray-500 mb-2">
          登录后首页与作品库共用缓存（sessionStorage 持久化，含分页已加载部分）。登录后自动拉首页；生成成功会刷新首页列表。更多条请点「加载更多」或到作品库刷新/翻页。侧栏移除仅隐藏；删除作品请在作品库操作。
        </p>
      ) : null}

      {history.length === 0 ? (
        <p className="text-sm text-gray-500 py-2">
          侧栏暂无记录。若作品库已刷新、缓存里有数据，可点「从作品库同步」；若缓存仍为空，同步后这里也会是空的。
        </p>
      ) : (
        <>
        {history.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 py-1"
          >
            <div
              className="cursor-pointer text-sm text-gray-700 hover:text-gray-900 min-w-0"
              onClick={() => onSelect(item)}
              title={item.prompt}
            >
              <span className="font-medium">
                {item.platform === "xhs"
                  ? "小红书"
                  : item.platform === "weibo"
                    ? "微博"
                    : "知乎"}
              </span>
              <span className="text-gray-500"> · </span>
              <span className="text-gray-600 break-words">{item.prompt}</span>
              <span className="text-gray-400 ml-2 text-xs">
                {getModelOption(item.modelId).label}
              </span>
              <span className="text-gray-400 ml-2 text-xs">{formatTime(item.createdAt)}</span>
            </div>

            <button
              type="button"
              className="text-xs text-gray-400 hover:text-red-600 shrink-0"
              onClick={() => onDelete(item.id)}
            >
              {sidebarOnlyRemoval ? "从侧栏移除" : "删除"}
            </button>
          </div>
        ))}
        {sidebarOnlyRemoval &&
        historyHasMore &&
        typeof onLoadMoreHistory === "function" ? (
          <div className="pt-2">
            <button
              type="button"
              disabled={historyLoadingMore || historyRefreshing}
              className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
              onClick={() => void onLoadMoreHistory()}
            >
              {historyLoadingMore
                ? "加载中…"
                : historyRefreshing
                  ? "刷新中…"
                  : "加载更多"}
            </button>
          </div>
        ) : null}
        </>
      )}
    </div>
  );
}
