/**
 * 批量导入脚本：读取 data/books-import.json 入库
 * 用法：npm run import:books
 *
 * JSON 格式示例：
 * [
 *   {
 *     "title": "三体",
 *     "author": "刘慈欣",
 *     "isbn": "9787536692930",
 *     "status": "wantToRead",
 *     "tags": ["科幻"],
 *     "category": "科幻",
 *     "coverPath": "/covers/xxx.jpg"
 *   }
 * ]
 *
 * 若提供 isbn，会排队调用豆瓣补全缺失字段（限速）。
 */
import { readFile } from "fs/promises";
import path from "path";
import { BookStatus, PrismaClient } from "@prisma/client";
import { fetchByIsbn } from "../src/lib/douban";

const prisma = new PrismaClient();

type ImportItem = {
  title: string;
  author?: string;
  isbn?: string;
  publisher?: string;
  publishDate?: string;
  coverPath?: string;
  description?: string;
  tags?: string[];
  category?: string;
  status?: keyof typeof BookStatus;
  finishedAt?: string;
  purchasedAt?: string;
  fetchDouban?: boolean;
};

async function main() {
  const file = path.join(process.cwd(), "data", "books-import.json");
  let raw: string;
  try {
    raw = await readFile(file, "utf-8");
  } catch {
    console.error(`未找到 ${file}`);
    console.error("请先准备导入文件，或等照片识别后生成。");
    process.exit(1);
  }

  const items = JSON.parse(raw) as ImportItem[];
  if (!Array.isArray(items) || items.length === 0) {
    console.error("导入文件为空或格式错误");
    process.exit(1);
  }

  console.log(`准备导入 ${items.length} 本…`);
  let ok = 0;

  for (const [i, item] of items.entries()) {
    if (!item.title?.trim()) {
      console.warn(`[${i + 1}] 跳过：缺少书名`);
      continue;
    }

    let meta = { ...item };

    // ISBN 存在且未显式关闭时，排队补全豆瓣
    if (item.isbn && item.fetchDouban !== false) {
      console.log(`[${i + 1}] 豆瓣补全 ISBN ${item.isbn}…`);
      try {
        const info = await fetchByIsbn(item.isbn);
        if (!info.degraded) {
          meta = {
            ...meta,
            title: meta.title || info.title || meta.title,
            author: meta.author || info.author,
            publisher: meta.publisher || info.publisher,
            publishDate: meta.publishDate || info.publishDate,
            description: meta.description || info.description,
            tags: meta.tags?.length ? meta.tags : info.tags,
            coverPath: meta.coverPath || info.coverUrl,
          };
          (meta as ImportItem & { doubanId?: string; doubanRating?: number }).doubanId =
            info.subjectId;
          (meta as ImportItem & { doubanRating?: number }).doubanRating = info.rating;
        } else {
          console.warn(`  降级：${info.error}`);
        }
      } catch (e) {
        console.warn(`  豆瓣失败：`, e);
      }
    }

    const extended = meta as ImportItem & {
      doubanId?: string;
      doubanRating?: number;
    };

    const status =
      meta.status && BookStatus[meta.status]
        ? BookStatus[meta.status]
        : BookStatus.unread;

    const book = await prisma.book.create({
      data: {
        title: meta.title.trim(),
        author: meta.author?.trim() || "",
        isbn: meta.isbn?.replace(/[-\s]/g, "") || null,
        publisher: meta.publisher || null,
        publishDate: meta.publishDate || null,
        coverPath: meta.coverPath || null,
        description: meta.description || null,
        tags: JSON.stringify(meta.tags ?? []),
        category: meta.category || null,
        doubanId: extended.doubanId || null,
        doubanRating: extended.doubanRating ?? null,
        status,
        finishedAt: meta.finishedAt ? new Date(meta.finishedAt) : null,
        purchasedAt: meta.purchasedAt ? new Date(meta.purchasedAt) : null,
      },
    });

    console.log(`[${i + 1}] 已入库：${book.title} (${book.id})`);
    ok += 1;
  }

  console.log(`完成：成功 ${ok}/${items.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
