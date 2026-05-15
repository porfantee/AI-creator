export type Platform = "xhs" | "weibo" | "zhihu";
export type ModelId = "qwen-plus" | "qwen-turbo" | "gpt-4o-mini" | "gemini-1.5-flash";

/** 各平台下的场景 id（全局唯一，便于存储与校验） */
export type XhsSceneId = "xhs_seed" | "xhs_daily" | "xhs_guide";
export type WeiboSceneId = "weibo_hot" | "weibo_notice" | "weibo_story";
export type ZhihuSceneId = "zhihu_qa" | "zhihu_essay" | "zhihu_explainer";

export type SceneId = XhsSceneId | WeiboSceneId | ZhihuSceneId;

/** 结果区二次改写动作（与 UI、API、prompt 一一对应） */
export type RewriteAction = "shorter" | "colloquial" | "professional" | "regenerate";

/**
 * 生成模式。
 *
 * 当前产品入口只保留 plain 流式纯文本。structured 相关类型暂时保留，
 * 仅用于兼容旧历史数据、Prisma JSON 字段和后续迁移；不要再在新 UI / API 中暴露结构化生成入口。
 */
export type GenerateMode = "plain" | "structured";

/** 当前旧版 JSON schema 版本；仅用于历史数据兼容。 */
export type StructuredSchemaVersion = 1;

/** 旧版结构化内容；仅用于历史数据兼容。 */
export type StructuredContentV1 = {
  schemaVersion: 1;
  title: string;
  /** 正文按段落拆分；单段内仍可有换行 */
  content: string[];
  tags: string[];
};

export type StructuredContent = StructuredContentV1;

/** 旧 structured API 响应体；仅用于历史兼容，新的生成链路不再返回。 */
export type GenerateStructuredApiResponse = {
  mode: "structured";
  structured: StructuredContent;
};
