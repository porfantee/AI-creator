import type { Dispatch } from "react";

export type GenerationPhase =
  | "idle"
  | "generating"
  | "stopping"
  | "success"
  | "error";

export type GenerationState = {
  phase: GenerationPhase;
  errorMessage: string | null;
  /** 当前生效的请求代次；0 表示无进行中请求 */
  activeRequestId: number;
};

export type GenerationAction =
  | { type: "START"; requestId: number }
  | { type: "STOPPING"; requestId: number }
  /** 中止（Abort）链路收尾：generating/stopping → idle；成功路径用 SUCCESS，不走此项 */
  | { type: "ABORT_DONE"; requestId: number }
  | { type: "SUCCESS"; requestId: number }
  | { type: "FAIL"; message: string; requestId: number }
  /** 用户触发的全量重置（关错误条、选历史、继续编辑等） */
  | { type: "RESET" }
  /**
   * 成功提示条倒计时结束：仅当仍是「该次 requestId 的 success」时才回 idle，
   * 避免 1.2s 内用户已开新请求时被误清。
   */
  | { type: "SUCCESS_AUTO_IDLE"; requestId: number };

function matchesRequest(state: GenerationState, requestId: number): boolean {
  return requestId > 0 && state.activeRequestId === requestId;
}

export function generationReducer(
  state: GenerationState,
  action: GenerationAction
): GenerationState {
  let next: GenerationState = state;
  switch (action.type) {
    case "START":
      if (action.requestId <= 0) return state;
      return {
        phase: "generating",
        errorMessage: null,
        activeRequestId: action.requestId,
      };

    case "STOPPING":
      if (
        state.phase === "generating" &&
        matchesRequest(state, action.requestId)
      ) {
        return {
          ...state,
          phase: "stopping",
        };
      }
      return state;

    case "ABORT_DONE":
      if (
        (state.phase === "stopping" || state.phase === "generating") &&
        matchesRequest(state, action.requestId)
      ) {
        return {
          phase: "idle",
          errorMessage: null,
          activeRequestId: 0,
        };
      }
      return state;

    case "SUCCESS":
      if (
        state.phase === "generating" &&
        matchesRequest(state, action.requestId)
      ) {
        return {
          phase: "success",
          errorMessage: null,
          activeRequestId: action.requestId,
        };
      }
      return state;

    case "FAIL":
      if (
        (state.phase === "generating" || state.phase === "stopping") &&
        matchesRequest(state, action.requestId)
      ) {
        return {
          phase: "error",
          errorMessage: action.message,
          activeRequestId: 0,
        };
      }
      return state;

    case "RESET":
      return initialGenerationState;

    case "SUCCESS_AUTO_IDLE":
      if (state.phase === "success" && matchesRequest(state, action.requestId)) {
        return initialGenerationState;
      }
      return state;

    default:
      next = state;
  }
  logGenerationTransition(state, action, next);
  return next;
}

export const initialGenerationState: GenerationState = {
  phase: "idle",
  errorMessage: null,
  activeRequestId: 0,
};

const SUCCESS_RESET_MS = 1200;

export function scheduleGenerationSuccessReset(
  dispatch: Dispatch<GenerationAction>,
  successRequestId: number
) {
  if (typeof window === "undefined") return;
  window.setTimeout(() => {
    dispatch({ type: "SUCCESS_AUTO_IDLE", requestId: successRequestId });
  }, SUCCESS_RESET_MS);
}

/** 开发环境辅助日志：追踪 phase / activeRequestId 与关键 action。 */
function logGenerationTransition(
  prev: GenerationState,
  action: GenerationAction,
  next: GenerationState
): void {
  if (process.env.NODE_ENV !== "development") return;
  if (typeof window === "undefined") return;
  // eslint-disable-next-line no-console
  console.debug("[generation]", {
    action,
    prev: { phase: prev.phase, activeRequestId: prev.activeRequestId },
    next: { phase: next.phase, activeRequestId: next.activeRequestId },
  });
}

