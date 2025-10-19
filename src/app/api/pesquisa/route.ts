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

  // Busca filmes e séries no TMDB
  const tmdbMovieUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&language=pt-BR&query=${encodeURIComponent(query)}`;
  const tmdbTvUrl = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&language=pt-BR&query=${encodeURIComponent(query)}`;

  let movieResults = [];
  let tvResults = [];
  try {
    const [movieRes, tvRes] = await Promise.all([
      fetch(tmdbMovieUrl),
      fetch(tmdbTvUrl)
    ]);
    if (movieRes.ok) {
      const data = await movieRes.json();
      movieResults = data.results || [];
    }
    if (tvRes.ok) {
      const data = await tvRes.json();
      tvResults = data.results || [];
    }
  } catch (e) {
    return NextResponse.json({ error: 'Erro ao buscar na API TMDB.' }, { status: 502 });
  }

  // Carrega ids locais de filmes.json e series.json
  let filmesIds = new Set();
  let seriesIds = new Set();
  try {
    const filmesPath = path.resolve(process.cwd(), 'filmes.json');
    const filmesStr = await fs.readFile(filmesPath, 'utf-8');
    const filmesData = JSON.parse(filmesStr);
    for (const page of filmesData.pages || []) {
      for (const result of page.results || []) {
        filmesIds.add(String(result.id));
      }
    }
  } catch {}
  try {
    const seriesPath = path.resolve(process.cwd(), 'series.json');
    const seriesStr = await fs.readFile(seriesPath, 'utf-8');
    const seriesData = JSON.parse(seriesStr);
    for (const page of seriesData.pages || []) {
      for (const result of page.results || []) {
        seriesIds.add(String(result.id));
      }
    }
  } catch {}

  // Carrega todos os objetos dos arquivos locais para busca detalhada
  let filmesEncontrados = [];
  let seriesEncontradas = [];
  try {
    const filmesPath = path.resolve(process.cwd(), 'filmes.json');
    const filmesStr = await fs.readFile(filmesPath, 'utf-8');
    const filmesData = JSON.parse(filmesStr);
    for (const page of filmesData.pages || []) {
      for (const result of page.results || []) {
        if (movieResults.some(f => String(f.id) === String(result.id))) {
          filmesEncontrados.push(result);
        }
      }
    }
  } catch {}
  try {
    const seriesPath = path.resolve(process.cwd(), 'series.json');
    const seriesStr = await fs.readFile(seriesPath, 'utf-8');
    const seriesData = JSON.parse(seriesStr);
    for (const page of seriesData.pages || []) {
      for (const result of page.results || []) {
        if (tvResults.some(s => String(s.id) === String(result.id))) {
          seriesEncontradas.push(result);
        }
      }
    }
  } catch {}

  return NextResponse.json({
    filmes: filmesEncontrados,
    series: seriesEncontradas,
    total_filmes: filmesEncontrados.length,
    total_series: seriesEncontradas.length
  });
}