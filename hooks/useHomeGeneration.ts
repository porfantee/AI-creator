import {
  useCallback,
  type Dispatch,
  type FormEvent,
  type MutableRefObject,
} from "react";
import type { ModelId, Platform, RewriteAction, SceneId } from "@/lib/types";
import {
  scheduleGenerationSuccessReset,
  type GenerationAction,
  type GenerationPayload,
} from "@/hooks/generationReducer";
import { throwIfResponseNotOk } from "@/utils/http";
import { readPlainTextStreamResponse } from "@/utils/readPlainTextStream";

export type HomeGenerationRefs = {
  requestIdRef: MutableRefObject<number>;
  abortControllerRef: MutableRefObject<AbortController | null>;
  submitLockRef: MutableRefObject<boolean>;
  stopCooldownUntilRef: MutableRefObject<number>;
  rafIdRef: MutableRefObject<number | null>;
};

type PersistSuccess = (
  submittedPlatform: Platform,
  submittedScene: SceneId,
  submittedModelId: ModelId,
  submittedPrompt: string,
  text: string,
  structured: null
) => Promise<void>;

type UseHomeGenerationArgs = {
  dispatch: Dispatch<GenerationAction>;
  refs: HomeGenerationRefs;
  input: string;
  platform: Platform;
  scene: SceneId;
  modelId: ModelId;
  /** submitting / streaming / parsing / persisting 时禁止重复提交 */
  isBusy: boolean;
  completion: string;
  setCompletion: (v: string | ((prev: string) => string)) => void;
  persistSuccess: PersistSuccess;
};

function failMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function isAbortError(err: unknown): boolean {
  return (err as Error)?.name === "AbortError";
}

function beginRequest(
  requestIdRef: MutableRefObject<number>,
  abortControllerRef: MutableRefObject<AbortController | null>
) {
  abortControllerRef.current?.abort();
  const controller = new AbortController();
  abortControllerRef.current = controller;

  const id = ++requestIdRef.current;
  const isCurrent = () => id === requestIdRef.current;

  return { id, controller, isCurrent };
}

export function useHomeGeneration({
  dispatch,
  refs,
  input,
  platform,
  scene,
  modelId,
  isBusy,
  completion,
  setCompletion,
  persistSuccess,
}: UseHomeGenerationArgs) {
  const {
    requestIdRef,
    abortControllerRef,
    submitLockRef,
    stopCooldownUntilRef,
    rafIdRef,
  } = refs;

  const streamFromApi = useCallback(
    async (
      url: string,
      body: Record<string, unknown>,
      payload: GenerationPayload,
      options: {
        clearCompletion: boolean;
        errorHint: string;
      }
    ) => {
      const { id, controller, isCurrent } = beginRequest(
        requestIdRef,
        abortControllerRef
      );

      dispatch({
        type: "SUBMIT_REQUESTED",
        requestId: id,
        payload,
        reason: "submit",
      });

      if (options.clearCompletion) setCompletion("");

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        await throwIfResponseNotOk(res);

        if (!isCurrent()) return;

        dispatch({
          type: "REQUEST_ACCEPTED",
          requestId: id,
          mode: "plain",
        });

        const fullText = await readPlainTextStreamResponse(res, {
          isCurrent,
          setText: setCompletion,
          rafRef: rafIdRef,
        });

        if (!isCurrent()) return;

        dispatch({ type: "PERSIST_STARTED", requestId: id });

        await persistSuccess(
          payload.platform as Platform,
          (payload.scene ?? scene) as SceneId,
          payload.modelId as ModelId,
          payload.input,
          fullText,
          null
        );

        if (!isCurrent()) return;

        dispatch({ type: "REQUEST_SUCCEEDED", requestId: id });
        scheduleGenerationSuccessReset(dispatch, id);
      } catch (err) {
        if (isAbortError(err)) {
          if (isCurrent()) {
            dispatch({ type: "REQUEST_ABORTED", requestId: id });
          }
          return;
        }

        console.error(err);
        if (!isCurrent()) return;

        const msg = failMessage(err, options.errorHint);
        setCompletion(msg);
        dispatch({ type: "REQUEST_FAILED", message: msg, requestId: id });
      }
    },
    [
      abortControllerRef,
      dispatch,
      persistSuccess,
      rafIdRef,
      requestIdRef,
      scene,
      setCompletion,
    ]
  );

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
    stopCooldownUntilRef.current = Date.now() + 450;
  }, [abortControllerRef, stopCooldownUntilRef]);

  /**
   * 作废当前在途生成：中止 fetch、取消流式 RAF、抬升 requestId。
   * 页面在 RESET / 切换历史等场景只调此方法即可，不必关心 ref 细节。
   */
  const discardInFlightGeneration = useCallback((): void => {
    abortControllerRef.current?.abort();
    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    requestIdRef.current += 1;
  }, [abortControllerRef, rafIdRef, requestIdRef]);

  const onSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (isBusy) return;
      if (submitLockRef.current) return;
      if (Date.now() < stopCooldownUntilRef.current) return;
      if (!input.trim()) return;

      submitLockRef.current = true;
      try {
        const submittedPrompt = input;

        await streamFromApi(
          "/api/generate",
          {
            prompt: submittedPrompt,
            platform,
            scene,
            modelId,
          },
          {
            kind: "generate",
            mode: "plain",
            platform,
            scene,
            modelId,
            input: submittedPrompt,
          },
          {
            clearCompletion: true,
            errorHint: "生成失败，请稍后重试。",
          }
        );
      } finally {
        submitLockRef.current = false;
      }
    },
    [
      input,
      isBusy,
      modelId,
      platform,
      scene,
      stopCooldownUntilRef,
      streamFromApi,
      submitLockRef,
    ]
  );

  const handleRewrite = useCallback(
    async (action: RewriteAction) => {
      if (isBusy) return;

      const submittedPrompt = input;
      const current = completion.trim();
      if (!current) return;

      await streamFromApi(
        "/api/rewrite",
        {
          action,
          platform,
          scene,
          modelId,
          originalPrompt: submittedPrompt,
          currentContent: current,
        },
        {
          kind: "rewrite",
          mode: "plain",
          platform,
          scene,
          modelId,
          input: submittedPrompt,
          rewriteAction: action,
        },
        {
          clearCompletion: true,
          errorHint: "改写失败，请稍后重试。",
        }
      );
    },
    [completion, input, isBusy, modelId, platform, scene, streamFromApi]
  );

  return { onSubmit, handleStop, handleRewrite, discardInFlightGeneration };
}
