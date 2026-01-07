import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('admin-session');

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao fazer logout' },
      { status: 500 }
    );
  }
}
