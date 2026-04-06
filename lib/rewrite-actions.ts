import type { RewriteAction } from "@/lib/types";

export const REWRITE_ACTIONS: readonly RewriteAction[] = [
  "shorter",
  "colloquial",
  "professional",
  "regenerate",
] as const;

const LABELS: Record<RewriteAction, string> = {
  shorter: "更短一点",
  colloquial: "更口语化",
  professional: "更专业一点",
  regenerate: "再来一版",
};

export function isRewriteAction(value: string): value is RewriteAction {
  return (REWRITE_ACTIONS as readonly string[]).includes(value);
}

export function getRewriteActionLabel(action: RewriteAction): string {
  return LABELS[action];
}
