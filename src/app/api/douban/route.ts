import { NextRequest, NextResponse } from "next/server";
import {
  fetchByIsbn,
  fetchBySubjectId,
  fetchByTitle,
} from "@/lib/douban";

/** GET /api/douban?isbn= | ?subjectId= | ?title=&author= */
export async function GET(req: NextRequest) {
  const isbn = req.nextUrl.searchParams.get("isbn");
  const subjectId = req.nextUrl.searchParams.get("subjectId");
  const title = req.nextUrl.searchParams.get("title");
  const author = req.nextUrl.searchParams.get("author") ?? undefined;

  if (!isbn && !subjectId && !title) {
    return NextResponse.json(
      { error: "请提供 isbn、subjectId 或 title" },
      { status: 400 }
    );
  }

  const info = subjectId
    ? await fetchBySubjectId(subjectId)
    : isbn
      ? await fetchByIsbn(isbn)
      : await fetchByTitle(title!, author);

  return NextResponse.json({ info });
}
