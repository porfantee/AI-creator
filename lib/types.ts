export type Platform = "xhs" | "weibo" | "zhihu";
export type ModelId = "qwen-plus" | "qwen-turbo" | "gpt-4o-mini" | "gemini-1.5-flash";

/** 各平台下的场景 id（全局唯一，便于存储与校验） */
export type XhsSceneId = "xhs_seed" | "xhs_daily" | "xhs_guide";
export type WeiboSceneId = "weibo_hot" | "weibo_notice" | "weibo_story";
export type ZhihuSceneId = "zhihu_qa" | "zhihu_essay" | "zhihu_explainer";

export type SceneId = XhsSceneId | WeiboSceneId | ZhihuSceneId;

/** 结果区二次改写动作（与 UI、API、prompt 一一对应） */
export type RewriteAction = "shorter" | "colloquial" | "professional" | "regenerate";

/** 生成模式：plain 保持流式纯文本；structured 一次性 JSON（title/body/tags） */
export type GenerateMode = "plain" | "structured";

/** 结构化生成结果（与模型约定字段一致） */
export type StructuredContent = {
  title: string;
  body: string;
  tags: string[];
};

/** POST /api/generate 在 structured 模式下的成功响应体 */
export type GenerateStructuredApiResponse = {
  mode: "structured";
  structured: StructuredContent;
};
