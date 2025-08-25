import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: { type: string } }) {
  const { type } = params;
  const searchParams = req.nextUrl.searchParams;
  let targetUrl = '';
  if (type === 'movie') {
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID não informado' }, { status: 400 });
    }
    targetUrl = `https://roxanoplay.vercel.app/api/filmes?id=${encodeURIComponent(id)}`;
  } else if (type === 'tv') {
    const tmdb = searchParams.get('tmdb');
    const season = searchParams.get('season');
    const episode = searchParams.get('episode');
    if (!tmdb || !season || !episode) {
      return NextResponse.json({ error: 'Parâmetros tmdb, season e episode são obrigatórios para séries.' }, { status: 400 });
    }
    const id = `${tmdb}/${season}/${episode}`;
    targetUrl = `https://roxanoplay.vercel.app/api/proxy?id=${encodeURIComponent(id)}`;
  } else {
    return NextResponse.json({ error: 'Tipo inválido. Use movie ou tv.' }, { status: 400 });
  }

  // Copia o cabeçalho Range para suportar streaming
  const headers: Record<string, string> = {};
  const range = req.headers.get('range');
  if (range) headers['range'] = range;

  // Faz o fetch do arquivo original
  const response = await fetch(targetUrl, { headers });

  // Repassa status, headers e body para o usuário
  const resHeaders = new Headers(response.headers);
  // Adiciona cabeçalho de cache para Cloudflare (exemplo: 1 hora)
  resHeaders.set('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=60');
  return new NextResponse(response.body, {
    status: response.status,
    headers: resHeaders,
  });
}
