"use client";

import { memo } from "react";
import type { StructuredContent } from "@/lib/types";
import StructuredContentPreview from "@/components/StructuredContentPreview";

type Props = {
  structured: StructuredContent | null;
};

function StructuredPreviewSectionInner({ structured }: Props) {
  if (!structured) return null;

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-gray-700">结构化预览</div>
      <StructuredContentPreview structured={structured} actions="inline" />
    </div>
  );
}

const StructuredPreviewSection = memo(StructuredPreviewSectionInner);
export default StructuredPreviewSection;
