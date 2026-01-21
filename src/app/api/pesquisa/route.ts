import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

const TMDB_API_KEY = process.env.TMDB_API_KEY || '60b55db2a598d09f914411a36840d1cb';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');
  if (!query || query.length < 2) {
    return NextResponse.json({ error: 'Parâmetro query é obrigatório e deve ter pelo menos 2 caracteres.' }, { status: 400 });
  }

  // Busca usando API externa (retorna objetos compatíveis com TMDB-like)
  const externalSearch = `https://streaming-api-ready-for-render.onrender.com/api/search?q=${encodeURIComponent(query)}`;

  let externalResults: any[] = [];
  try {
    const res = await fetch(externalSearch);
    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      // fallback: continue to local matching below
      externalResults = [];
    } else {
      const data = await res.json().catch(() => null);
      externalResults = Array.isArray(data?.results) ? data.results : [];
    }
  } catch (e) {
    externalResults = [];
  }

  // derive by media type/tipo for local matching
  const externalMovieResults = externalResults.filter((r: any) => (r.media_type === 'movie') || (r.tipo === 'filme'));
  const externalTvResults = externalResults.filter((r: any) => (r.media_type === 'tv') || (r.tipo === 'serie'));
  const externalAnimeResults = externalResults.filter((r: any) => (r.tipo === 'anime') || (r.media_type === 'tv' && String(r.original_language || '').toLowerCase() === 'ja'));

  // Mapear e retornar diretamente os resultados da API externa
  const animeIdSet = new Set(externalAnimeResults.map((r: any) => String(r.id)));

  const mapMovie = (r: any) => ({
    ...r,
    media_type: 'movie',
    tipo: 'filme',
    URLvideo: (r.URLvideo || r.video || r.url || r.URL || (r.id ? `https://roxanoplay.bb-bet.top/pages/hostmov.php?id=${r.id}` : ''))?.toString().trim()
  });

  const mapSeries = (r: any) => ({
    ...r,
    media_type: 'tv',
    tipo: 'serie'
  });

  const mapAnime = (r: any) => ({
    ...r,
    media_type: 'tv',
    tipo: 'anime'
  });

  const filmes = externalMovieResults.map(mapMovie);
  const series = externalTvResults.filter((r: any) => !animeIdSet.has(String(r.id))).map(mapSeries);
  const animes = externalAnimeResults.map(mapAnime);

  return NextResponse.json({
    filmes,
    series,
    animes,
    total_filmes: filmes.length,
    total_series: series.length,
    total_animes: animes.length
  });
}