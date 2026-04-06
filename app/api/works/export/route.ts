import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { structuredFromUnknown } from "@/lib/structured/parse";

export const dynamic = "force-dynamic";

type ExportKind = "all" | "plain" | "structured";

function parseKind(v: string | null): ExportKind {
  if (v === "plain" || v === "structured") return v;
  return "all";
}

function escapeCsvCell(value: string): string {
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const format = url.searchParams.get("format");
  if (format !== "csv") {
    return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
  }
  const kind = parseKind(url.searchParams.get("kind"));

  const where: Prisma.WorkWhereInput = { userId: session.user.id };
  if (kind === "plain") {
    where.structuredJson = { equals: Prisma.DbNull };
  } else if (kind === "structured") {
    where.structuredJson = { not: Prisma.DbNull };
  }

  const works = await prisma.work.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  const header = [
    "id",
    "createdAt",
    "platform",
    "scene",
    "modelId",
    "prompt",
    "completion",
    "title",
    "body",
    "tags",
  ];

  const rows = works.map((w) => {
    const s = structuredFromUnknown(w.structuredJson ?? null);
    const tagsStr = s?.tags?.length ? s.tags.join("|") : "";
    return [
      w.id,
      w.createdAt.toISOString(),
      w.platform,
      w.scene ?? "",
      w.modelId,
      w.prompt,
      w.completion,
      s?.title ?? "",
      s?.body ?? "",
      tagsStr,
    ].map((cell) => escapeCsvCell(cell));
  });

  const csv = ["\uFEFF" + header.map(escapeCsvCell).join(","), ...rows.map((r) => r.join(","))].join(
    "\r\n"
  );

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="works-${kind}-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
