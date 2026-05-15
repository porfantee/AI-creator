# my-xhs-generator

一个基于 **Next.js App Router** 构建的 AI 内容生成平台，支持小红书、微博、知乎等多平台文案生成，集成多模型适配、流式文本输出、AI 改写、作品库管理、虚拟列表性能优化与内容导出能力。

项目重点不是简单调用大模型生成文本，而是围绕 AI 内容创作场景，完成了从 Prompt 配置、多模型接入、流式响应、请求状态管理、作品持久化到长列表性能优化的一整套前后端实现。



---

## 核心亮点

- 基于 **Next.js 16 App Router** 构建全栈应用
- 支持 **小红书 / 微博 / 知乎** 多平台文案生成
- 支持 **Qwen / OpenAI / Gemini** 多模型切换
- 基于 **Fetch + ReadableStream** 实现 AI 结果流式输出
- 支持 **生成中止、重复提交拦截、请求竞态保护**
- 基于 `useReducer` 实现 AI 生成流程状态机
- 支持 AI 改写：更短一点、更口语化、更专业、再来一版
- 支持 GitHub / Google 登录
- 支持云端作品库管理、继续编辑、删除、复制与导出
- 基于 `@tanstack/react-virtual` 实现历史记录与作品库虚拟列表
- 支持分页加载、动态高度测量与滚动位置恢复
- 支持单条作品导出 TXT、全部作品导出 TXT / Markdown
- 在 1 万条记录压测下，首屏渲染耗时由约 **1252ms** 降至约 **50ms**

---

## 技术栈


| 分类    | 技术                                                |
| ----- | ------------------------------------------------- |
| 前端框架  | Next.js 16 App Router, React 19                   |
| 样式与组件 | Tailwind CSS 4, shadcn/ui, lucide-react           |
| AI 能力 | Vercel AI SDK, Qwen, OpenAI, Gemini               |
| 认证    | NextAuth v5                                       |
| 数据库   | PostgreSQL, Prisma                                |
| 状态管理  | useReducer, Zustand                               |
| 性能优化  | @tanstack/react-virtual, requestAnimationFrame    |
| 工程化   | TypeScript, ESLint                                |
| 数据持久化 | Prisma + PostgreSQL, localStorage, sessionStorage |


---

## 功能介绍

### 1. 多平台内容生成

支持针对不同平台和场景生成不同风格的内容。

#### 小红书

- 种草好物
- 日常分享
- 攻略教程

#### 微博

- 热点短评
- 活动预告
- 故事长文

#### 知乎

- 问答回答
- 观点长文
- 科普解释

不同平台和场景的 Prompt 被配置在独立模块中，便于后续扩展新平台、新场景或调整内容风格。

---

### 2. 多模型适配

当前支持以下模型：


| 模型 ID              | 供应商              | 说明              |
| ------------------ | ---------------- | --------------- |
| `qwen-plus`        | DashScope / Qwen | 默认模型            |
| `qwen-turbo`       | DashScope / Qwen | 更快的 Qwen 模型     |
| `gpt-4o-mini`      | OpenAI           | OpenAI 轻量模型     |
| `gemini-1.5-flash` | Google           | Gemini Flash 模型 |


模型配置集中在：

```txt
lib/models.ts
```

后端会对前端传入的 `modelId` 做白名单校验，避免非法模型 ID 被直接传给上游服务。

---

### 3. AI 流式文本生成

项目封装了统一的 AI 流式生成链路。

整体流程：

```txt
用户提交主题
  ↓
POST /api/generate
  ↓
根据 platform + scene 获取系统 Prompt
  ↓
根据 modelId 选择模型供应商
  ↓
调用 Qwen / OpenAI / Gemini
  ↓
后端统一返回文本流
  ↓
前端基于 ReadableStream 增量消费
  ↓
ResultPanel 实时展示生成内容
```

#### Qwen

Qwen 通过 DashScope OpenAI-compatible 接口接入，后端解析上游 SSE 数据，并统一转换成普通文本流返回给前端。

#### OpenAI / Gemini

OpenAI 和 Gemini 通过 Vercel AI SDK 接入，使用 `streamText()` 返回文本流。

#### 前端流式消费

前端基于：

- `fetch`
- `ReadableStream`
- `TextDecoder`
- `requestAnimationFrame`

实现增量读取和合批渲染，避免长文本生成过程中频繁触发 React 更新。

---

### 4. 生成流程状态机

AI 生成过程使用 `useReducer` 管理状态。

主要状态包括：

```txt
idle
submitting
streaming
persisting
success
error
aborted
```

状态机覆盖了以下场景：

- 提交生成
- 请求已接受
- 流式输出中
- 保存作品中
- 生成成功
- 生成失败
- 用户中止生成
- 状态重置

同时结合：

- `AbortController`
- 请求 ID 校验
- submit lock
- stop cooldown
- reducer activeRequestId 匹配

解决以下问题：

- 用户重复点击生成导致重复请求
- 旧请求晚于新请求返回，覆盖当前结果
- 用户停止生成后仍有旧 chunk 回写页面
- 网络错误和用户主动中止状态混淆
- 流式更新过于频繁导致页面卡顿

---

### 5. AI 改写

生成结果支持二次改写：


| 动作    | 说明            |
| ----- | ------------- |
| 更短一点  | 压缩篇幅，保留核心信息   |
| 更口语化  | 改成更自然、更亲切的表达  |
| 更专业一点 | 改成更正式、更有条理的表达 |
| 再来一版  | 基于原主题重新生成一版   |


改写时会复用当前的：

- 平台
- 场景
- 模型
- 原始主题
- 当前生成内容

保证改写结果和当前创作上下文一致。

---

### 6. 作品库管理

登录后，生成成功的内容会保存到云端作品库。

作品库支持：

- 查看历史作品
- 点击作品查看详情
- 继续编辑
- 删除作品
- 复制全文
- 平台筛选
- 关键词搜索
- 分页加载
- 滚动位置恢复
- 单条 TXT 导出
- 全部 TXT / Markdown 导出

作品库页面采用左右布局：

```txt
左侧：作品虚拟列表
右侧：作品详情
```

点击左侧作品后，右侧展示完整内容和操作按钮。

---

### 7. 历史记录与作品库虚拟列表

首页历史记录和作品库列表均使用 `@tanstack/react-virtual` 实现虚拟滚动。

虚拟列表能力：

- 只渲染当前视口附近的列表项
- 支持 overscan 预渲染
- 支持动态高度测量
- 支持分页加载
- 支持滚动位置恢复
- 减少长列表 DOM 节点数量
- 提升万级数据下的滚动流畅度

---

### 8. 内容导出

作品库支持内容导出。

#### 单条作品

单条作品默认导出为 TXT。

内容包含：

```txt
主题
平台 / 场景
模型
创建时间
生成内容
```

#### 全部作品

全部作品支持导出为：

- TXT
- Markdown

接口示例：

```txt
/api/works/export?format=txt&kind=all
/api/works/export?format=md&kind=all
```

Markdown 更适合归档到：

- Notion
- 飞书文档
- Obsidian
- GitHub
- 个人知识库

---

## 项目结构

```txt
my-xhs-generator/
├── app/
│   ├── api/
│   │   ├── generate/              # AI 生成接口
│   │   ├── rewrite/               # AI 改写接口
│   │   ├── works/                 # 作品库接口
│   │   └── auth/                  # NextAuth 接口
│   │
│   ├── works/
│   │   └── page.tsx               # 作品库页面
│   │
│   ├── layout.tsx                 # 全局布局
│   └── page.tsx                   # 首页生成器
│
├── components/
│   ├── GeneratorForm.tsx          # 生成表单
│   ├── ResultPanel.tsx            # 结果展示与改写
│   ├── HistoryPanel.tsx           # 首页历史记录面板
│   ├── VirtualWorkList.tsx        # 虚拟列表组件
│   ├── SessionProvider.tsx        # NextAuth Provider
│   └── ui/                        # shadcn/ui 组件
│
├── hooks/
│   ├── useHomeGeneration.ts       # 首页生成与改写主逻辑
│   ├── useGenerateResult.ts       # 生成结果状态
│   ├── useGenerationRefs.ts       # 请求控制 refs
│   ├── useGenerationLifecycle.ts  # 生成生命周期封装
│   ├── generationReducer.ts       # 生成流程状态机
│   ├── useComposerInput.ts        # 表单输入状态
│   ├── useWorkHistory.ts          # 历史记录与作品持久化
│   └── useSessionWorksStoreSync.ts# 登录用户与作品库缓存同步
│
├── lib/
│   ├── llm/
│   │   ├── qwen.ts                # Qwen / DashScope 接入
│   │   ├── streamUpstreamResponse.ts
│   │   └── completeUpstreamText.ts
│   │
│   ├── prompts/
│   │   ├── registry.ts            # Prompt 注册表
│   │   └── platforms/
│   │       ├── xhs.ts             # 小红书 Prompt
│   │       ├── weibo.ts           # 微博 Prompt
│   │       └── zhihu.ts           # 知乎 Prompt
│   │
│   ├── models.ts                  # 模型配置
│   ├── scenes.ts                  # 平台场景配置
│   ├── types.ts                   # 全局类型
│   ├── rewrite-actions.ts         # 改写动作配置
│   ├── continue-edit.ts           # 作品继续编辑缓存
│   ├── history-list.ts            # 作品列表类型与解析
│   ├── fetch-works-list.ts        # 作品库接口请求封装
│   └── db.ts                      # Prisma Client
│
├── stores/
│   └── cloudWorksStore.ts         # Zustand 作品库缓存
│
├── utils/
│   ├── history.ts                 # 本地历史记录
│   └── readPlainTextStream.ts     # 前端流式文本读取
│
├── prisma/
│   └── schema.prisma              # 数据库模型
│
├── public/
│
├── package.json
├── README.md
└── tsconfig.json
```

---

## 核心流程

### 生成流程

```txt
用户输入主题
  ↓
选择平台 / 场景 / 模型
  ↓
提交 GeneratorForm
  ↓
useHomeGeneration.onSubmit
  ↓
POST /api/generate
  ↓
后端根据 platform + scene 获取 Prompt
  ↓
根据 modelId 调用对应模型
  ↓
返回文本流
  ↓
前端 ReadableStream 增量读取
  ↓
ResultPanel 实时渲染
  ↓
生成成功后保存作品
  ↓
刷新历史记录 / 作品库缓存
```

---

### 改写流程

```txt
用户点击改写动作
  ↓
handleRewrite
  ↓
POST /api/rewrite
  ↓
后端构造改写 Prompt
  ↓
模型返回文本流
  ↓
前端实时更新结果
  ↓
保存为新的作品记录
```

---

### 停止生成流程

```txt
用户点击停止
  ↓
AbortController.abort()
  ↓
中止 fetch 请求
  ↓
状态机进入 aborted
  ↓
短暂冷却避免立即重复提交
```

---

### 继续编辑流程

```txt
作品库点击继续编辑
  ↓
写入 sessionStorage
  ↓
跳转首页
  ↓
首页 consumeContinueEditPayload
  ↓
恢复平台 / 场景 / 模型 / prompt / completion
```

---

## 本地运行

### 1. 克隆项目

```bash
git clone https://github.com/your-name/my-xhs-generator.git
cd my-xhs-generator
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

在项目根目录创建 `.env.local`：

```env
# Database
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"

# NextAuth
NEXTAUTH_SECRET="your-nextauth-secret"
NEXTAUTH_URL="http://localhost:3000"

# GitHub OAuth
AUTH_GITHUB_ID="your-github-client-id"
AUTH_GITHUB_SECRET="your-github-client-secret"

# Google OAuth
AUTH_GOOGLE_ID="your-google-client-id"
AUTH_GOOGLE_SECRET="your-google-client-secret"

# AI Providers
DASHSCOPE_API_KEY="your-dashscope-api-key"
OPENAI_API_KEY="your-openai-api-key"
GOOGLE_GENERATIVE_AI_API_KEY="your-google-api-key"
```

说明：

- 默认模型为 `qwen-plus`
- 如果只使用 Qwen，至少需要配置 `DASHSCOPE_API_KEY`
- 如果使用 OpenAI，需要配置 `OPENAI_API_KEY`
- 如果使用 Gemini，需要配置 `GOOGLE_GENERATIVE_AI_API_KEY`

---

### 4. 初始化数据库

```bash
npm run db:generate
npm run db:push
```

如果需要创建迁移：

```bash
npm run db:migrate
```

---

### 5. 启动开发环境

```bash
npm run dev
```

访问：

```txt
http://localhost:3000
```

```

---

## 数据库说明

项目使用 Prisma + PostgreSQL。

主要数据模型包括：

- User
- Account
- Session
- Work

其中 `Work` 用于保存用户生成的作品，主要字段包括：

```txt
id
userId
platform
scene
modelId
prompt
completion
createdAt
updatedAt
```

作品库页面基于该数据表实现云端作品管理。

---

## Prompt 配置说明

Prompt 采用平台和场景分层配置。

相关文件：

```txt
lib/prompts/platforms/xhs.ts
lib/prompts/platforms/weibo.ts
lib/prompts/platforms/zhihu.ts
lib/prompts/registry.ts
lib/scenes.ts
```

新增平台时，需要修改：

```txt
lib/types.ts
lib/scenes.ts
lib/prompts/platforms/*
lib/prompts/registry.ts
```

新增场景时，需要修改：

```txt
lib/scenes.ts
lib/prompts/platforms/<platform>.ts
```

---

## 新增模型说明

模型配置位于：

```txt
lib/models.ts
```

新增模型时，需要：

1. 在 `ModelId` 类型中增加模型 ID
2. 在 `MODEL_OPTIONS` 中增加模型配置
3. 在后端模型适配层增加调用逻辑
4. 补充对应环境变量校验

---

## 性能优化说明

### 1. 流式渲染优化

长文本生成过程中，如果每个 chunk 都立即 `setState`，会导致 React 高频渲染。

项目通过 `requestAnimationFrame` 对 chunk 更新进行合批：

```txt
模型流式返回 chunk
  ↓
写入 pending buffer
  ↓
requestAnimationFrame 合批 flush
  ↓
更新 completion
```

这样可以减少长文本生成过程中的 UI 抖动和重复渲染。

---

### 2. 请求竞态保护

项目通过请求 ID 判断当前请求是否仍有效：

```txt
新请求开始
  ↓
requestId + 1
  ↓
旧请求即使返回，也无法更新当前状态
```

同时状态机中的 action 也会检查 `activeRequestId`，避免旧请求导致状态错乱。

---

### 3. 虚拟列表优化

历史记录和作品库列表只渲染视口附近的记录。

核心能力：

```txt
总数据：10000 条
实际 DOM：约 12 条
```

这显著降低了浏览器布局、绘制和内存压力。

---

## License

MIT
