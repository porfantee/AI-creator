import type { Session } from "next-auth";

/** 与作品列表 / hydration 绑定的用户键（与 useWorkHistory 中 authedUserKey 一致） */
export function sessionWorksUserKey(session: Session | null): string | null {
  if (!session?.user) return null;
  return (
    session.user.id ??
    session.user.email ??
    session.user.name ??
    null
  );
}
