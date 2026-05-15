"use client";

import ResultActions from "@/components/ResultActions";
import StreamingTextView from "@/components/StreamingTextView";
import type { RewriteAction } from "@/lib/types";

type Props = {
  completion: string;
  busy?: boolean;
  onRewrite?: (action: RewriteAction) => void;
};

export default function ResultPanel({ completion, busy, onRewrite }: Props) {
  if (!completion) return null;

  const showRewrite = !!onRewrite && completion.trim().length > 0;

  return (
    <section className="mt-6 space-y-4 bg-muted/40 p-4 rounded-lg relative border border-border">
      <ResultActions
        busy={!!busy}
        showRewrite={showRewrite}
        onRewrite={onRewrite}
      />

      <StreamingTextView completion={completion} showCopyButton />
    </section>
  );
}
