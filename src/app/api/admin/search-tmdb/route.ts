import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const TMDB_API_KEY = process.env.TMDB_API_KEY || '60b55db2a598d09f914411a36840d1cb';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');
  const type = searchParams.get('type'); // 'movie' ou 'tv'

  if (!query) {
    return NextResponse.json(
      { error: 'Parâmetro query é obrigatório' },
      { status: 400 }
    );
  }

  if (!type || !['movie', 'tv'].includes(type)) {
    return NextResponse.json({ error: 'Type deve ser movie ou tv' }, { status: 400 });
  }

  try {
    const endpoint = type === 'movie' ? 'search/movie' : 'search/tv';
    const url = `https://api.themoviedb.org/3/${endpoint}?api_key=${TMDB_API_KEY}&language=pt-BR&query=${encodeURIComponent(query)}`;

    const response = await fetch(url);

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Erro ao buscar no TMDB' },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Formatar resultados
    const results = data.results.slice(0, 10).map((item: any) => ({
      id: item.id,
      title: item.title || item.name,
      original_title: item.original_title || item.original_name,
      release_date: item.release_date || item.first_air_date,
      poster_path: item.poster_path,
      overview: item.overview,
      vote_average: item.vote_average,
    }));

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error('Erro ao buscar TMDB:', error);
    return NextResponse.json(
      { error: error.message || 'Erro desconhecido' },
      { status: 500 }
    );
  }
}
