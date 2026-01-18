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

    // Admin routes - allow cashiers but restrict certain pages
    if (pathname.startsWith('/admin')) {
      const role = token?.role;
      
      // Cashiers can access admin but only specific pages
      if (role === 'cashier') {
        // Restrict cashiers from accessing these routes
        const restrictedRoutes = [
          '/admin/users',
          '/admin/banners',
          '/admin/profit',
          '/admin/reports',
          '/admin/purchases',
          '/admin/stock/take', // Stock take not allowed
        ];
        
        // Allow /admin/stock/adjust but not /admin/stock (view stock)
        if (pathname === '/admin/stock' || pathname.startsWith('/admin/stock/')) {
          if (pathname !== '/admin/stock/adjust') {
            return NextResponse.redirect(new URL('/admin', req.url));
          }
        }
        
        // Check if accessing a restricted route
        if (restrictedRoutes.some(route => pathname.startsWith(route))) {
          return NextResponse.redirect(new URL('/admin', req.url));
        }
        
        // Block cashiers from editing items
        if (pathname.startsWith('/admin/items/') && pathname.includes('/edit')) {
          return NextResponse.redirect(new URL('/admin/items', req.url));
        }
        
        // Cashiers can create supplier bills but not view the list
        if (pathname === '/admin/supplier-bills' || pathname.startsWith('/admin/supplier-bills/')) {
          if (pathname !== '/admin/supplier-bills/new') {
            return NextResponse.redirect(new URL('/admin', req.url));
          }
        }
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
