import { BookStatus } from "@prisma/client";

export type BookFormInput = {
  title: string;
  author?: string;
  isbn?: string;
  publisher?: string;
  publishDate?: string;
  description?: string;
  tags?: string[];
  category?: string;
  status?: BookStatus;
  myRating?: number | null;
  myNotes?: string | null;
  purchasedAt?: string | null;
  finishedAt?: string | null;
  isPrivate?: boolean;
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
