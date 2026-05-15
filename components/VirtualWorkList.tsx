"use client";

import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { WorkListItem } from "@/lib/history-list";
import { getModelOption } from "@/lib/models";
import { Button } from "@/components/ui/button";

type Props = {
  items: WorkListItem[];
  hasMore?: boolean;
  loading?: boolean;
  loadMore?: () => void | Promise<void>;
  onSelect: (item: WorkListItem) => void;
  onDelete: (id: string) => void;
  sidebarOnlyRemoval?: boolean;
  scrollStorageKey?: string;
  selectedId?: string;
};

const PLATFORM_LABEL: Record<string, string> = {
  xhs: "小红书",
  weibo: "微博",
  zhihu: "知乎",
};

function formatTime(value: number | string | Date) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function VirtualWorkList({
  items,
  hasMore = false,
  loading = false,
  loadMore,
  onSelect,
  onDelete,
  sidebarOnlyRemoval = false,
  scrollStorageKey,
  selectedId,
}: Props) {
  const parentRef = useRef<HTMLDivElement | null>(null);

  const restoredScrollRef = useRef(false);
  const restoreAttemptsRef = useRef(0);
  const restoreTimerRef = useRef<number | null>(null);
  const saveScrollRafRef = useRef<number | null>(null);
  const isRestoringScrollRef = useRef(false);
  const loadMoreInRestoreRef = useRef(false);

  const rowCount = hasMore ? items.length + 1 : items.length;

  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 118,
    overscan: 6,
    getItemKey: (index) => items[index]?.id ?? `loader-${index}`,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  useEffect(() => {
    const lastItem = virtualItems[virtualItems.length - 1];

    if (!lastItem) return;
    if (!hasMore) return;
    if (loading) return;
    if (!loadMore) return;
    if (loadMoreInRestoreRef.current) return;

    if (lastItem.index >= items.length - 1) {
      void loadMore();
    }
  }, [virtualItems, hasMore, loading, loadMore, items.length]);

  useEffect(() => {
    if (!scrollStorageKey) return;
    if (restoredScrollRef.current) return;
    if (items.length === 0) return;

    const raw = sessionStorage.getItem(scrollStorageKey);
    const savedTop = raw ? Number(raw) : 0;

    if (!Number.isFinite(savedTop) || savedTop <= 0) {
      restoredScrollRef.current = true;
      return;
    }

    let cancelled = false;

    const finishRestore = () => {
      restoredScrollRef.current = true;

      requestAnimationFrame(() => {
        isRestoringScrollRef.current = false;
      });
    };

    const scheduleTryRestore = () => {
      if (restoreTimerRef.current != null) {
        window.clearTimeout(restoreTimerRef.current);
      }

      restoreTimerRef.current = window.setTimeout(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(tryRestore);
        });
      }, 80);
    };

    const tryRestore = () => {
      if (cancelled) return;

      const el = parentRef.current;
      if (!el) return;

      isRestoringScrollRef.current = true;

      const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);

      if (maxTop >= savedTop) {
        el.scrollTop = savedTop;
        finishRestore();
        return;
      }

      if (!hasMore) {
        el.scrollTop = Math.min(savedTop, maxTop);
        finishRestore();
        return;
      }

      el.scrollTop = maxTop;

      restoreAttemptsRef.current += 1;

      if (restoreAttemptsRef.current >= 20) {
        finishRestore();
        return;
      }

      if (loadMore && !loading && !loadMoreInRestoreRef.current) {
        loadMoreInRestoreRef.current = true;

        Promise.resolve(loadMore())
          .catch(() => {
            finishRestore();
          })
          .finally(() => {
            loadMoreInRestoreRef.current = false;

            if (!cancelled && !restoredScrollRef.current) {
              scheduleTryRestore();
            }
          });

        return;
      }

      scheduleTryRestore();
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(tryRestore);
    });

    return () => {
      cancelled = true;

      if (restoreTimerRef.current != null) {
        window.clearTimeout(restoreTimerRef.current);
        restoreTimerRef.current = null;
      }
    };
  }, [scrollStorageKey, items.length, hasMore, loading, loadMore]);

  useEffect(() => {
    return () => {
      if (saveScrollRafRef.current != null) {
        cancelAnimationFrame(saveScrollRafRef.current);
      }

      if (restoreTimerRef.current != null) {
        window.clearTimeout(restoreTimerRef.current);
      }
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      ref={parentRef}
      className="h-[calc(100vh-220px)] min-h-[360px] overflow-auto pr-1"
      onScroll={(event) => {
        if (!scrollStorageKey) return;
        if (isRestoringScrollRef.current) return;

        const top = event.currentTarget.scrollTop;

        if (saveScrollRafRef.current != null) {
          cancelAnimationFrame(saveScrollRafRef.current);
        }

        saveScrollRafRef.current = requestAnimationFrame(() => {
          sessionStorage.setItem(scrollStorageKey, String(top));
          saveScrollRafRef.current = null;
        });
      }}
    >
      <div
        className="relative w-full"
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
        }}
      >
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index];

          if (!item) {
            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={rowVirtualizer.measureElement}
                className="absolute left-0 top-0 w-full px-1 py-1"
                style={{
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <div className="rounded-lg border bg-white px-3 py-3 text-sm text-muted-foreground">
                  {loading ? "加载中…" : "继续滚动加载更多"}
                </div>
              </div>
            );
          }

          const selected = selectedId === item.id;

          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={rowVirtualizer.measureElement}
              data-benchmark-row
              className="absolute left-0 top-0 w-full px-1 py-1"
              style={{
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <div
                className={`rounded-lg border bg-white p-3 shadow-sm transition hover:bg-muted/40 ${
                  selected ? "border-gray-900 bg-muted/60" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => onSelect(item)}
                    title={item.prompt}
                  >
                    <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {PLATFORM_LABEL[item.platform] ?? item.platform}
                      </span>
                      <span>·</span>
                      <span>{getModelOption(item.modelId).label}</span>
                      <span>·</span>
                      <span>{formatTime(item.createdAt)}</span>
                    </div>

                    <div className="mt-1 line-clamp-2 break-words text-sm text-foreground/90">
                      {item.prompt}
                    </div>

                    {item.completion ? (
                      <div className="mt-1 line-clamp-2 break-words text-xs text-muted-foreground">
                        {item.completion}
                      </div>
                    ) : null}
                  </button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="h-auto shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onDelete(item.id)}
                  >
                    {sidebarOnlyRemoval ? "移除" : "删除"}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
