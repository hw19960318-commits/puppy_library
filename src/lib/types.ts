import { BookStatus } from "@prisma/client";

export type BookFormInput = {
  title: string;
  author?: string;
  isbn?: string;
  publisher?: string;
  publishDate?: string;
  coverPath?: string;
  description?: string;
  tags?: string[];
  category?: string;
  doubanId?: string;
  doubanRating?: number;
  status?: BookStatus;
  myRating?: number | null;
  myNotes?: string | null;
  purchasedAt?: string | null;
  finishedAt?: string | null;
  isPrivate?: boolean;
};

export type DoubanBookInfo = {
  subjectId?: string;
  title?: string;
  author?: string;
  publisher?: string;
  publishDate?: string;
  isbn?: string;
  coverUrl?: string;
  description?: string;
  rating?: number;
  tags?: string[];
  comments?: DoubanComment[];
  url?: string;
  /** 抓取失败时降级为 true，仅保留跳转链接 */
  degraded?: boolean;
  error?: string;
};

export type DoubanComment = {
  author: string;
  content: string;
  rating?: number;
  date?: string;
};

/** 解析 tags JSON 字符串 */
export function parseTags(tagsJson: string | null | undefined): string[] {
  if (!tagsJson) return [];
  try {
    const parsed = JSON.parse(tagsJson);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
