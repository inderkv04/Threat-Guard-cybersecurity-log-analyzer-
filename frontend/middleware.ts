import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public routes
  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth/login")) {
    return NextResponse.next();
  }

  // Protect these pages (we'll add them next)
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/upload")) {
    const token = req.cookies.get("la_auth")?.value;
    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/upload/:path*", "/login", "/api/auth/login"],
};

