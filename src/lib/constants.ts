/** 书籍阅读状态中文标签 */
export const STATUS_LABELS: Record<string, string> = {
  unread: "未读",
  wantToRead: "想读",
  reading: "在读",
  read: "读过",
};

/** 状态对应的 Tailwind 颜色类（柔和底色 + 细环） */
export const STATUS_COLORS: Record<string, string> = {
  unread: "bg-stone-100 text-stone-600 ring-1 ring-stone-200",
  wantToRead: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  reading: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  read: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
};

/** 状态徽章左侧小圆点颜色 */
export const STATUS_DOTS: Record<string, string> = {
  unread: "bg-stone-400",
  wantToRead: "bg-amber-500",
  reading: "bg-sky-500",
  read: "bg-emerald-500",
};

/** 豆瓣缓存有效期：30 天（毫秒） */
export const DOUBAN_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** 豆瓣请求最小间隔（毫秒），温和限速 */
export const DOUBAN_MIN_INTERVAL_MS = 2500;

/** 应用名称 */
export const APP_NAME = "奥奥图书馆";
