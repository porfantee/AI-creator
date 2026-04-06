import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isPlatform, parseModelId } from "@/lib/guards";
import { normalizeSceneForPlatform } from "@/lib/scenes";
import { structuredFromUnknown } from "@/lib/structured/parse";
import type { StructuredContent } from "@/lib/types";
import {
  WORKS_FULL_FETCH_MAX,
  WORKS_PAGE_SIZE,
} from "@/lib/works-pagination";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limitRaw = searchParams.get("limit");

  const userId = session.user.id;
  const where = { userId };

  /** 未带 limit：全量（迁移等少数场景），有上限 */
  if (limitRaw === null) {
    const works = await prisma.work.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: WORKS_FULL_FETCH_MAX,
    });
    return NextResponse.json(
      { works, hasMore: false },
      {
        headers: {
          "Cache-Control": "private, no-store, must-revalidate",
        },
      }
    );
  }

  const parsedLimit = Number.parseInt(limitRaw, 10);
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(100, Math.max(1, parsedLimit))
    : WORKS_PAGE_SIZE;
  const parsedOffset = Number.parseInt(searchParams.get("offset") ?? "0", 10);
  const offset =
    Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;

  const rows = await prisma.work.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: offset,
    take: limit + 1,
  });
  const hasMore = rows.length > limit;
  const works = hasMore ? rows.slice(0, limit) : rows;

  return NextResponse.json(
    { works, hasMore },
    {
      headers: {
        "Cache-Control": "private, no-store, must-revalidate",
      },
    }
  );
}

type PostBody = {
  platform?: unknown;
  modelId?: unknown;
  prompt?: unknown;
  completion?: unknown;
  scene?: unknown;
  structuredJson?: unknown;
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const platform =
    typeof body.platform === "string" && isPlatform(body.platform)
      ? body.platform
      : null;
  const modelId =
    typeof body.modelId === "string" ? parseModelId(body.modelId) : null;
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  const completion = typeof body.completion === "string" ? body.completion : "";
  let sceneInput: string | null = null;
  if (body.scene === undefined || body.scene === null) {
    sceneInput = null;
  } else if (typeof body.scene === "string") {
    sceneInput = body.scene;
  } else {
    return NextResponse.json({ error: "Invalid scene" }, { status: 400 });
  }

  if (!platform || !modelId || !prompt.trim() || !completion.trim()) {
    return NextResponse.json(
      { error: "Missing or invalid platform, modelId, prompt, completion" },
      { status: 400 }
    );
  }

  let structured: StructuredContent | null = null;
  if (body.structuredJson !== undefined && body.structuredJson !== null) {
    const parsed = structuredFromUnknown(body.structuredJson);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid structuredJson" }, { status: 400 });
    }
    structured = parsed;
  }

  const sceneToSave = normalizeSceneForPlatform(platform, sceneInput);

  const work = await prisma.work.create({
    data: {
      userId: session.user.id,
      platform,
      modelId,
      prompt,
      completion,
      scene: sceneToSave,
      ...(structured != null ? { structuredJson: structured } : {}),
    },
  });

  return NextResponse.json({ work }, { status: 201 });
}

/** 清空当前用户全部作品 */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.work.deleteMany({ where: { userId: session.user.id } });
  return NextResponse.json({ ok: true as const });
}
