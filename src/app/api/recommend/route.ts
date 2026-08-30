import { NextRequest, NextResponse } from "next/server";
import { BookStatus } from "@prisma/client";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { pickAlternative, pickDailyRecommendation } from "@/lib/recommend";

/** GET /api/recommend/daily?exclude=id — 今日推荐 */
export async function GET(req: NextRequest) {
  const exclude = req.nextUrl.searchParams.get("exclude");
  const dateKey = format(new Date(), "yyyy-MM-dd");

  const pool = await prisma.book.findMany({
    where: {
      status: { in: [BookStatus.wantToRead, BookStatus.unread] },
    },
  });

  const book = exclude
    ? pickAlternative(pool, dateKey, exclude)
    : pickDailyRecommendation(pool, dateKey);

  return NextResponse.json({ book, dateKey, poolSize: pool.length });
}
