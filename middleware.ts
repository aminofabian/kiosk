import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import { isPublicDomain } from '@/lib/domain/resolve';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;
    const hostname = req.headers.get('host') || req.headers.get('x-forwarded-host');

    const isPublic = isPublicDomain(hostname);

    if (isPublic) {
      return NextResponse.next();
    }

    // Admin routes require admin or owner role
    if (pathname.startsWith('/admin')) {
      if (token?.role === 'cashier') {
        return NextResponse.redirect(new URL('/pos', req.url));
      }
    }

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
        const hostname = req.headers.get('host') || req.headers.get('x-forwarded-host');

        const isPublic = isPublicDomain(hostname);

        if (isPublic) {
          return true;
        }

        const publicRoutes = [
          '/login', 
          '/register', 
          '/forgot-password',
          '/reset-password',
          '/pos/login',
          '/api/auth', 
          '/api/domain',
          '/api/db',
          '/api/superadmin/setup',
          '/superadmin/login', 
          '/superadmin/setup'
        ];
        if (publicRoutes.some((route) => pathname.startsWith(route))) {
          return true;
        }

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
