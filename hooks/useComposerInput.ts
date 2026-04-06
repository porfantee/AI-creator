import { useCallback, useMemo, useState } from "react";
import type { GenerateMode, ModelId, Platform, SceneId } from "@/lib/types";
import { DEFAULT_MODEL_ID } from "@/lib/models";
import { getDefaultScene, getSceneOptions, normalizeSceneForPlatform } from "@/lib/scenes";

/** 表单侧：主题、平台、场景、模型、生成模式 */
export function useComposerInput() {
  const [input, setInput] = useState("");
  const [platform, setPlatform] = useState<Platform>("xhs");
  const [scene, setScene] = useState<SceneId>(() => getDefaultScene("xhs"));
  const [modelId, setModelId] = useState<ModelId>(DEFAULT_MODEL_ID);
  const [generateMode, setGenerateMode] = useState<GenerateMode>("plain");

  const sceneOptions = useMemo(() => getSceneOptions(platform), [platform]);

  const applyPlatform = useCallback((p: Platform, sceneHint?: string | null) => {
    setPlatform(p);
    setScene((prev) =>
      normalizeSceneForPlatform(p, sceneHint !== undefined ? sceneHint : prev)
    );
  }, []);

  return {
    input,
    setInput,
    platform,
    setPlatform,
    scene,
    setScene,
    modelId,
    setModelId,
    generateMode,
    setGenerateMode,
    applyPlatform,
    sceneOptions,
  };
}
