import { NextResponse } from 'next/server';

// Proxy para arquivos .mp4 de filmes dublados
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID do filme não informado.' }, { status: 400 });
  }

  // Monta a URL do serviço externo
  const url = `https://roxanoplay.bb-bet.top/pages/proxy_filmes.php?id=${encodeURIComponent(id)}`;

  // Faz o proxy da requisição e repassa o conteúdo bruto (stream .mp4 ou json)
  const response = await fetch(url);

  // Copia os headers relevantes
  const headers = new Headers();
  response.headers.forEach((value, key) => {
    headers.set(key, value);
  });

  // Retorna o stream bruto (pode ser .mp4 ou json)
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
