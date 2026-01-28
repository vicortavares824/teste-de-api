import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

const TMDB_API_KEY = process.env.TMDB_API_KEY || '60b55db2a598d09f914411a36840d1cb';

const DEFAULT_LOCAL_LIMIT = 50;

const loadLocalData = async (file: string): Promise<any[]> => {
  try {
    const filePath = path.resolve(process.cwd(), file);
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    // Alguns arquivos neste repo usam { pages: [ { results: [...] } ] }
    if (Array.isArray(data)) return data;
    const items: any[] = [];
    for (const page of data.pages || []) {
      items.push(...(page.results || []));
    }
    return items;
  } catch (error) {
    console.warn(`[loadLocalData] Falha ao carregar ${file}:`, error);
    return [];
  }
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');
  if (!query || query.length < 2) {
    return NextResponse.json({ error: 'Parâmetro query é obrigatório e deve ter pelo menos 2 caracteres.' }, { status: 400 });
  }

  // Busca usando API externa (retorna objetos compatíveis com TMDB-like)
  const externalSearch = `https://streaming-api-ready-for-render.onrender.com/api/search?q=${encodeURIComponent(query)}`;

  let externalResults: any[] = [];
  // Carregar e buscar nos JSONs locais (filmes.json, series.json) primeiro
  const [localMovies, localSeries] = await Promise.all([
    loadLocalData('filmes.json'),
    loadLocalData('series.json'),
  ]);

  const q = String(query).toLowerCase().trim();
  const matchLocal = (item: any) => {
    if (!item) return false;
    const fields = [item.title, item.name, item.original_title, item.overview, item.original_name];
    return fields.some(f => typeof f === 'string' && f.toLowerCase().includes(q));
  };

  const localMovieMatches = localMovies.filter(matchLocal).slice(0, DEFAULT_LOCAL_LIMIT);
  const localSeriesMatches = localSeries.filter(matchLocal).slice(0, DEFAULT_LOCAL_LIMIT);

  // Agora busca na API externa e filtra apenas resultados que não existem nos JSONs locais
  try {
    const res = await fetch(externalSearch);
    if (!res.ok) {
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

  // Mapear resultados externos
  const filmesExternal = externalMovieResults.map(mapMovie);
  const seriesExternal = externalTvResults.filter((r: any) => !animeIdSet.has(String(r.id))).map(mapSeries);
  const animes = externalAnimeResults.map(mapAnime);

  // Mapear resultados locais
  const mapLocalMovie = (it: any) => ({
    ...it,
    media_type: 'movie',
    tipo: 'filme',
    URLvideo: (it.URLvideo || it.video || it.url || it.URL || '')?.toString().trim(),
  });

  const mapLocalSeries = (it: any) => ({
    ...it,
    media_type: 'tv',
    tipo: 'serie',
  });

  const filmesLocal = localMovieMatches.map(mapLocalMovie);
  const seriesLocal = localSeriesMatches.map(mapLocalSeries);

  // Conjuntos para deduplicação (ids e títulos normalizados) a partir dos locais
  const localIdSet = new Set<string>([
    ...filmesLocal.map((i: any) => String(i.id)),
    ...seriesLocal.map((i: any) => String(i.id)),
  ].filter(Boolean));
  const normalize = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '').trim();
  const localTitleSet = new Set<string>([
    ...filmesLocal.map((i: any) => normalize(i.title || i.name)),
    ...seriesLocal.map((i: any) => normalize(i.title || i.name || i.original_name)),
  ].filter(Boolean));

  // Filtrar externos removendo duplicados com os locais (por id ou title)
  const filmesExternalFiltered = filmesExternal.filter((it: any) => {
    const id = String(it.id || '');
    if (id && localIdSet.has(id)) return false;
    const t = normalize(it.title || it.name || it.original_title || it.original_name || '');
    if (t && localTitleSet.has(t)) return false;
    return true;
  });

  const seriesExternalFiltered = seriesExternal.filter((it: any) => {
    const id = String(it.id || '');
    if (id && localIdSet.has(id)) return false;
    const t = normalize(it.title || it.name || it.original_title || it.original_name || '');
    if (t && localTitleSet.has(t)) return false;
    return true;
  });

  // Combinar: locais primeiro, depois externos filtrados
  const filmes = [...filmesLocal, ...filmesExternalFiltered];
  const series = [...seriesLocal, ...seriesExternalFiltered];

  return NextResponse.json({
    filmes,
    series,
    animes,
    total_filmes: filmes.length,
    total_series: series.length,
    total_animes: animes.length,
    source: {
      external_count: externalResults.length,
      local_movies: localMovieMatches.length,
      local_series: localSeriesMatches.length,
    }
  });
}