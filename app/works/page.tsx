"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import type { Platform } from "@/lib/types";
import { getModelOption } from "@/lib/models";
import { getSceneLabel } from "@/lib/scenes";
import { getPlatformLabel } from "@/lib/platform-label";
import { saveContinueEditPayload } from "@/lib/continue-edit";
import { fetchWorksPageFromApi } from "@/lib/fetch-works-list";
import type { WorkListItem } from "@/lib/history-list";
import StructuredContentPreview from "@/components/StructuredContentPreview";
import { useSessionWorksStoreSync } from "@/hooks/useSessionWorksStoreSync";
import { sessionWorksUserKey } from "@/lib/session-user-key";
import {
  selectTrustedWorksHasMore,
  selectTrustedWorksItems,
  useCloudWorksStore,
} from "@/stores/cloudWorksStore";

const PLATFORMS: Platform[] = ["xhs", "weibo", "zhihu"];

function sceneLabel(platform: Platform, scene: string | null | undefined): string {
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
  const [exportKind, setExportKind] = useState<"all" | "plain" | "structured">("all");
  const [isExporting, setIsExporting] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  /** 作品库页：刷新与「加载更多」串行，避免并发写 store / offset 错位 */
  const worksPageFetchChainRef = useRef(Promise.resolve<void>(undefined));
  const enqueueWorksPageFetch = useCallback((work: () => Promise<void>) => {
    const next = worksPageFetchChainRef.current.then(() => work());
    worksPageFetchChainRef.current = next.then(() => {}).catch(() => {});
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
              setWorksFromFetch([], { clearSidebarHidden: false, hasMore: false });
              return;
            }
            if (result.kind === "http") {
              setLoadError(`加载失败 (${result.status})`);
            } else if (result.kind === "parse") {
              setLoadError("数据格式异常");
            } else {
              setLoadError("网络错误");
            }
            setWorksFromFetch([], { clearSidebarHidden: false, hasMore: false });
            return;
          }
          setWorksFromFetch(result.items, {
            clearSidebarHidden: false,
            hasMore: result.hasMore,
          });
          const key = sessionWorksUserKey(session);
          if (key) useCloudWorksStore.getState().trustWorksListForUser(key);
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
        if (key) useCloudWorksStore.getState().trustWorksListForUser(key);
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((w) => {
      if (filterPlatform !== "all" && w.platform !== filterPlatform) return false;
      if (!q) return true;
      return w.prompt.toLowerCase().includes(q);
    });
  }, [items, filterPlatform, search]);

  const selected = useMemo(
    () => filtered.find((w) => w.id === selectedId) ?? items.find((w) => w.id === selectedId) ?? null,
    [filtered, items, selectedId]
  );

  async function handleDelete(id: string) {
    if (!confirm("确定从云端永久删除该作品？此操作不可恢复。")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/works/${encodeURIComponent(id)}`, { method: "DELETE" });
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

  async function handleExportCsv() {
    setIsExporting(true);
    try {
      const res = await fetch(
        `/api/works/export?format=csv&kind=${encodeURIComponent(exportKind)}`,
        { credentials: "same-origin", cache: "no-store" }
      );
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
      const filename = match?.[1] ?? `works-${exportKind}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("导出失败：网络错误");
    } finally {
      setIsExporting(false);
    }
  }

  function handleContinueEdit(w: WorkListItem) {
    saveContinueEditPayload({
      platform: w.platform,
      scene: w.scene ?? null,
      modelId: w.modelId,
      prompt: w.prompt,
      completion: w.completion,
      structuredJson: w.structuredJson ?? null,
    });
    router.push("/");
  }

  if (status === "loading") {
    return (
      <main className="max-w-4xl mx-auto px-4 py-10">
        <p className="text-gray-500">会话加载中…</p>
      </main>
    );
  }

  if (status !== "authenticated") {
    return (
      <main className="max-w-4xl mx-auto px-4 py-10 space-y-4">
        <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
          ← 返回首页
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">作品库</h1>
        <p className="text-gray-600">请先登录后查看云端作品。</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="px-4 py-2 rounded bg-gray-900 text-white text-sm hover:bg-gray-800"
            onClick={() => void signIn("github")}
          >
            GitHub 登录
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded border border-gray-300 text-sm hover:bg-gray-50"
            onClick={() => void signIn("google")}
          >
            Google 登录
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
            ← 返回首页
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">作品库</h1>
          <p className="text-sm text-gray-500">
            已加载 {items.length} 条
            {worksHasMoreTrusted ? "（仍有更多，可点「加载更多」）" : ""} · 当前筛选 {filtered.length}{" "}
            条
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <fieldset className="flex flex-wrap items-center gap-2 border-0 p-0 m-0">
            <legend className="sr-only">导出范围</legend>
            <span className="text-sm text-gray-500">导出</span>
            {(
              [
                { value: "all" as const, label: "全部" },
                { value: "plain" as const, label: "纯文本" },
                { value: "structured" as const, label: "结构化" },
              ] as const
            ).map(({ value, label }) => (
              <label key={value} className="inline-flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="exportKind"
                  value={value}
                  checked={exportKind === value}
                  onChange={() => setExportKind(value)}
                  className="accent-gray-900"
                />
                {label}
              </label>
            ))}
          </fieldset>
          <button
            type="button"
            disabled={isExporting}
            className="text-sm px-3 py-1.5 rounded bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
            onClick={() => void handleExportCsv()}
          >
            {isExporting ? "导出中…" : "导出 CSV"}
          </button>
          <button
            type="button"
            disabled={isRefreshing || isLoadingMore}
            className="text-sm px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
            onClick={() => void loadWorks({ trackRefreshing: true })}
          >
            {isRefreshing ? "刷新中…" : "刷新"}
          </button>
          {worksHasMoreTrusted ? (
            <button
              type="button"
              disabled={isLoadingMore || isRefreshing}
              className="text-sm px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
              onClick={() => void loadMoreWorks()}
            >
              {isLoadingMore
                ? "加载中…"
                : isRefreshing
                  ? "刷新中…"
                  : "加载更多"}
            </button>
          ) : null}
        </div>
      </div>

      {loadError ? (
        <p className="text-sm text-red-600">{loadError}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-gray-600 flex items-center gap-2">
          平台
          <select
            value={filterPlatform}
            onChange={(e) => setFilterPlatform(e.target.value as Platform | "all")}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="all">全部</option>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {getPlatformLabel(p)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-gray-600 flex items-center gap-2 flex-1 min-w-[12rem]">
          搜索主题
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="匹配 prompt 关键词"
            className="border rounded px-2 py-1 text-sm flex-1 max-w-md"
          />
        </label>
      </div>

      <div className="grid gap-6 md:grid-cols-5">
        <div className="md:col-span-2 border rounded-lg overflow-hidden bg-white">
          <div className="max-h-[min(70vh,520px)] overflow-y-auto divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <p className="p-4 text-sm text-gray-500">暂无作品</p>
            ) : (
              filtered.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setSelectedId(w.id)}
                  className={`w-full text-left p-3 text-sm hover:bg-gray-50 transition-colors ${
                    selectedId === w.id ? "bg-red-50" : ""
                  }`}
                >
                  <div className="font-medium text-gray-900 line-clamp-2">{w.prompt}</div>
                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-gray-500">
                    <span>{getPlatformLabel(w.platform)}</span>
                    <span>·</span>
                    <span>{sceneLabel(w.platform, w.scene)}</span>
                    <span>·</span>
                    <span>{getModelOption(w.modelId).label}</span>
                    <span>·</span>
                    <span>{w.structuredJson ? "结构化" : "纯文本"}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {new Date(w.createdAt).toLocaleString("zh-CN")}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="md:col-span-3 border rounded-lg p-4 bg-gray-50 min-h-[280px]">
          {!selected ? (
            <p className="text-sm text-gray-500">请从左侧选择一条作品查看详情</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="text-xs px-3 py-1.5 rounded bg-gray-900 text-white hover:bg-gray-800"
                  onClick={() => handleContinueEdit(selected)}
                >
                  继续编辑
                </button>
                <button
                  type="button"
                  disabled={deletingId === selected.id}
                  className="text-xs px-3 py-1.5 rounded border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                  onClick={() => void handleDelete(selected.id)}
                >
                  {deletingId === selected.id ? "删除中…" : "删除"}
                </button>
              </div>
              <dl className="grid grid-cols-1 gap-2 text-sm">
                <div>
                  <dt className="text-gray-500">平台 / 场景</dt>
                  <dd className="text-gray-900">
                    {getPlatformLabel(selected.platform)} · {sceneLabel(selected.platform, selected.scene)}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">模型</dt>
                  <dd className="text-gray-900">{getModelOption(selected.modelId).label}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">主题</dt>
                  <dd className="text-gray-900 whitespace-pre-wrap">{selected.prompt}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">创建时间</dt>
                  <dd className="text-gray-900">{new Date(selected.createdAt).toLocaleString("zh-CN")}</dd>
                </div>
              </dl>
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">生成内容</h3>
                {selected.structuredJson ? (
                  <div className="bg-white border rounded p-3">
                    <StructuredContentPreview structured={selected.structuredJson} actions="inline" />
                  </div>
                ) : (
                  <div className="bg-white border rounded p-3">
                    <div className="flex justify-end mb-2">
                      <button
                        type="button"
                        className="text-xs px-2 py-1 rounded border hover:bg-gray-50"
                        onClick={() => void navigator.clipboard.writeText(selected.completion)}
                      >
                        复制全部
                      </button>
                    </div>
                    <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">{selected.completion}</pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
