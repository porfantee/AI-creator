"use client";

import Link from "next/link";
import { useCallback, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import GeneratorForm from "@/components/GeneratorForm";
import ResultPanel from "@/components/ResultPanel";
import HistoryPanel from "@/components/HistoryPanel";
import { useComposerInput } from "@/hooks/useComposerInput";
import { useGenerateResult } from "@/hooks/useGenerateResult";
import { useGenerationRefs } from "@/hooks/useGenerationRefs";
import { useGenerationLifecycle } from "@/hooks/useGenerationLifecycle";
import { useHomeGeneration, type HomeGenerationRefs } from "@/hooks/useHomeGeneration";
import { useWorkHistory } from "@/hooks/useWorkHistory";
import { consumeContinueEditPayload } from "@/lib/continue-edit";
import { useCloudWorksStore } from "@/stores/cloudWorksStore";

const BUSY_PHASES = new Set(["generating", "stopping", "success"]);
const STREAMING_PHASES = new Set(["generating", "stopping"]);

export default function Page() {
  const { data: session, status } = useSession();

  const [generationState, dispatch] = useGenerationLifecycle();

  const isBusy = BUSY_PHASES.has(generationState.phase);
  const isStreamingPhase = STREAMING_PHASES.has(generationState.phase);

  const {
    input,
    setInput,
    platform,
    setPlatform,
    scene,
    setScene,
    modelId,
    setModelId,
    generateMode,
    setGenerateMode,
    applyPlatform,
    sceneOptions,
  } = useComposerInput();

  const {
    completion,
    setCompletion,
    structuredResult,
    setStructuredResult,
    rafIdRef,
  } = useGenerateResult();

  const {
    sessionRef,
    requestIdRef,
    abortControllerRef,
    continueEditAppliedRef,
    submitLockRef,
    stopCooldownUntilRef,
  } = useGenerationRefs(session ?? null);

  const homeRefs: HomeGenerationRefs = {
    requestIdRef,
    abortControllerRef,
    submitLockRef,
    stopCooldownUntilRef,
    rafIdRef,
  };

  const {
    history,
    historyHasMore,
    historyLoadingMore,
    historyRefreshing,
    persistSuccess,
    handleDelete,
    loadMoreHistory,
  } = useWorkHistory(sessionRef, session ?? null, status);

  /** 把当前 Zustand 里作品列表同步到侧栏；store 为空则侧栏仍为空（不打接口） */
  const syncFromWorksPage = useCallback(() => {
    const snap = useCloudWorksStore.getState();
    if (snap.worksItems.length === 0) return;
    snap.setWorksFromFetch(snap.worksItems, { clearSidebarHidden: true });
  }, []);

  const { onSubmit, handleStop, handleRewrite } = useHomeGeneration({
    dispatch,
    refs: homeRefs,
    input,
    platform,
    scene,
    modelId,
    generateMode,
    isBusy,
    structuredResult,
    completion,
    setCompletion,
    setStructuredResult,
    persistSuccess,
  });

  const dismissGenerationUi = useCallback(() => {
    dispatch({ type: "RESET" });
  }, [dispatch]);

  useEffect(() => {
    if (continueEditAppliedRef.current) return;
    const payload = consumeContinueEditPayload();
    if (!payload) return;
    continueEditAppliedRef.current = true;
    dispatch({ type: "RESET" });
    applyPlatform(payload.platform, payload.scene);
    setModelId(payload.modelId);
    setInput(payload.prompt);
    setCompletion(payload.completion);
    setStructuredResult(payload.structuredJson);
    setGenerateMode(payload.structuredJson ? "structured" : "plain");
  }, [
    dispatch,
    applyPlatform,
    setModelId,
    setInput,
    setCompletion,
    setStructuredResult,
    setGenerateMode,
  ]);

  return (
    <main className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
            🍎多平台内容创作工具
          </h1>
          {session ? (
            <Link
              href="/works"
              className="text-sm text-gray-600 hover:text-gray-900 underline-offset-2 hover:underline"
            >
              作品库
            </Link>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {status === "loading" ? (
            <span className="text-gray-500">会话加载中…</span>
          ) : session ? (
            <>
              <span className="text-gray-600 max-w-[200px] truncate">
                {session.user?.name ?? session.user?.email ?? "已登录"}
              </span>
              <button
                type="button"
                className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50"
                onClick={() => void signOut()}
              >
                退出
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="px-3 py-1 rounded bg-gray-900 text-white hover:bg-gray-800"
                onClick={() => void signIn("github")}
              >
                GitHub 登录
              </button>
              <button
                type="button"
                className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50"
                onClick={() => void signIn("google")}
              >
                Google 登录
              </button>
            </>
          )}
        </div>
      </div>

      {generationState.phase === "success" ? (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
          生成成功
        </p>
      ) : null}

      {generationState.phase === "error" && generationState.errorMessage ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          <span className="flex-1 min-w-0">{generationState.errorMessage}</span>
          <button
            type="button"
            className="shrink-0 text-xs px-2 py-1 rounded border border-red-300 hover:bg-red-100"
            onClick={dismissGenerationUi}
          >
            关闭
          </button>
        </div>
      ) : null}

      <GeneratorForm
        input={input}
        setInput={setInput}
        platform={platform}
        setPlatform={applyPlatform}
        scene={scene}
        setScene={setScene}
        sceneOptions={sceneOptions}
        modelId={modelId}
        setModelId={setModelId}
        generateMode={generateMode}
        setGenerateMode={setGenerateMode}
        onSubmit={onSubmit}
        onStop={handleStop}
        isLoading={isStreamingPhase}
      />

      <ResultPanel
        completion={completion}
        structured={structuredResult}
        busy={isStreamingPhase}
        onRewrite={(a) => void handleRewrite(a)}
      />

      <HistoryPanel
        history={history}
        sidebarOnlyRemoval={!!session}
        onSyncFromWorksPage={session ? syncFromWorksPage : undefined}
        historyHasMore={session ? historyHasMore : false}
        onLoadMoreHistory={session ? () => loadMoreHistory() : undefined}
        historyLoadingMore={session ? historyLoadingMore : false}
        historyRefreshing={session ? historyRefreshing : false}
        onSelect={(item) => {
          dispatch({ type: "RESET" });
          setInput(item.prompt);
          applyPlatform(item.platform, item.scene ?? null);
          setModelId(item.modelId);
          setStructuredResult(item.structuredJson ?? null);
          setGenerateMode(item.structuredJson ? "structured" : "plain");
          if (item.completion) setCompletion(item.completion);
          else setCompletion("");
        }}
        onDelete={(id) => void handleDelete(id)}
      />
    </main>
  );
}
