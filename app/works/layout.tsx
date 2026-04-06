/** 避免 /works 被静态缓存，浏览器硬刷新时会话与列表能正确拉取 */
export const dynamic = "force-dynamic";

export default function WorksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
