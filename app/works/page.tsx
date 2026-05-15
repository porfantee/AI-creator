"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import type { Platform } from "@/lib/types";
import { getModelOption } from "@/lib/models";
import { getSceneLabel } from "@/lib/scenes";
import { getPlatformLabel } from "@/lib/platform-label";
import { saveContinueEditPayload } from "@/lib/continue-edit";
import { fetchWorksPageFromApi } from "@/lib/fetch-works-list";
import type { WorkListItem } from "@/lib/history-list";
import VirtualWorkList from "@/components/VirtualWorkList";
import { useSessionWorksStoreSync } from "@/hooks/useSessionWorksStoreSync";
import { sessionWorksUserKey } from "@/lib/session-user-key";
import {
  selectTrustedWorksHasMore,
  selectTrustedWorksItems,
  useCloudWorksStore,
} from "@/stores/cloudWorksStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

const PLATFORMS: Platform[] = ["xhs", "weibo", "zhihu"];

function sceneLabel(
  platform: Platform,
  scene: string | null | undefined
): string {
  if (!scene) return "—";
  return getSceneLabel(platform, scene);
}



export default function WorksPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useSessionWorksStoreSync(session, status);

  const worksTrustKey =
    status === "authenticated" ? sessionWorksUserKey(session) : null;

  const items = useCloudWorksStore((s) =>
    selectTrustedWorksItems(s, worksTrustKey)
  );

  const worksHasMoreTrusted = useCloudWorksStore((s) =>
    selectTrustedWorksHasMore(s, worksTrustKey)
  );

  const setWorksFromFetch = useCloudWorksStore((s) => s.setWorksFromFetch);
  const appendWorksFromFetch = useCloudWorksStore((s) => s.appendWorksFromFetch);
  const removeWork = useCloudWorksStore((s) => s.removeWork);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterPlatform, setFilterPlatform] = useState<Platform | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const initialLoadStartedRef = useRef(false);

  /** 作品库页：刷新与「加载更多」串行，避免并发写 store / offset 错位 */
  const worksPageFetchChainRef = useRef(Promise.resolve<void>(undefined));

  const enqueueWorksPageFetch = useCallback((work: () => Promise<void>) => {
    const next = worksPageFetchChainRef.current.then(() => work());
    worksPageFetchChainRef.current = next.then(() => { }).catch(() => { });
    return next;
  }, []);

  const loadWorks = useCallback(
    async (opts?: { trackRefreshing?: boolean }) => {
      await enqueueWorksPageFetch(async () => {
        const track = opts?.trackRefreshing === true;

        setLoadError(null);
        if (track) setIsRefreshing(true);

        try {
          const result = await fetchWorksPageFromApi({ offset: 0 });

          if (!result.ok) {
            if (result.kind === "unauthorized") {
              setWorksFromFetch([], {
                clearSidebarHidden: false,
                hasMore: false,
              });
              return;
            }

            if (result.kind === "http") {
              setLoadError(`加载失败 (${result.status})`);
            } else if (result.kind === "parse") {
              setLoadError("数据格式异常");
            } else {
              setLoadError("网络错误");
            }

            setWorksFromFetch([], {
              clearSidebarHidden: false,
              hasMore: false,
            });
            return;
          }

          setWorksFromFetch(result.items, {
            clearSidebarHidden: false,
            hasMore: result.hasMore,
          });

          const key = sessionWorksUserKey(session);
          if (key) {
            useCloudWorksStore.getState().trustWorksListForUser(key);
          }
        } finally {
          if (track) setIsRefreshing(false);
        }
      });
    },
    [enqueueWorksPageFetch, session, setWorksFromFetch]
  );

  const loadMoreWorks = useCallback(async () => {
    await enqueueWorksPageFetch(async () => {
      setLoadError(null);

      if (!worksHasMoreTrusted) return;

      setIsLoadingMore(true);

      try {
        const offset = useCloudWorksStore.getState().worksItems.length;
        const result = await fetchWorksPageFromApi({ offset });

        if (!result.ok) {
          if (result.kind === "http") {
            setLoadError(`加载更多失败 (${result.status})`);
          } else {
            setLoadError("加载更多失败");
          }
          return;
        }

        appendWorksFromFetch(result.items, result.hasMore);

        const key = sessionWorksUserKey(session);
        if (key) {
          useCloudWorksStore.getState().trustWorksListForUser(key);
        }
      } finally {
        setIsLoadingMore(false);
      }
    });
  }, [
    appendWorksFromFetch,
    enqueueWorksPageFetch,
    session,
    worksHasMoreTrusted,
  ]);

  useEffect(() => {
    if (initialLoadStartedRef.current) return;

    initialLoadStartedRef.current = true;
    void loadWorks();
  }, [status, loadWorks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return items.filter((w) => {
      if (filterPlatform !== "all" && w.platform !== filterPlatform) {
        return false;
      }

      if (!q) return true;

      return (
        w.prompt.toLowerCase().includes(q) ||
        w.completion.toLowerCase().includes(q)
      );
    });
  }, [items, filterPlatform, search]);

  const isFiltering = filterPlatform !== "all" || search.trim().length > 0;

  const selected = useMemo(
    () =>
      filtered.find((w) => w.id === selectedId) ??
      items.find((w) => w.id === selectedId) ??
      null,
    [filtered, items, selectedId]
  );

  async function handleDelete(id: string) {
    if (!confirm("确定从云端永久删除该作品？此操作不可恢复。")) return;

    setDeletingId(id);

    try {
      const res = await fetch(`/api/works/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setSelectedId((cur) => (cur === id ? null : cur));
        removeWork(id);
      } else {
        alert(`删除失败 (${res.status})`);
      }
    } finally {
      setDeletingId(null);
    }
  }

  async function handleExportAll(format: "txt" | "md") {
    setIsExporting(true);

    try {
      const res = await fetch(`/api/works/export?format=${format}&kind=all`, {
        credentials: "same-origin",
        cache: "no-store",
      });

      if (res.status === 401) {
        alert("请先登录");
        return;
      }

      if (!res.ok) {
        alert(`导出失败 (${res.status})`);
        return;
      }

      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition");
      const match = cd?.match(/filename="([^"]+)"/);
      const filename =
        match?.[1] ?? (format === "md" ? "works-all.md" : "works-all.txt");

      downloadBlob(blob, filename);
    } catch {
      alert("导出失败：网络错误");
    } finally {
      setIsExporting(false);
    }
  }

  function safeFilename(value: string) {
    return value
      .trim()
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, "_")
      .slice(0, 40);
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = filename;
    a.rel = "noopener";

    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }

  function formatWorkAsText(w: WorkListItem) {
    const platform = getPlatformLabel(w.platform);
    const scene = sceneLabel(w.platform, w.scene);
    const model = getModelOption(w.modelId).label;
    const createdAt = new Date(w.createdAt).toLocaleString("zh-CN");

    return [
      `主题：${w.prompt}`,
      "",
      `平台 / 场景：${platform} · ${scene}`,
      `模型：${model}`,
      `创建时间：${createdAt}`,
      "",
      "生成内容：",
      "",
      w.completion,
      "",
    ].join("\n");
  }

  function handleExportSingleText(w: WorkListItem) {
    const text = formatWorkAsText(w);
    const filename = `${safeFilename(w.prompt) || "work"}.txt`;

    downloadBlob(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
      filename
    );
  }


  function handleContinueEdit(w: WorkListItem) {
    saveContinueEditPayload({
      platform: w.platform,
      scene: w.scene ?? null,
      modelId: w.modelId,
      prompt: w.prompt,
      completion: w.completion,
    });

    router.push("/");
  }

  if (status === "loading") {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <p className="text-gray-500">会话加载中…</p>
      </main>
    );
  }



  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-full shadow-sm transition-all hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16" height="16"
              viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            返回首页
          </Link>

          <h1 className="text-2xl font-bold text-gray-900">作品库</h1>

          <p className="text-sm text-gray-500">
            已加载 {items.length} 条
            {worksHasMoreTrusted ? "（仍有更多）" : ""} · 当前筛选{" "}
            {filtered.length} 条
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="sm"
            disabled={isExporting}
            onClick={() => void handleExportAll("txt")}
          >
            {isExporting ? "导出中…" : "导出全部 TXT"}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isExporting}
            onClick={() => void handleExportAll("md")}
          >
            {isExporting ? "导出中…" : "导出全部 Markdown"}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isRefreshing || isLoadingMore}
            onClick={() => void loadWorks({ trackRefreshing: true })}
          >
            {isRefreshing ? "刷新中…" : "刷新"}
          </Button>

          {worksHasMoreTrusted ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoadingMore || isRefreshing || isFiltering}
              onClick={() => void loadMoreWorks()}
              title={isFiltering ? "筛选状态下请先清空筛选条件" : undefined}
            >
              {isLoadingMore
                ? "加载中…"
                : isFiltering
                  ? "筛选中"
                  : "加载更多"}
            </Button>
          ) : null}
        </div>
      </div>

      {loadError ? <p className="text-sm text-red-600">{loadError}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="shrink-0">平台</span>

          <Select
            value={filterPlatform}
            onValueChange={(v) => {
              setFilterPlatform(v as Platform | "all");
            }}
          >
            <SelectTrigger className="w-[9rem]">
              <span>
                {filterPlatform === "all"
                  ? "全部"
                  : getPlatformLabel(filterPlatform)}
              </span>
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="all">全部</SelectItem>

              {PLATFORMS.map((p) => (
                <SelectItem key={p} value={p}>
                  {getPlatformLabel(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <label className="flex min-w-[12rem] flex-1 items-center gap-2 text-sm text-muted-foreground">
          <span className="shrink-0">搜索主题</span>

          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="匹配 prompt / 生成内容关键词"
            className="max-w-md flex-1"
          />
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="rounded-lg border bg-white p-2">
          {filtered.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">暂无作品</p>
          ) : (
            <VirtualWorkList
              items={filtered}
              hasMore={!isFiltering && worksHasMoreTrusted}
              loading={isLoadingMore || isRefreshing}
              loadMore={!isFiltering ? loadMoreWorks : undefined}
              onSelect={(item) => setSelectedId(item.id)}
              onDelete={(id) => void handleDelete(id)}
              sidebarOnlyRemoval={false}
              scrollStorageKey="works-list-scroll"
            />
          )}
        </div>

        <div className="min-h-[520px] rounded-lg border bg-gray-50 p-4">
          {!selected ? (
            <p className="text-sm text-gray-500">
              请从左侧选择一条作品查看详情
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleContinueEdit(selected)}
                >
                  继续编辑
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleExportSingleText(selected)}
                >
                  导出当前 TXT
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={deletingId === selected.id}
                  className="border-red-300 text-red-700 hover:bg-red-50"
                  onClick={() => void handleDelete(selected.id)}
                >
                  {deletingId === selected.id ? "删除中…" : "删除"}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void navigator.clipboard.writeText(selected.completion)
                  }
                >
                  复制全文
                </Button>
              </div>

              <dl className="grid grid-cols-1 gap-3 text-sm">
                <div>
                  <dt className="text-gray-500">平台 / 场景</dt>
                  <dd className="text-gray-900">
                    {getPlatformLabel(selected.platform)} ·{" "}
                    {sceneLabel(selected.platform, selected.scene)}
                  </dd>
                </div>

                <div>
                  <dt className="text-gray-500">模型</dt>
                  <dd className="text-gray-900">
                    {getModelOption(selected.modelId).label}
                  </dd>
                </div>

                <div>
                  <dt className="text-gray-500">主题</dt>
                  <dd className="whitespace-pre-wrap text-gray-900">
                    {selected.prompt}
                  </dd>
                </div>

                <div>
                  <dt className="text-gray-500">创建时间</dt>
                  <dd className="text-gray-900">
                    {new Date(selected.createdAt).toLocaleString("zh-CN")}
                  </dd>
                </div>
              </dl>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-700">
                  生成内容
                </h3>

                <div className="rounded border bg-white p-3">
                  <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800">
                    {selected.completion}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
