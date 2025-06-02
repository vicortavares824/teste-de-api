import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page') || '1';

  // Altere para a URL da sua API hospedada no Vercel
  const apiUrl = `https://cine-stream-api.vercel.app/api/series?page=${page}`;

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      return NextResponse.json({ error: 'Erro ao buscar dados da API externa', status: response.status }, { status: response.status });
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: 'Erro ao buscar dados da API externa', detalhes: e instanceof Error ? e.message : e }, { status: 500 });
  }
}
