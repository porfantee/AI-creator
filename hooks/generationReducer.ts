import type { Dispatch } from "react";

export type GenerationPhase =
  | "idle"
  | "submitting"
  | "streaming"
  | "parsing"
  | "persisting"
  | "success"
  | "error"
  | "aborted";

export type GenerationPayload = {
  kind: "generate" | "rewrite";
  mode: "plain" | "structured";
  platform: string;
  scene?: string | null;
  modelId: string;
  input: string;
  rewriteAction?: string;
};

export type GenerationState = {
  phase: GenerationPhase;
  errorMessage: string | null;
  /** 当前生效的请求代次；0 表示无进行中请求 */
  activeRequestId: number;
  /** 最近一次真正提交的参数，用于 retry */
  lastSubmittedPayload: GenerationPayload | null;
  /** 最近一次提交来源：普通提交或重试 */
  submitReason: "submit" | "retry" | null;
};

export type GenerationAction =
  | {
      type: "SUBMIT_REQUESTED";
      requestId: number;
      payload: GenerationPayload;
      reason: "submit" | "retry";
    }
  | {
      type: "REQUEST_ACCEPTED";
      requestId: number;
      mode: "plain" | "structured";
    }
  | { type: "STRUCTURED_PARSE_STARTED"; requestId: number }
  | { type: "PERSIST_STARTED"; requestId: number }
  | { type: "REQUEST_SUCCEEDED"; requestId: number }
  | { type: "REQUEST_ABORTED"; requestId: number }
  | { type: "REQUEST_FAILED"; message: string; requestId: number }
  | { type: "RESET" }
  | { type: "SUCCESS_AUTO_IDLE"; requestId: number };

function matchesRequest(state: GenerationState, requestId: number): boolean {
  return requestId > 0 && state.activeRequestId === requestId;
}

function reduceGenerationState(
  state: GenerationState,
  action: GenerationAction
): GenerationState {
  switch (action.type) {
    case "SUBMIT_REQUESTED": {
      if (action.requestId <= 0) return state;
      return {
        phase: "submitting",
        errorMessage: null,
        activeRequestId: action.requestId,
        lastSubmittedPayload: action.payload,
        submitReason: action.reason,
      };
    }

    case "REQUEST_ACCEPTED": {
      if (
        state.phase !== "submitting" ||
        !matchesRequest(state, action.requestId)
      ) {
        return state;
      }

      return {
        ...state,
        phase: action.mode === "plain" ? "streaming" : "parsing",
      };
    }

    case "STRUCTURED_PARSE_STARTED": {
      if (
        (state.phase === "submitting" || state.phase === "streaming") &&
        matchesRequest(state, action.requestId)
      ) {
        return {
          ...state,
          phase: "parsing",
        };
      }
      return state;
    }

    case "PERSIST_STARTED": {
      if (
        (state.phase === "streaming" || state.phase === "parsing") &&
        matchesRequest(state, action.requestId)
      ) {
        return {
          ...state,
          phase: "persisting",
        };
      }
      return state;
    }

    case "REQUEST_SUCCEEDED": {
      if (
        (state.phase === "submitting" ||
          state.phase === "streaming" ||
          state.phase === "parsing" ||
          state.phase === "persisting") &&
        matchesRequest(state, action.requestId)
      ) {
        return {
          ...state,
          phase: "success",
          errorMessage: null,
          activeRequestId: action.requestId,
        };
      }
      return state;
    }

    case "REQUEST_ABORTED": {
      if (
        (state.phase === "submitting" ||
          state.phase === "streaming" ||
          state.phase === "parsing" ||
          state.phase === "persisting") &&
        matchesRequest(state, action.requestId)
      ) {
        return {
          ...state,
          phase: "aborted",
          errorMessage: null,
          activeRequestId: 0,
        };
      }
      return state;
    }

    case "REQUEST_FAILED": {
      if (
        (state.phase === "submitting" ||
          state.phase === "streaming" ||
          state.phase === "parsing" ||
          state.phase === "persisting") &&
        matchesRequest(state, action.requestId)
      ) {
        return {
          ...state,
          phase: "error",
          errorMessage: action.message,
          activeRequestId: 0,
        };
      }
      return state;
    }

    case "RESET":
      return initialGenerationState;

    case "SUCCESS_AUTO_IDLE": {
      if (state.phase === "success" && matchesRequest(state, action.requestId)) {
        return {
          ...state,
          phase: "idle",
          errorMessage: null,
          activeRequestId: 0,
        };
      }
      return state;
    }

    default:
      return state;
  }
}

export function generationReducer(
  state: GenerationState,
  action: GenerationAction
): GenerationState {
  const next = reduceGenerationState(state, action);
  logGenerationTransition(state, action, next);
  return next;
}

export const initialGenerationState: GenerationState = {
  phase: "idle",
  errorMessage: null,
  activeRequestId: 0,
  lastSubmittedPayload: null,
  submitReason: null,
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
  console.debug("[generation]", {
    action,
    prev: { phase: prev.phase, activeRequestId: prev.activeRequestId },
    next: { phase: next.phase, activeRequestId: next.activeRequestId },
  });
}