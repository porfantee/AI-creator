import { redirect } from "next/navigation";
import { auth } from "@/auth";

/** 避免 /works 被静态缓存，浏览器硬刷新时会话与列表能正确拉取 */
export const dynamic = "force-dynamic";

export const runtime = "nodejs";

export default async function WorksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/");
  }

  return children;
}