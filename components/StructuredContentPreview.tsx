import type { StructuredContent } from "@/lib/types";
import { formatStructuredAsPlain } from "@/lib/structured/format";

export type StructuredPreviewActions = "overlay" | "inline";

type Props = {
  structured: StructuredContent;
  /** overlay：右上角浮动按钮（首页结果区）；inline：详情内顶部横排 */
  actions?: StructuredPreviewActions;
  /** overlay 时为标题区预留右侧空间 */
  titleClassName?: string;
};

/**
 * 结构化正文展示 + 复制操作，供 ResultPanel 与作品库详情复用。
 */
export default function StructuredContentPreview({
  structured,
  actions = "inline",
  titleClassName = "",
}: Props) {
  const buttons = (
    <div className="flex flex-wrap gap-1">
      <button
        type="button"
        className="bg-white text-xs px-2 py-1 rounded shadow-sm border border-gray-200 hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors"
        onClick={() => void navigator.clipboard.writeText(structured.title)}
      >
        复制标题
      </button>
      <button
        type="button"
        className="bg-white text-xs px-2 py-1 rounded shadow-sm border border-gray-200 hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors"
        onClick={() => void navigator.clipboard.writeText(structured.body)}
      >
        复制正文
      </button>
      <button
        type="button"
        className="bg-white text-xs px-2 py-1 rounded shadow-sm border border-gray-200 hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors"
        onClick={() => void navigator.clipboard.writeText(formatStructuredAsPlain(structured))}
      >
        复制全部
      </button>
    </div>
  );

  return (
    <div className="relative space-y-3">
      {actions === "overlay" ? (
        <div className="absolute top-0 right-0 flex flex-wrap gap-1 justify-end max-w-[min(100%,14rem)] z-10">
          {buttons}
        </div>
      ) : (
        <div className="flex flex-wrap justify-end gap-1 border-b border-gray-200 pb-2">{buttons}</div>
      )}

      <h3 className={`font-bold text-lg text-gray-900 ${actions === "overlay" ? "pr-36" : ""} ${titleClassName}`}>
        {structured.title}
      </h3>
      <div className="text-gray-800 whitespace-pre-wrap">{structured.body}</div>
      {structured.tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {structured.tags.map((t, i) => (
            <span
              key={`${i}-${t}`}
              className="text-xs px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600"
            >
              #{t.replace(/^#/, "")}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
