import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { DEFAULT_MODEL_ID, getModelOption, isModelId } from "@/lib/models";
import { getSceneLabel } from "@/lib/scenes";
import { getPlatformLabel } from "@/lib/platform-label";
import type { Platform } from "@/lib/types";

export const dynamic = "force-dynamic";

type ExportFormat = "txt" | "md";

function parseFormat(value: string | null): ExportFormat | null {
  if (value === "txt" || value === "md") return value;
  return null;
}

function normalizeText(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function safeText(value: string | null | undefined) {
  return normalizeText(value ?? "");
}

function sceneLabel(platform: Platform, scene: string | null | undefined) {
  if (!scene) return "—";
  return getSceneLabel(platform, scene);
}
function modelLabel(modelId: string) {
  return getModelOption(isModelId(modelId) ? modelId : DEFAULT_MODEL_ID).label;
}

function formatWorkAsText(work: {
  id: string;
  createdAt: Date;
  platform: string;
  scene: string | null;
  modelId: string;
  prompt: string;
  completion: string;
}) {
  const platform = work.platform as Platform;

  return [
    `主题：${safeText(work.prompt)}`,
    "",
    `平台 / 场景：${getPlatformLabel(platform)} · ${sceneLabel(
      platform,
      work.scene
    )}`,
    `模型：${modelLabel(work.modelId)
    }`,
    `创建时间：${work.createdAt.toLocaleString("zh-CN")}`,
    `作品 ID：${work.id}`,
    "",
    "生成内容：",
    "",
    safeText(work.completion),
  ].join("\n");
}

function formatWorkAsMarkdown(work: {
  id: string;
  createdAt: Date;
  platform: string;
  scene: string | null;
  modelId: string;
  prompt: string;
  completion: string;
}) {
  const platform = work.platform as Platform;

  return [
    `# ${safeText(work.prompt) || "未命名作品"}`,
    "",
    `- 平台 / 场景：${getPlatformLabel(platform)} · ${sceneLabel(
      platform,
      work.scene
    )}`,
    `- 模型：${modelLabel(work.modelId)}`,
    `- 创建时间：${work.createdAt.toLocaleString("zh-CN")}`,
    `- 作品 ID：${work.id}`,
    "",
    "## 生成内容",
    "",
    safeText(work.completion),
  ].join("\n");
}

export async function GET(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const format = parseFormat(url.searchParams.get("format"));
  const kind = url.searchParams.get("kind") ?? "all";

  if (!format) {
    return NextResponse.json(
      { error: "Unsupported format. Use txt or md." },
      { status: 400 }
    );
  }

  if (kind !== "all") {
    return NextResponse.json(
      { error: "Unsupported kind. Use all." },
      { status: 400 }
    );
  }

  const works = await prisma.work.findMany({
    where: {
      userId: session.user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const body =
    works.length === 0
      ? format === "md"
        ? "# 作品库\n\n暂无作品。\n"
        : "作品库\n\n暂无作品。\n"
      : works
          .map((work, index) => {
            const content =
              format === "md"
                ? formatWorkAsMarkdown(work)
                : formatWorkAsText(work);

            if (format === "md") {
              return index === 0 ? content : `---\n\n${content}`;
            }

            return index === 0
              ? content
              : `${"-".repeat(48)}\n\n${content}`;
          })
          .join("\n\n");

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const ext = format === "md" ? "md" : "txt";
  const contentType =
    format === "md"
      ? "text/markdown; charset=utf-8"
      : "text/plain; charset=utf-8";

  return new NextResponse(`\uFEFF${body}`, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="works-all-${stamp}.${ext}"`,
      "Cache-Control": "private, no-store",
    },
  });
}