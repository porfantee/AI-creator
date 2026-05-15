"use client";

import type { ModelId, Platform, SceneId } from "@/lib/types";
import type { SceneOption } from "@/lib/scenes";
import { MODEL_OPTIONS } from "@/lib/models";
import { getPlatformLabel } from "@/lib/platform-label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  input: string;
  setInput: (v: string) => void;
  platform: Platform;
  setPlatform: (v: Platform) => void;
  scene: SceneId;
  setScene: (v: SceneId) => void;
  sceneOptions: SceneOption[];
  modelId: ModelId;
  setModelId: (v: ModelId) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onStop: () => void;
  /** 整段生成流程进行中（含持久化），用于禁止重复提交等 */
  isBusy?: boolean;
  /** 仍可中止网络/流式阶段时为 true；持久化等阶段为 false */
  canStop?: boolean;
};

export default function GeneratorForm({
  input,
  setInput,
  platform,
  setPlatform,
  scene,
  setScene,
  sceneOptions,
  modelId,
  setModelId,
  onSubmit,
  onStop,
  isBusy = false,
  /** 未传时与旧版单 isLoading 行为一致：忙即显示停止 */
  canStop = isBusy,
}: Props) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <Select
          disabled={isBusy}
          value={platform}
          onValueChange={(v) => {
            if (v != null) setPlatform(v as Platform);
          }}
        >
          <SelectTrigger className="min-w-[8rem] w-[8rem]">
            <SelectValue>
              {(v) =>
                v != null && v !== ""
                  ? getPlatformLabel(v as Platform)
                  : null}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="xhs">小红书</SelectItem>
            <SelectItem value="weibo">微博</SelectItem>
            <SelectItem value="zhihu">知乎</SelectItem>
          </SelectContent>
        </Select>

        <Select
          disabled={isBusy}
          value={scene}
          onValueChange={(v) => {
            if (v != null) setScene(v as SceneId);
          }}
        >
          <SelectTrigger className="min-w-[10rem] w-[10rem]">
            <SelectValue>
              {(v) => {
                if (v == null || v === "") return null;
                const opt = sceneOptions.find((o) => o.id === v);
                return opt?.label ?? String(v);
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {sceneOptions.map((opt) => (
              <SelectItem key={opt.id} value={opt.id}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          disabled={isBusy}
          value={modelId}
          onValueChange={(v) => {
            if (v != null) setModelId(v as ModelId);
          }}
        >
          <SelectTrigger className="min-w-[12rem] flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODEL_OPTIONS.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={isBusy}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          if (e.shiftKey) return;
          if (e.nativeEvent.isComposing) return;
          if (isBusy) return;
          if (!input.trim()) return;
          e.preventDefault();
          e.currentTarget.form?.requestSubmit();
        }}
        title="Enter 提交生成；Shift+Enter 换行；生成进行中不可编辑"
        className="min-h-32 p-4"
      />

      {!isBusy ? (
        <Button
          type="submit"
          disabled={!input.trim()}
          className="w-full h-11 text-base bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
        >
          生成内容
        </Button>
      ) : canStop ? (
        <Button
          type="button"
          variant="secondary"
          className="w-full h-11 text-base"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onStop();
          }}
        >
          停止生成
        </Button>
      ) : (
        <Button
          type="button"
          variant="secondary"
          disabled
          className="w-full h-11 text-base opacity-80 cursor-not-allowed"
        >
          保存中…
        </Button>
      )}
    </form>
  );
}
