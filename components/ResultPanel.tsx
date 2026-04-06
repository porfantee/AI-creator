import type { RewriteAction, StructuredContent } from "@/lib/types";
import { REWRITE_ACTIONS, getRewriteActionLabel } from "@/lib/rewrite-actions";
import StructuredContentPreview from "@/components/StructuredContentPreview";

type Props = {
  completion: string;
  structured: StructuredContent | null;
  busy?: boolean;
  onRewrite?: (action: RewriteAction) => void;
};

export default function ResultPanel({ completion, structured, busy, onRewrite }: Props) {
  if (!structured && !completion) return null;

  const showRewrite = !!onRewrite && completion.trim().length > 0;

  return (
    <div className="mt-6 bg-gray-50 p-4 rounded relative">
      {!structured ? (
        <div className="absolute top-3 right-3">
          <button
            type="button"
            className="bg-white text-xs px-3 py-1 rounded-full shadow-sm hover:bg-red-500 hover:text-white transition-colors"
            onClick={() => void navigator.clipboard.writeText(completion)}
          >
            复制结果
          </button>
        </div>
      ) : null}

      {showRewrite ? (
        <div className="flex flex-wrap gap-2 mb-3 pr-4">
          {REWRITE_ACTIONS.map((action) => (
            <button
              key={action}
              type="button"
              disabled={!!busy}
              className="text-xs px-2.5 py-1 rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => onRewrite(action)}
            >
              {getRewriteActionLabel(action)}
            </button>
          ))}
        </div>
      ) : null}

      {structured ? (
        <StructuredContentPreview structured={structured} actions="inline" />
      ) : (
        <div className="whitespace-pre-wrap text-gray-800">{completion}</div>
      )}
    </div>
  );
}
