import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const isAdminRoute = req.nextUrl.pathname.startsWith("/admin");
    const isLoginPage = req.nextUrl.pathname === "/admin/login";

    // If trying to access admin routes without being logged in
    if (isAdminRoute && !isLoginPage && !token) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }

    // If logged in and trying to access login page, redirect to calendar
    if (isLoginPage && token) {
      return NextResponse.redirect(new URL("/admin/calendar", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const isLoginPage = req.nextUrl.pathname === "/admin/login";
        // Allow access to login page without token
        if (isLoginPage) return true;
        // Require token for all other admin routes
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: ["/admin/:path*"],
};
