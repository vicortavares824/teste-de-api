import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('admin-session');
  const { pathname } = request.nextUrl;

  // Se está tentando acessar /admin (exceto /admin/login)
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    // Se não tem sessão, redireciona para login
    if (!session) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  // Se está logado e tenta acessar /admin/login, redireciona para /admin
  if (pathname === '/admin/login' && session) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/admin/:path*',
};
