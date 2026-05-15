"use client";

import type { StructuredContent } from "@/lib/types";
import {
  formatStructuredAsPlain,
  structuredContentAsPlainBody,
} from "@/lib/structured/format";
import { Button } from "@/components/ui/button";

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
      <Button
        type="button"
        size="xs"
        variant="secondary"
        className="shadow-sm"
        onClick={() => void navigator.clipboard.writeText(structured.title)}
      >
        复制标题
      </Button>
      <Button
        type="button"
        size="xs"
        variant="secondary"
        className="shadow-sm"
        onClick={() =>
          void navigator.clipboard.writeText(structuredContentAsPlainBody(structured))
        }
      >
        复制正文
      </Button>
      <Button
        type="button"
        size="xs"
        variant="secondary"
        className="shadow-sm"
        onClick={() =>
          void navigator.clipboard.writeText(formatStructuredAsPlain(structured))
        }
      >
        复制全部
      </Button>
    </div>
  );

  return (
    <div className="relative space-y-3">
      {actions === "overlay" ? (
        <div className="absolute top-0 right-0 flex flex-wrap gap-1 justify-end max-w-[min(100%,14rem)] z-10">
          {buttons}
        </div>
      ) : (
        <div className="flex flex-wrap justify-end gap-1 border-b border-border pb-2">{buttons}</div>
      )}

      <h3 className={`font-bold text-lg text-foreground ${actions === "overlay" ? "pr-36" : ""} ${titleClassName}`}>
        {structured.title}
      </h3>
      <div className="text-foreground whitespace-pre-wrap">
        {structuredContentAsPlainBody(structured)}
      </div>
      {structured.tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {structured.tags.map((t, i) => (
            <span
              key={`${i}-${t}`}
              className="text-xs px-2 py-0.5 rounded-full bg-card border border-border text-muted-foreground"
            >
              #{t.replace(/^#/, "")}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
