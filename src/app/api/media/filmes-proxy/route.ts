import { NextResponse } from 'next/server';

// Proxy para arquivos .mp4 de filmes dublados
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID do filme não informado.' }, { status: 400 });
  }

  // Apenas retorna a URL da API externa como resposta
  const url = `https://roxanoplay.bb-bet.top/pages/hostmov.php?id=${encodeURIComponent(id)}`;
  return NextResponse.json({ url });
}
