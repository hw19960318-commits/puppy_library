import { Book } from "@prisma/client";
import { parseTags } from "@/lib/types";

type ScoredBook = Book & { score: number };

/**
 * 相似书推荐：同作者 +3、共享标签各 +2、同分类 +1，取前 limit 本
 */
export function recommendSimilar(
  target: Book,
  candidates: Book[],
  limit = 6
): Book[] {
  const targetTags = new Set(parseTags(target.tags));

  const scored: ScoredBook[] = candidates
    .filter((b) => b.id !== target.id)
    .map((book) => {
      let score = 0;

      if (
        target.author &&
        book.author &&
        target.author.trim() === book.author.trim()
      ) {
        score += 3;
      }

      const bookTags = parseTags(book.tags);
      for (const tag of bookTags) {
        if (targetTags.has(tag)) score += 2;
      }

      if (
        target.category &&
        book.category &&
        target.category.trim() === book.category.trim()
      ) {
        score += 1;
      }

      return { ...book, score };
    })
    .filter((b) => b.score > 0)
    .sort((a, b) => b.score - a.score || (b.doubanRating ?? 0) - (a.doubanRating ?? 0));

  return scored.slice(0, limit);
}

/**
 * 基于日期种子的伪随机整数（每日固定）
 */
export function seededRandom(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // 转为 0~1
  return ((h >>> 0) % 1000000) / 1000000;
}

/**
 * 每日推荐：从想读/未读池中选一本
 * 优先沉睡最久（createdAt 最早）与豆瓣高分，再用日期种子打散
 */
export function pickDailyRecommendation(
  pool: Book[],
  dateKey: string,
  excludeIds: string[] = []
): Book | null {
  const filtered = pool.filter((b) => !excludeIds.includes(b.id));
  if (filtered.length === 0) return null;

  // 综合权重：沉睡天数 + 豆瓣分
  const now = Date.now();
  const ranked = [...filtered].sort((a, b) => {
    const sleepA = (now - a.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const sleepB = (now - b.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const scoreA = sleepA * 0.5 + (a.doubanRating ?? 0) * 2;
    const scoreB = sleepB * 0.5 + (b.doubanRating ?? 0) * 2;
    return scoreB - scoreA;
  });

  // 从前一半候选中用日期种子挑一本，避免永远同一本
  const topN = ranked.slice(0, Math.max(1, Math.ceil(ranked.length / 2)));
  const idx = Math.floor(seededRandom(dateKey) * topN.length);
  return topN[idx] ?? topN[0];
}

/** 换一本：排除当前后重新挑选 */
export function pickAlternative(
  pool: Book[],
  dateKey: string,
  currentId: string
): Book | null {
  return pickDailyRecommendation(pool, `${dateKey}-alt-${currentId}`, [currentId]);
}
