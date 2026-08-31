import { NextRequest, NextResponse } from "next/server";

/**
 * The redesigned interface is the public default. Switching is handled by
 * the authenticated admin endpoint.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isRedesignPath = pathname === "/redesign" || pathname.startsWith("/redesign/");

  if (isRedesignPath) {
    const target = request.nextUrl.clone();
    target.pathname = pathname.replace(/^\/redesign/, "") || "/";
    target.searchParams.delete("ui");
    return NextResponse.redirect(target);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml).*)"],
};
