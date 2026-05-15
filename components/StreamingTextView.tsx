"use client";

import { memo } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  completion: string;
  /** 纯文本结果区右上角「复制结果」 */
  showCopyButton?: boolean;
};

function StreamingTextViewInner({ completion, showCopyButton }: Props) {
  if (!completion) {
    return (
      <div className="rounded-xl border bg-white p-4 text-sm text-gray-400">
        生成结果将在这里显示
      </div>
    );
  }

  return (
    <div className="relative rounded-xl border bg-white p-4">
      {showCopyButton ? (
        <div className="absolute top-3 right-3">
          <Button
            type="button"
            size="xs"
            variant="secondary"
            className="rounded-full shadow-sm"
            onClick={() => void navigator.clipboard.writeText(completion)}
          >
            复制结果
          </Button>
        </div>
      ) : null}
      <div className="whitespace-pre-wrap break-words pr-4 text-sm leading-6 text-gray-900">
        {completion}
      </div>
    </div>
  );
}

const StreamingTextView = memo(StreamingTextViewInner);
export default StreamingTextView;
