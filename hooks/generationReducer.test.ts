import {
  generationReducer,
  initialGenerationState,
  type GenerationAction,
  type GenerationState,
} from "@/hooks/generationReducer";

function reduce(state: GenerationState, action: GenerationAction): GenerationState {
  return generationReducer(state, action);
}

function start(requestId: number): GenerationAction {
  return { type: "START", requestId };
}

function success(requestId: number): GenerationAction {
  return { type: "SUCCESS", requestId };
}

function fail(requestId: number): GenerationAction {
  return { type: "FAIL", message: "x", requestId };
}

function abortDone(requestId: number): GenerationAction {
  return { type: "ABORT_DONE", requestId };
}

function successAutoIdle(requestId: number): GenerationAction {
  return { type: "SUCCESS_AUTO_IDLE", requestId };
}

// Lightweight assertions，方便在 node --test 或手动调用时观察行为。
function expect(cond: boolean, label: string): void {
  if (!cond) {
    // eslint-disable-next-line no-console
    console.error("[generationReducer test] failed:", label);
    throw new Error(label);
  }
}

export function runGenerationReducerSelfTest(): void {
  // 1) 基本 START
  let s = reduce(initialGenerationState, start(1));
  expect(s.phase === "generating", "START(1) sets phase generating");
  expect(s.activeRequestId === 1, "START(1) sets activeRequestId 1");

  // 2) START(2) 覆盖 requestId
  s = reduce(s, start(2));
  expect(s.phase === "generating", "START(2) stays generating");
  expect(s.activeRequestId === 2, "START(2) overrides activeRequestId to 2");

  // 3) 旧请求 1 的 SUCCESS / FAIL / ABORT_DONE 都应被忽略
  const afterOldSuccess = reduce(s, success(1));
  expect(
    afterOldSuccess.phase === "generating" && afterOldSuccess.activeRequestId === 2,
    "SUCCESS(1) ignored after START(2)"
  );

  const afterOldFail = reduce(s, fail(1));
  expect(
    afterOldFail.phase === "generating" && afterOldFail.activeRequestId === 2,
    "FAIL(1) ignored after START(2)"
  );

  const afterOldAbort = reduce(s, abortDone(1));
  expect(
    afterOldAbort.phase === "generating" && afterOldAbort.activeRequestId === 2,
    "ABORT_DONE(1) ignored after START(2)"
  );

  // 4) 新请求 2 的 SUCCESS 生效
  let s2 = reduce(s, success(2));
  expect(
    s2.phase === "success" && s2.activeRequestId === 2,
    "SUCCESS(2) moves to success for request 2"
  );

  // 5) SUCCESS_AUTO_IDLE 只在仍为该 request 的 success 时回 idle
  const idleAfterAuto = reduce(s2, successAutoIdle(2));
  expect(
    idleAfterAuto.phase === "idle" && idleAfterAuto.activeRequestId === 0,
    "SUCCESS_AUTO_IDLE(2) goes back to idle"
  );

  const restarted = reduce(idleAfterAuto, start(3));
  const ignoredAuto = reduce(restarted, successAutoIdle(2));
  expect(
    ignoredAuto.phase === "generating" && ignoredAuto.activeRequestId === 3,
    "SUCCESS_AUTO_IDLE(2) ignored after START(3)"
  );

  // eslint-disable-next-line no-console
  console.debug("[generationReducer test] all self-tests passed");
}

