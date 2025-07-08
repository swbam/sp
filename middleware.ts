import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextRequest, NextResponse } from 'next/server';

// Performance optimization: only run middleware on specific routes
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
  // Skip middleware for static assets and API routes that don't need auth
  if (
    pathname.startsWith('/_next/static') ||
    pathname.startsWith('/api/trending') ||
    pathname.startsWith('/api/shows') ||
    pathname.startsWith('/api/search') ||
    pathname.includes('.') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  
  // Add security and performance headers
  const headers = new Headers(res.headers);
  
  // Security headers
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-XSS-Protection', '1; mode=block');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Performance headers for API routes
  if (pathname.startsWith('/api/')) {
    headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  }

  // Initialize Supabase client for auth-required routes
  try {
    const supabase = createMiddlewareClient({ req, res });
    
    // Only check session for protected routes
    if (pathname.startsWith('/account') || pathname.startsWith('/admin')) {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Redirect to login if no session
      if (!session && !pathname.startsWith('/login')) {
        const redirectUrl = req.nextUrl.clone();
        redirectUrl.pathname = '/login';
        redirectUrl.searchParams.set('redirectTo', pathname);
        return NextResponse.redirect(redirectUrl);
      }
    } else {
      // For other routes, just initialize session without waiting
      supabase.auth.getSession().catch(() => {
        // Ignore errors for non-critical routes
      });
    }
  } catch (error) {
    console.error('Middleware auth error:', error);
    // Continue without blocking the request for non-critical routes
    if (!pathname.startsWith('/account') && !pathname.startsWith('/admin')) {
      return NextResponse.next({
        request: {
          headers: req.headers,
        },
        headers,
      });
    }
  }

  return NextResponse.next({
    request: {
      headers: req.headers,
    },
    headers,
  });
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
