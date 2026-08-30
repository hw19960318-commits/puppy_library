import { NextRequest, NextResponse } from "next/server";
import { BookStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { BookFormInput } from "@/lib/types";

/** GET /api/books — 列表，支持 status / q / smart 筛选（可叠加） */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status");
  const q = searchParams.get("q")?.trim();
  const smart = searchParams.get("smart"); // staleUnread = 买入超一年未读

  // 用 AND 组合各条件，避免多个 OR / status 互相覆盖
  const and: Record<string, unknown>[] = [];

  if (status && status !== "all" && Object.values(BookStatus).includes(status as BookStatus)) {
    and.push({ status });
  }

  if (q) {
    and.push({
      OR: [
        { title: { contains: q } },
        { author: { contains: q } },
        { isbn: { contains: q } },
      ],
    });
  }

  if (smart === "staleUnread") {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    and.push({
      status: { in: [BookStatus.unread, BookStatus.wantToRead] },
    });
    and.push({
      OR: [
        { purchasedAt: { lte: oneYearAgo } },
        {
          AND: [{ purchasedAt: null }, { createdAt: { lte: oneYearAgo } }],
        },
      ],
    });
  }

  const where = and.length > 0 ? { AND: and } : {};

  const books = await prisma.book.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
  });

  return NextResponse.json({ books });
}

/** POST /api/books — 新建藏书 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as BookFormInput;
    if (!body.title?.trim()) {
      return NextResponse.json({ error: "书名不能为空" }, { status: 400 });
    }

    const book = await prisma.book.create({
      data: {
        title: body.title.trim(),
        author: body.author?.trim() || "",
        isbn: body.isbn?.replace(/[-\s]/g, "") || null,
        publisher: body.publisher || null,
        publishDate: body.publishDate || null,
        coverPath: body.coverPath || null,
        description: body.description || null,
        tags: JSON.stringify(body.tags ?? []),
        category: body.category || null,
        doubanId: body.doubanId || null,
        doubanRating: body.doubanRating ?? null,
        status: body.status ?? BookStatus.unread,
        myRating: body.myRating ?? null,
        myNotes: body.myNotes ?? null,
        purchasedAt: body.purchasedAt ? new Date(body.purchasedAt) : null,
        finishedAt: body.finishedAt ? new Date(body.finishedAt) : null,
        isPrivate: body.isPrivate ?? false,
      },
    });

    return NextResponse.json({ book }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "创建失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
