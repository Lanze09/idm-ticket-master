import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'idm_session';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic =
    pathname === '/' ||
    pathname.startsWith('/api/auth/login') ||
    pathname.startsWith('/api/auth/logout') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon');

  const token = req.cookies.get(COOKIE_NAME)?.value;
  let valid = false;
  if (token && process.env.AUTH_SECRET) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET));
      valid = true;
    } catch {
      valid = false;
    }
  }

  // Logged-in users hitting the login page → redirect to dashboard
  if (pathname === '/' && valid) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  if (!isPublic && !valid) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
