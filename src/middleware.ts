import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "aoao_access";

/** 访问码中间件：仅当设置了 ACCESS_CODE 时生效 */
export function middleware(req: NextRequest) {
  const expected = process.env.ACCESS_CODE?.trim();
  if (!expected) {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;

  // 放行登录页、鉴权 API、静态资源
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/covers") ||
    pathname.startsWith("/mascot") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (cookie === expected) {
    return NextResponse.next();
  }

  // API 未授权返回 401
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "需要访问码" }, { status: 401 });
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
