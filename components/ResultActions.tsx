"use client";

import { memo } from "react";
import type { RewriteAction } from "@/lib/types";
import { REWRITE_ACTIONS, getRewriteActionLabel } from "@/lib/rewrite-actions";
import { Button } from "@/components/ui/button";

type Props = {
  busy: boolean;
  showRewrite: boolean;
  onRewrite?: (action: RewriteAction) => void;
};

function ResultActionsInner({ busy, showRewrite, onRewrite }: Props) {
  if (!showRewrite || !onRewrite) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-3 pr-4">
      {REWRITE_ACTIONS.map((action) => (
        <Button
          key={action}
          type="button"
          size="xs"
          variant="outline"
          disabled={busy}
          onClick={() => onRewrite(action)}
        >
          {getRewriteActionLabel(action)}
        </Button>
      ))}
    </div>
  );
}

const ResultActions = memo(ResultActionsInner);
export default ResultActions;
