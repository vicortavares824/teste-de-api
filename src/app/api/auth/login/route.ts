import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    // Credenciais do arquivo .env.local
    const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

    // Validar credenciais
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      // Criar sessão (cookie seguro)
      const cookieStore = await cookies();
      
      // Token simples (em produção, use JWT ou similar)
      const token = Buffer.from(`${username}:${Date.now()}`).toString('base64');
      
      cookieStore.set('admin-session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24, // 24 horas
        path: '/',
      });

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: 'Usuário ou senha inválidos' },
        { status: 401 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao processar login' },
      { status: 500 }
    );
  }
}
