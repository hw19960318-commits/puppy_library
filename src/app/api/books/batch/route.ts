import { NextRequest, NextResponse } from "next/server";
import { BookStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

type BatchBookInput = {
  title?: string;
  author?: string;
  status?: BookStatus;
};

/**
 * POST /api/books/batch — 批量创建藏书
 * 同名（trim 后精确匹配）已存在则跳过，不覆盖、不设封面
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items = (Array.isArray(body) ? body : body?.books) as
      | BatchBookInput[]
      | undefined;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "请提供至少一本待导入书籍" },
        { status: 400 },
      );
    }

    if (items.length > 200) {
      return NextResponse.json(
        { error: "单次最多导入 200 本" },
        { status: 400 },
      );
    }

    // 规范化并去重请求内标题
    const normalized: { title: string; author: string; status: BookStatus }[] =
      [];
    const seenInRequest = new Set<string>();

    for (const item of items) {
      const title = item.title?.trim() ?? "";
      if (!title) continue;
      const key = title.toLowerCase();
      if (seenInRequest.has(key)) continue;
      seenInRequest.add(key);

      const status =
        item.status && Object.values(BookStatus).includes(item.status)
          ? item.status
          : BookStatus.unread;

      normalized.push({
        title,
        author: item.author?.trim() || "",
        status,
      });
    }

    if (normalized.length === 0) {
      return NextResponse.json({ error: "没有有效的书名" }, { status: 400 });
    }

    const existing = await prisma.book.findMany({
      where: { title: { in: normalized.map((b) => b.title) } },
      select: { title: true },
    });
    const existingTitles = new Set(existing.map((b) => b.title));

    const toCreate = normalized.filter((b) => !existingTitles.has(b.title));
    const skipped = normalized
      .filter((b) => existingTitles.has(b.title))
      .map((b) => b.title);

    const created =
      toCreate.length > 0
        ? await prisma.$transaction(
            toCreate.map((b) =>
              prisma.book.create({
                data: {
                  title: b.title,
                  author: b.author,
                  status: b.status,
                  // 明确不写入封面：书架照片不得作封面
                  coverPath: null,
                },
              }),
            ),
          )
        : [];

    return NextResponse.json({
      created: created.length,
      skipped: skipped.length,
      skippedTitles: skipped,
      books: created,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "批量导入失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
