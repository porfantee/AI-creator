import type { Platform } from "@/lib/types";

export function getPlatformLabel(platform: Platform): string {
  switch (platform) {
    case "xhs":
      return "小红书";
    case "weibo":
      return "微博";
    case "zhihu":
      return "知乎";
    default:
      return platform;
  }
}
