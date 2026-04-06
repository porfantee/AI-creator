import {
  useCallback,
  type Dispatch,
  type FormEvent,
  type MutableRefObject,
} from "react";
import type {
  GenerateMode,
  GenerateStructuredApiResponse,
  ModelId,
  Platform,
  RewriteAction,
  SceneId,
  StructuredContent,
} from "@/lib/types";
import {
  scheduleGenerationSuccessReset,
  type GenerationAction,
} from "@/hooks/generationReducer";
import { formatStructuredAsPlain } from "@/lib/structured/format";
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
  structured?: StructuredContent | null
) => Promise<void>;

type UseHomeGenerationArgs = {
  dispatch: Dispatch<GenerationAction>;
  refs: HomeGenerationRefs;
  input: string;
  platform: Platform;
  scene: SceneId;
  modelId: ModelId;
  generateMode: GenerateMode;
  /** generating / stopping / success 时禁止重复提交 */
  isBusy: boolean;
  structuredResult: StructuredContent | null;
  completion: string;
  setCompletion: (v: string | ((prev: string) => string)) => void;
  setStructuredResult: (v: StructuredContent | null) => void;
  persistSuccess: PersistSuccess;
};

function failMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function useHomeGeneration({
  dispatch,
  refs,
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
}: UseHomeGenerationArgs) {
  const { requestIdRef, abortControllerRef, submitLockRef, stopCooldownUntilRef, rafIdRef } =
    refs;

  const streamFromApi = useCallback(
    async (
      url: string,
      body: Record<string, unknown>,
      meta: {
        submittedPlatform: Platform;
        submittedScene: SceneId;
        submittedModelId: ModelId;
        submittedPrompt: string;
      },
      options: {
        clearCompletion: boolean;
        errorHint: string;
        beforeStream?: () => void;
      }
    ) => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const id = ++requestIdRef.current;
      const isCurrent = () => id === requestIdRef.current;

      dispatch({ type: "START", requestId: id });
      if (options.clearCompletion) setCompletion("");
      options.beforeStream?.();

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        await throwIfResponseNotOk(res);

        const fullText = await readPlainTextStreamResponse(res, {
          isCurrent,
          setText: setCompletion,
          rafRef: rafIdRef,
        });

        if (isCurrent()) {
          try {
            await persistSuccess(
              meta.submittedPlatform,
              meta.submittedScene,
              meta.submittedModelId,
              meta.submittedPrompt,
              fullText,
              null
            );
            dispatch({ type: "SUCCESS", requestId: id });
            scheduleGenerationSuccessReset(dispatch, id);
          } catch (persistErr) {
            console.error(persistErr);
            const msg = failMessage(persistErr, "保存失败，请稍后重试。");
            dispatch({ type: "FAIL", message: msg, requestId: id });
          }
        }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") {
          dispatch({ type: "ABORT_DONE", requestId: id });
          return;
        }
        console.error(err);
        if (!isCurrent()) return;
        const msg = failMessage(err, options.errorHint);
        setCompletion(msg);
        dispatch({ type: "FAIL", message: msg, requestId: id });
      }
    },
    [dispatch, abortControllerRef, requestIdRef, rafIdRef, setCompletion, persistSuccess]
  );

  const handleStop = useCallback(() => {
    const rid = requestIdRef.current;
    dispatch({ type: "STOPPING", requestId: rid });
    abortControllerRef.current?.abort();
    stopCooldownUntilRef.current = Date.now() + 450;
  }, [dispatch, requestIdRef, abortControllerRef, stopCooldownUntilRef]);

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
        const meta = {
          submittedPlatform: platform,
          submittedScene: scene,
          submittedModelId: modelId,
          submittedPrompt,
        };

        if (generateMode === "structured") {
          abortControllerRef.current?.abort();
          const controller = new AbortController();
          abortControllerRef.current = controller;

          const id = ++requestIdRef.current;
          const isCurrent = () => id === requestIdRef.current;

          dispatch({ type: "START", requestId: id });
          setCompletion("");
          setStructuredResult(null);

          try {
            const res = await fetch("/api/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt: submittedPrompt,
                platform,
                scene,
                modelId,
                mode: "structured",
              }),
              signal: controller.signal,
            });
            await throwIfResponseNotOk(res);
            const data = (await res.json()) as
              | GenerateStructuredApiResponse
              | { error?: string };
            if (!isCurrent()) return;

            if (data && "mode" in data && data.mode === "structured" && data.structured) {
              const plain = formatStructuredAsPlain(data.structured);
              setStructuredResult(data.structured);
              setCompletion(plain);
              try {
                await persistSuccess(
                  meta.submittedPlatform,
                  meta.submittedScene,
                  meta.submittedModelId,
                  meta.submittedPrompt,
                  plain,
                  data.structured
                );
                dispatch({ type: "SUCCESS", requestId: id });
                scheduleGenerationSuccessReset(dispatch, id);
              } catch (persistErr) {
                console.error(persistErr);
                const msg = failMessage(persistErr, "保存失败，请稍后重试。");
                dispatch({ type: "FAIL", message: msg, requestId: id });
              }
            } else {
              throw new Error("响应格式异常");
            }
          } catch (err) {
            if ((err as Error)?.name === "AbortError") {
              dispatch({ type: "ABORT_DONE", requestId: id });
              return;
            }
            console.error(err);
            if (!isCurrent()) return;
            const msg = failMessage(err, "结构化生成失败，请稍后重试。");
            setCompletion(msg);
            setStructuredResult(null);
            dispatch({ type: "FAIL", message: msg, requestId: id });
          }
          return;
        }

        await streamFromApi(
          "/api/generate",
          {
            prompt: submittedPrompt,
            platform,
            scene,
            modelId,
            mode: "plain",
          },
          meta,
          {
            clearCompletion: true,
            errorHint: "生成失败，请稍后重试。",
            beforeStream: () => setStructuredResult(null),
          }
        );
      } finally {
        submitLockRef.current = false;
      }
    },
    [
      submitLockRef,
      stopCooldownUntilRef,
      input,
      platform,
      scene,
      modelId,
      generateMode,
      abortControllerRef,
      requestIdRef,
      dispatch,
      setCompletion,
      setStructuredResult,
      persistSuccess,
      streamFromApi,
      isBusy,
    ]
  );

  const handleRewrite = useCallback(
    async (action: RewriteAction) => {
      if (isBusy) return;

      const submittedPrompt = input;
      const meta = {
        submittedPlatform: platform,
        submittedScene: scene,
        submittedModelId: modelId,
        submittedPrompt,
      };

      const snapshot = structuredResult;
      if (snapshot) {
        abortControllerRef.current?.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const id = ++requestIdRef.current;
        const isCurrent = () => id === requestIdRef.current;

        dispatch({ type: "START", requestId: id });
        setCompletion("");
        setStructuredResult(null);

        try {
          const res = await fetch("/api/rewrite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action,
              platform,
              scene,
              modelId,
              originalPrompt: submittedPrompt,
              mode: "structured",
              structuredJson: snapshot,
            }),
            signal: controller.signal,
          });
          await throwIfResponseNotOk(res);
          const data = (await res.json()) as GenerateStructuredApiResponse | { error?: string };
          if (!isCurrent()) return;

          if (data && "mode" in data && data.mode === "structured" && data.structured) {
            const plain = formatStructuredAsPlain(data.structured);
            setStructuredResult(data.structured);
            setCompletion(plain);
            try {
              await persistSuccess(
                meta.submittedPlatform,
                meta.submittedScene,
                meta.submittedModelId,
                meta.submittedPrompt,
                plain,
                data.structured
              );
              dispatch({ type: "SUCCESS", requestId: id });
              scheduleGenerationSuccessReset(dispatch, id);
            } catch (persistErr) {
              console.error(persistErr);
              const msg = failMessage(persistErr, "保存失败，请稍后重试。");
              dispatch({ type: "FAIL", message: msg, requestId: id });
            }
          } else {
            throw new Error("响应格式异常");
          }
        } catch (err) {
          if ((err as Error)?.name === "AbortError") {
            dispatch({ type: "ABORT_DONE", requestId: id });
            return;
          }
          console.error(err);
          if (!isCurrent()) return;
          const msg = failMessage(err, "结构化改写失败，请稍后重试。");
          setCompletion(msg);
          setStructuredResult(null);
          dispatch({ type: "FAIL", message: msg, requestId: id });
        }
        return;
      }

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
        meta,
        {
          clearCompletion: true,
          errorHint: "改写失败，请稍后重试。",
          beforeStream: () => setStructuredResult(null),
        }
      );
    },
    [
      input,
      platform,
      scene,
      modelId,
      abortControllerRef,
      requestIdRef,
      dispatch,
      setCompletion,
      setStructuredResult,
      persistSuccess,
      streamFromApi,
      isBusy,
      structuredResult,
      completion,
    ]
  );

  return { onSubmit, handleStop, handleRewrite };
}
