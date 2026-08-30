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
 *     "category": "科幻"
 *   }
 * ]
 */
import { readFile } from "fs/promises";
import path from "path";
import { BookStatus, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type ImportItem = {
  title: string;
  author?: string;
  isbn?: string;
  publisher?: string;
  publishDate?: string;
  description?: string;
  tags?: string[];
  category?: string;
  status?: keyof typeof BookStatus;
  finishedAt?: string;
  purchasedAt?: string;
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

    const status =
      item.status && BookStatus[item.status]
        ? BookStatus[item.status]
        : BookStatus.unread;

    const book = await prisma.book.create({
      data: {
        title: item.title.trim(),
        author: item.author?.trim() || "",
        isbn: item.isbn?.replace(/[-\s]/g, "") || null,
        publisher: item.publisher || null,
        publishDate: item.publishDate || null,
        coverPath: null,
        description: item.description || null,
        tags: JSON.stringify(item.tags ?? []),
        category: item.category || null,
        status,
        finishedAt: item.finishedAt ? new Date(item.finishedAt) : null,
        purchasedAt: item.purchasedAt ? new Date(item.purchasedAt) : null,
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
