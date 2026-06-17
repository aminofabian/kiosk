import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { isPublicDomain } from "@/lib/domain/resolve";
import { canSell } from "@/lib/auth/permissions";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;
    const hostname =
      req.headers.get("host") || req.headers.get("x-forwarded-host");

    const isPublic = isPublicDomain(hostname);

    if (isPublic) {
      return NextResponse.next();
    }

    const role = token?.role;

    // ── department_stock_manager → count workspace only ──
    if (role === "department_stock_manager") {
      if (token && pathname === "/login") {
        return NextResponse.redirect(new URL("/department/count", req.url));
      }
      if (pathname === "/department" || pathname === "/department/") {
        return NextResponse.redirect(new URL("/department/count", req.url));
      }
      if (
        pathname.startsWith("/department/count") ||
        pathname.startsWith("/api/") ||
        pathname === "/login"
      ) {
        return NextResponse.next();
      }
      if (pathname.startsWith("/department/")) {
        return NextResponse.redirect(new URL("/department/count", req.url));
      }
      if (token) {
        return NextResponse.redirect(new URL("/department/count", req.url));
      }
    }

    // ── Global: department_staff are restricted to /department only ──
    if (role === "department_staff") {
      if (token && pathname === "/login") {
        return NextResponse.redirect(new URL("/department", req.url));
      }
      // Allow access to /department and /api (for data fetching)
      if (
        pathname === "/department" ||
        pathname.startsWith("/department/") ||
        pathname.startsWith("/api/") ||
        pathname === "/login"
      ) {
        return NextResponse.next();
      }
      // Everything else → redirect to department workspace
      return NextResponse.redirect(new URL("/department", req.url));
    }

    // Admin routes - allow cashiers but restrict certain pages
    if (pathname.startsWith("/admin")) {
      // Cashiers land on POS, not the admin dashboard
      if (role === "cashier" && pathname === "/admin") {
        return NextResponse.redirect(new URL("/pos", req.url));
      }

      // Cashiers can access admin but only specific pages
      if (role === "cashier") {
        // Restrict cashiers from accessing these routes
        const restrictedRoutes = [
          "/admin/users",
          "/admin/banners",
          "/admin/profit",
          "/admin/reports",
          "/admin/purchases",
          "/admin/stock/take", // Stock take not allowed
        ];

        // Allow /admin/stock/adjust but not /admin/stock (view stock)
        if (
          pathname === "/admin/stock" ||
          pathname.startsWith("/admin/stock/")
        ) {
          if (pathname !== "/admin/stock/adjust") {
            return NextResponse.redirect(new URL("/admin", req.url));
          }
        }

        // Check if accessing a restricted route
        if (restrictedRoutes.some((route) => pathname.startsWith(route))) {
          return NextResponse.redirect(new URL("/admin", req.url));
        }

        // Block cashiers from editing items
        if (
          pathname.startsWith("/admin/items/") &&
          pathname.includes("/edit")
        ) {
          return NextResponse.redirect(new URL("/admin/items", req.url));
        }

        // Cashiers cannot access supplier bills UI (API is protected separately)
        if (
          pathname === "/admin/supplier-bills" ||
          pathname.startsWith("/admin/supplier-bills/")
        ) {
          return NextResponse.redirect(new URL("/admin", req.url));
        }
      }
    }

    // POS routes require the 'sell' permission
    if (pathname.startsWith("/pos")) {
      const role = token?.role as
        | import("@/lib/constants").UserRole
        | undefined;
      if (!role || !canSell(role)) {
        return NextResponse.redirect(new URL("/admin", req.url));
      }
    }

    if (pathname.startsWith("/admin/users")) {
      if (token?.role !== "owner") {
        return NextResponse.redirect(new URL("/admin", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;
        const hostname =
          req.headers.get("host") || req.headers.get("x-forwarded-host");

        const isPublic = isPublicDomain(hostname);

        if (isPublic) {
          return true;
        }

        const publicRoutes = [
          "/login",
          "/register",
          "/forgot-password",
          "/reset-password",
          "/pos/login",
          "/superadmin/login",
          "/superadmin/setup",
        ];
        if (publicRoutes.some((route) => pathname.startsWith(route))) {
          return true;
        }
        if (pathname === "/c" || pathname.startsWith("/c/")) {
          return true;
        }
        if (pathname === "/department" || pathname.startsWith("/department/")) {
          return true;
        }

        return !!token;
      },
    },
  },
);

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    // API routes authenticate inside each handler (session cookie or external API key).
    // Matching /api here would block cookie-less clients before the handler runs.
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*|api/).*)",
  ],
};
