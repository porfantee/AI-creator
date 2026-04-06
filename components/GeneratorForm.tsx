import type { GenerateMode, ModelId, Platform, SceneId } from "@/lib/types";
import type { SceneOption } from "@/lib/scenes";
import { MODEL_OPTIONS } from "@/lib/models";

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
  generateMode: GenerateMode;
  setGenerateMode: (v: GenerateMode) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onStop: () => void;
  isLoading?: boolean;
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
  generateMode,
  setGenerateMode,
  onSubmit,
  onStop,
  isLoading,
}: Props) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex flex-wrap items-center gap-6">
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value as Platform)}
          className="border rounded p-2 min-w-[8rem]"
        >
          <option value="xhs">小红书</option>
          <option value="weibo">微博</option>
          <option value="zhihu">知乎</option>
        </select>

        <select
          value={scene}
          onChange={(e) => setScene(e.target.value as SceneId)}
          className="border rounded p-2 min-w-[10rem]"
        >
          {sceneOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={modelId}
          onChange={(e) => setModelId(e.target.value as ModelId)}
          className="border rounded p-2 flex-1 min-w-[12rem]"
        >
          {MODEL_OPTIONS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>

        <select
          value={generateMode}
          onChange={(e) => setGenerateMode(e.target.value as GenerateMode)}
          className="border rounded p-2 min-w-[10rem]"
        >
          <option value="plain">流式纯文本</option>
          <option value="structured">结构化 JSON</option>
        </select>
      </div>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          if (e.shiftKey) return;
          if (e.nativeEvent.isComposing) return;
          if (isLoading) return;
          if (!input.trim()) return;
          e.preventDefault();
          e.currentTarget.form?.requestSubmit();
        }}
        title="Enter 提交生成；Shift+Enter 换行"
        className="w-full border rounded p-4"
      />

      {isLoading ? (
        <button
          type="button"
          className="w-full bg-gray-700 hover:bg-gray-800 text-white font-medium px-4 py-3 rounded transition-colors"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onStop();
          }}
        >
          停止生成
        </button>
      ) : (
        <button
          type="submit"
          className="w-full bg-red-500 hover:bg-red-600 text-white font-medium px-4 py-3 rounded disabled:bg-gray-300 transition-colors"
          disabled={!input.trim()}
        >
          生成内容
        </button>
      )}
    </form>
  );
}
