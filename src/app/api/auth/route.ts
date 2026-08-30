import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const COOKIE_NAME = "aoao_access";

/** POST /api/auth — 校验访问码并写入 Cookie */
export async function POST(req: NextRequest) {
  const expected = process.env.ACCESS_CODE?.trim();
  if (!expected) {
    return NextResponse.json({ ok: true, message: "未启用访问码" });
  }

  const body = await req.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code.trim() : "";

  if (code !== expected) {
    return NextResponse.json({ error: "访问码错误" }, { status: 401 });
  }

  const jar = await cookies();
  jar.set(COOKIE_NAME, code, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 天
  });

  return NextResponse.json({ ok: true });
}

/** DELETE /api/auth — 退出登录 */
export async function DELETE() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
