import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Admin routes require admin or owner role
    if (pathname.startsWith('/admin')) {
      if (token?.role === 'cashier') {
        // Cashiers can't access admin - redirect to POS
        return NextResponse.redirect(new URL('/pos', req.url));
      }
    }

    // User management requires owner role
    if (pathname.startsWith('/admin/users')) {
      if (token?.role !== 'owner') {
        return NextResponse.redirect(new URL('/admin', req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;

        // Public routes that don't need authentication
        const publicRoutes = ['/login', '/register', '/api/auth'];
        if (publicRoutes.some((route) => pathname.startsWith(route))) {
          return true;
        }

        // API routes for db setup (temporary, remove in production)
        if (pathname.startsWith('/api/db')) {
          return true;
        }

        // All other routes require authentication
        return !!token;
      },
    },
  }
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
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|api/db).*)',
  ],
};
