import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const ANON_COOKIE = 'qmf_anon_session';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Create Supabase client for session refresh
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value);
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh session if user is authenticated
  // This ensures Supabase auth cookies are properly set/refreshed
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Only set anonymous cookie if user is NOT authenticated
  if (!user && !req.cookies.get(ANON_COOKIE)?.value) {
    // Use Web Crypto API (available in Edge Runtime) instead of Node.js crypto
    const uuid = crypto.randomUUID();
    res.cookies.set(ANON_COOKIE, uuid, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      // Don't set Secure in development (localhost is HTTP)
      ...(process.env.NODE_ENV === 'production' ? { secure: true } : {}),
    });
  }

  return res;
}

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
