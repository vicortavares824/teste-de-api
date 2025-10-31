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
  let animesIds = new Set();
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
  // carrega ids de animes.json
  try {
    const animesPath = path.resolve(process.cwd(), 'animes.json');
    const animesStr = await fs.readFile(animesPath, 'utf-8');
    const animesData = JSON.parse(animesStr);
    for (const page of animesData.pages || []) {
      for (const result of page.results || []) {
        animesIds.add(String(result.id));
      }
    }
  } catch {}

  // util: normaliza texto removendo espaços, maiúsculas e acentos
  const normalize = (s?: string) => {
    if (!s) return '';
    try {
      return s
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/\s+/g, '');
    } catch (e) {
      return s.toLowerCase().replace(/\s+/g, '');
    }
  };
  const normQuery = normalize(query || '');

  // Carrega todos os objetos dos arquivos locais para busca detalhada
  let filmesEncontrados = [];
  let seriesEncontradas = [];
  let animesEncontrados = [];
  try {
    const filmesPath = path.resolve(process.cwd(), 'filmes.json');
    const filmesStr = await fs.readFile(filmesPath, 'utf-8');
    const filmesData = JSON.parse(filmesStr);
    for (const page of filmesData.pages || []) {
      for (const result of page.results || []) {
        // corresponde por id vindo do TMDB
        const matchesId = movieResults.some(f => String(f.id) === String(result.id));
        // fallback: corresponde por título local vs query (normalizado)
        const localTitle = normalize(result.title || result.name || result.original_name);
        const matchesTitle = normQuery && localTitle.includes(normQuery);
        if (matchesId || matchesTitle) {
          filmesEncontrados.push({ ...result, media_type: 'movie', tipo: 'filme' });
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
        const matchesId = tvResults.some(s => String(s.id) === String(result.id));
        const localTitle = normalize(result.name || result.original_name || result.title);
        const matchesTitle = normQuery && localTitle.includes(normQuery);
        if (matchesId || matchesTitle) {
          seriesEncontradas.push({ ...result, media_type: 'tv', tipo: 'serie' });
        }
      }
    }
  } catch {}

  // busca em animes.json (muitos animes são retornados como TV no TMDB)
  try {
    const animesPath = path.resolve(process.cwd(), 'animes.json');
    const animesStr = await fs.readFile(animesPath, 'utf-8');
    const animesData = JSON.parse(animesStr);
    for (const page of animesData.pages || []) {
      for (const result of page.results || []) {
        const matchesId = tvResults.some(s => String(s.id) === String(result.id));
        const localTitle = normalize(result.name || result.original_name || result.title);
        const matchesTitle = normQuery && localTitle.includes(normQuery);
        if (matchesId || matchesTitle) {
          animesEncontrados.push({ ...result, media_type: 'tv', tipo: 'anime' });
        }
      }
    }
  } catch {}

  return NextResponse.json({
    filmes: filmesEncontrados,
    series: seriesEncontradas,
    animes: animesEncontrados,
    total_filmes: filmesEncontrados.length,
    total_series: seriesEncontradas.length,
    total_animes: animesEncontrados.length
  });
}