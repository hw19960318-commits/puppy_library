/**
 * 用 DeepSeek 为全部藏书写短简介
 * 用法：先在 .env 配置 DEEPSEEK_API_KEY，再执行
 *   npm run describe:books
 * 可选：ONLY_MISSING=1 只补空简介；LIMIT=5 试跑
 */
import { readFileSync, existsSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { generateBookBlurb, isDeepseekConfigured } from "../src/lib/deepseek";

/** 简单加载 .env（不覆盖已有环境变量） */
function loadEnvFile() {
  const envPath = path.join(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile();

const prisma = new PrismaClient();

function parseTags(tagsJson: string | null | undefined): string[] {
  if (!tagsJson) return [];
  try {
    const parsed = JSON.parse(tagsJson);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

async function main() {
  if (!isDeepseekConfigured()) {
    console.error("未配置 DEEPSEEK_API_KEY，请写入项目根目录 .env 后重试。");
    process.exit(1);
  }

  const onlyMissing = process.env.ONLY_MISSING === "1";
  const limit = process.env.LIMIT ? Number(process.env.LIMIT) : undefined;

  const books = await prisma.book.findMany({
    where: onlyMissing
      ? { OR: [{ description: null }, { description: "" }] }
      : {},
    orderBy: { title: "asc" },
    ...(limit && limit > 0 ? { take: limit } : {}),
  });

  console.log(
    `准备为 ${books.length} 本书生成简介（${onlyMissing ? "仅缺简介" : "全部重写"}）…`
  );

  let ok = 0;
  for (const [i, book] of books.entries()) {
    process.stdout.write(`[${i + 1}/${books.length}] ${book.title} … `);
    try {
      const description = await generateBookBlurb({
        title: book.title,
        author: book.author,
        category: book.category,
        tags: parseTags(book.tags),
      });
      await prisma.book.update({
        where: { id: book.id },
        data: { description },
      });
      ok += 1;
      console.log("OK");
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.log("FAIL", err instanceof Error ? err.message : err);
    }
  }

  console.log(`完成：成功 ${ok}/${books.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
