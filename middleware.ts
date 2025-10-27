import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ANON_COOKIE = 'qmf_anon_session';

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  if (!req.cookies.get(ANON_COOKIE)?.value) {
    res.cookies.set(ANON_COOKIE, crypto.randomUUID(), {
      httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60*60*24*365
    });
  }
  return res;
}

export const config = {
  matcher: ['/', '/chat/:path*'],
};
