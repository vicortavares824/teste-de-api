import { NextResponse } from 'next/server';

// Proxy para arquivos .mp4 de filmes dublados
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID do filme não informado.' }, { status: 400 });
  }

  // Monta as URLs dos serviços externos
  const urls = [
    `https://roxanoplay.bb-bet.top/pages/proxy_filmes.php?id=${encodeURIComponent(id)}`,
    `https://embedapi.vercel.app/api/filmes?id=${encodeURIComponent(id)}`
  ];

  let response;
  for (const url of urls) {
    response = await fetch(url);
    if (response.ok) {
      // Se a resposta for OK, retorna imediatamente
      const headers = new Headers();
      response.headers.forEach((value, key) => {
        headers.set(key, value);
      });
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
  }

  // Se nenhuma das URLs funcionou, retorna erro
  return NextResponse.json({ error: 'Nenhum servidor disponível para este ID.' }, { status: 502 });
}
