import { NextRequest, NextResponse } from "next/server";
import { BookStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { BookFormInput } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/books/[id] */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const book = await prisma.book.findUnique({ where: { id } });
  if (!book) {
    return NextResponse.json({ error: "未找到该书" }, { status: 404 });
  }
  return NextResponse.json({ book });
}

/** PATCH /api/books/[id] — 部分更新（状态、评分、笔记、元数据） */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const existing = await prisma.book.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "未找到该书" }, { status: 404 });
  }

  try {
    const body = (await req.json()) as Partial<BookFormInput> & {
      status?: BookStatus;
    };

    const data: Record<string, unknown> = {};

    if (body.title !== undefined) data.title = body.title.trim();
    if (body.author !== undefined) data.author = body.author.trim();
    if (body.isbn !== undefined)
      data.isbn = body.isbn ? body.isbn.replace(/[-\s]/g, "") : null;
    if (body.publisher !== undefined) data.publisher = body.publisher || null;
    if (body.publishDate !== undefined) data.publishDate = body.publishDate || null;
    if (body.coverPath !== undefined) data.coverPath = body.coverPath || null;
    if (body.description !== undefined) data.description = body.description || null;
    if (body.tags !== undefined) data.tags = JSON.stringify(body.tags);
    if (body.category !== undefined) data.category = body.category || null;
    if (body.doubanId !== undefined) data.doubanId = body.doubanId || null;
    if (body.doubanRating !== undefined) data.doubanRating = body.doubanRating;
    if (body.myRating !== undefined) data.myRating = body.myRating;
    if (body.myNotes !== undefined) data.myNotes = body.myNotes;
    if (body.isPrivate !== undefined) data.isPrivate = body.isPrivate;
    if (body.purchasedAt !== undefined) {
      data.purchasedAt = body.purchasedAt ? new Date(body.purchasedAt) : null;
    }
    if (body.finishedAt !== undefined) {
      data.finishedAt = body.finishedAt ? new Date(body.finishedAt) : null;
    }

    if (body.status !== undefined) {
      data.status = body.status;
      // 标记为读过时，若无读完日期则自动填今天
      if (body.status === BookStatus.read && !existing.finishedAt && body.finishedAt === undefined) {
        data.finishedAt = new Date();
      }
    }

    const book = await prisma.book.update({ where: { id }, data });
    return NextResponse.json({ book });
  } catch (err) {
    const message = err instanceof Error ? err.message : "更新失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE /api/books/[id] */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    await prisma.book.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "删除失败" }, { status: 404 });
  }
}
