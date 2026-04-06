/** 将非 2xx 的 fetch 结果转为 Error，便于与流式分支共用 */
export async function throwIfResponseNotOk(res: Response): Promise<void> {
  if (res.ok) return;
  const text = await res.text().catch(() => "");
  let detail = text;
  try {
    const j = JSON.parse(text) as { message?: string; error?: string };
    detail = j.message || j.error || text;
  } catch {
    /* 非 JSON */
  }
  throw new Error(detail || `请求失败 (${res.status})`);
}
