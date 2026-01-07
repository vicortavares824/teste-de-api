import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const TMDB_API_KEY = process.env.TMDB_API_KEY || '60b55db2a598d09f914411a36840d1cb';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tmdbId = searchParams.get('id');
  const type = searchParams.get('type'); // 'movie' ou 'tv'

  if (!tmdbId || !type) {
    return NextResponse.json(
      { error: 'Parâmetros id e type são obrigatórios' },
      { status: 400 }
    );
  }

  if (!['movie', 'tv'].includes(type)) {
    return NextResponse.json({ error: 'Type deve ser movie ou tv' }, { status: 400 });
  }

  try {
    const endpoint = type === 'movie' ? 'movie' : 'tv';
    const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`;

    const response = await fetch(url);

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Erro ao buscar dados do TMDB' },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Formatar dados para o formato do nosso JSON
    const formatted = {
      id: data.id,
      adult: data.adult || false,
      backdrop_path: data.backdrop_path || '',
      genre_ids: data.genres ? data.genres.map((g: any) => g.id) : [],
      original_language: data.original_language || 'pt',
      overview: data.overview || '',
      popularity: data.popularity || 0,
      poster_path: data.poster_path || '',
      vote_average: data.vote_average || 0,
      vote_count: data.vote_count || 0,
    };

    if (type === 'movie') {
      Object.assign(formatted, {
        title: data.title || '',
        original_title: data.original_title || '',
        release_date: data.release_date || '',
      });
    } else {
      Object.assign(formatted, {
        name: data.name || '',
        original_name: data.original_name || '',
        first_air_date: data.first_air_date || '',
      });
    }

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error('Erro ao buscar TMDB:', error);
    return NextResponse.json(
      { error: error.message || 'Erro desconhecido' },
      { status: 500 }
    );
  }
}
