import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateBookBlurb, isDeepseekConfigured } from "@/lib/deepseek";
import { parseTags } from "@/lib/types";

export const maxDuration = 300;

type Body = {
  /** 只处理缺简介的书；false 则全部重写 */
  onlyMissing?: boolean;
  /** 限制本数，便于试跑 */
  limit?: number;
  /** 指定书 id */
  bookIds?: string[];
};

/**
 * POST /api/descriptions/generate
 * 用 DeepSeek 为藏书写短简介并写入 description
 */
export async function POST(req: NextRequest) {
  if (!isDeepseekConfigured()) {
    return NextResponse.json(
      {
        error:
          "未配置 DEEPSEEK_API_KEY。请在项目根目录 .env 写入后重启 npm run dev",
      },
      { status: 503 }
    );
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    body = {};
  }

  const onlyMissing = body.onlyMissing !== false;
  const limit =
    typeof body.limit === "number" && body.limit > 0
      ? Math.min(body.limit, 200)
      : undefined;

  const where =
    body.bookIds?.length
      ? { id: { in: body.bookIds } }
      : onlyMissing
        ? {
            OR: [{ description: null }, { description: "" }],
          }
        : {};

  const books = await prisma.book.findMany({
    where,
    orderBy: { title: "asc" },
    ...(limit ? { take: limit } : {}),
    select: {
      id: true,
      title: true,
      author: true,
      category: true,
      tags: true,
    },
  });

  const results: Array<{
    id: string;
    title: string;
    ok: boolean;
    error?: string;
  }> = [];

  for (const book of books) {
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
      results.push({ id: book.id, title: book.title, ok: true });
      // 轻微限速，减少触发频控
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      const message = err instanceof Error ? err.message : "生成失败";
      results.push({
        id: book.id,
        title: book.title,
        ok: false,
        error: message,
      });
    }
  }

  const ok = results.filter((r) => r.ok).length;
  const fail = results.length - ok;

  return NextResponse.json({
    total: results.length,
    ok,
    fail,
    results,
  });
}

export async function GET() {
  return NextResponse.json({
    configured: isDeepseekConfigured(),
    hint: "POST { onlyMissing?: boolean, limit?: number, bookIds?: string[] }",
  });
}
