"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import GeneratorForm from "@/components/GeneratorForm";
import ResultPanel from "@/components/ResultPanel";
import HistoryPanel from "@/components/HistoryPanel";
import { useComposerInput } from "@/hooks/useComposerInput";
import { useGenerateResult } from "@/hooks/useGenerateResult";
import { useGenerationRefs } from "@/hooks/useGenerationRefs";
import { useGenerationLifecycle } from "@/hooks/useGenerationLifecycle";
import {
  useHomeGeneration,
  type HomeGenerationRefs,
} from "@/hooks/useHomeGeneration";
import { useWorkHistory } from "@/hooks/useWorkHistory";
import { consumeContinueEditPayload } from "@/lib/continue-edit";
import { useCloudWorksStore } from "@/stores/cloudWorksStore";

const BUSY_PHASES = new Set([
  "submitting",
  "streaming",
  "parsing",
  "persisting",
]);

const STOPPABLE_PHASES = new Set([
  "submitting",
  "streaming",
  "parsing",
]);

const RESULT_BUSY_PHASES = new Set([
  "submitting",
  "streaming",
  "parsing",
  "persisting",
]);

export default function Page() {
  const { data: session, status } = useSession();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const [generationState, dispatch] = useGenerationLifecycle();

  const isBusy = BUSY_PHASES.has(generationState.phase);
  const canStop = STOPPABLE_PHASES.has(generationState.phase);
  const resultBusy = RESULT_BUSY_PHASES.has(generationState.phase);

  const {
    input,
    setInput,
    platform,
    scene,
    setScene,
    modelId,
    setModelId,
    applyPlatform,
    sceneOptions,
  } = useComposerInput();

  const { completion, setCompletion, rafIdRef } = useGenerateResult();

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

  const syncFromWorksPage = useCallback(() => {
    const snap = useCloudWorksStore.getState();
    if (snap.worksItems.length === 0) return;
    snap.setWorksFromFetch(snap.worksItems, { clearSidebarHidden: true });
  }, []);

  const { onSubmit, handleStop, handleRewrite, discardInFlightGeneration } =
    useHomeGeneration({
      dispatch,
      refs: homeRefs,
      input,
      platform,
      scene,
      modelId,
      isBusy,
      completion,
      setCompletion,
      persistSuccess,
    });

  const dismissGenerationUi = useCallback(() => {
    discardInFlightGeneration();
    dispatch({ type: "RESET" });
  }, [dispatch, discardInFlightGeneration]);

  useEffect(() => {
    if (continueEditAppliedRef.current) return;

    const payload = consumeContinueEditPayload();
    if (!payload) return;

    continueEditAppliedRef.current = true;

    discardInFlightGeneration();
    dispatch({ type: "RESET" });

    applyPlatform(payload.platform, payload.scene);
    setModelId(payload.modelId);
    setInput(payload.prompt);
    setCompletion(payload.completion);
  }, [
    dispatch,
    applyPlatform,
    setModelId,
    setInput,
    setCompletion,
    continueEditAppliedRef,
    discardInFlightGeneration,
  ]);

  return (
    <main className="min-h-screen bg-gray-50/40">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-5 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              🍎AI内容创作平台
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
                <span className="max-w-[200px] truncate text-gray-600">
                  {session.user?.name ?? session.user?.email ?? "已登录"}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void signOut()}
                >
                  退出
                </Button>
              </>
            ) : (
              <> <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void signIn("github")}
              >
                GitHub 登录
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void signIn("google")}
                >
                  Google 登录
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="mb-6 space-y-3">
          {generationState.phase === "success" ? (
            <p className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              生成成功
            </p>
          ) : null}

          {generationState.phase === "aborted" ? (
            <p className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              已停止生成
            </p>
          ) : null}

          {generationState.phase === "error" &&
            generationState.errorMessage ? (
            <div className="flex flex-wrap items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <span className="min-w-0 flex-1">
                {generationState.errorMessage}
              </span>
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="shrink-0 border-red-300 hover:bg-red-100"
                onClick={dismissGenerationUi}
              >
                关闭
              </Button>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col items-start gap-6 lg:flex-row lg:gap-12 xl:gap-16">
          <aside
            className={`shrink-0 transition-all duration-300 ${isCollapsed ? "w-full lg:w-12" : "w-full lg:w-[320px]"
              }`}
          >
            <div className="lg:sticky lg:top-6">
              {isCollapsed ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 rounded-xl p-0"
                  onClick={() => setIsCollapsed(false)}
                  aria-label="展开历史记录"
                  title="展开历史记录"
                >
                  ☰
                </Button>
              ) : (
                <HistoryPanel
                  history={history}
                  sidebarOnlyRemoval={!!session}
                  onSyncFromWorksPage={session ? syncFromWorksPage : undefined}
                  historyHasMore={session ? historyHasMore : false}
                  onLoadMoreHistory={session ? () => loadMoreHistory() : undefined}
                  historyLoadingMore={session ? historyLoadingMore : false}
                  historyRefreshing={session ? historyRefreshing : false}
                  headerAction={
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 rounded-lg p-0"
                      onClick={() => setIsCollapsed(true)}
                      aria-label="收起历史记录"
                      title="收起历史记录"
                    >
                      ‹
                    </Button>
                  }
                  onSelect={(item) => {
                    discardInFlightGeneration();
                    dispatch({ type: "RESET" });
                    setInput(item.prompt);
                    applyPlatform(item.platform, item.scene ?? null);
                    setModelId(item.modelId);
                    setCompletion(item.completion || "");
                  }}
                  onDelete={(id) => void handleDelete(id)}
                />
              )}
            </div>
          </aside>

          <section className="min-w-0 flex-1 w-full">
            <div
              className={`mx-auto w-full space-y-6 transition-all duration-300 ${isCollapsed ? "max-w-4xl" : "max-w-3xl"
                }`}
            >
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
                onSubmit={onSubmit}
                onStop={handleStop}
                isBusy={isBusy}
                canStop={canStop}
              />

              <ResultPanel
                completion={completion}
                busy={resultBusy}
                onRewrite={(a) => void handleRewrite(a)}
              />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}