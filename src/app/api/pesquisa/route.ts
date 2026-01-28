import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

const TMDB_API_KEY = process.env.TMDB_API_KEY || '60b55db2a598d09f914411a36840d1cb';

const DEFAULT_LOCAL_LIMIT = 50;
const EXTERNAL_CACHE_TTL = Number(process.env.SEARCH_EXTERNAL_CACHE_TTL_MS) || 60 * 1000;
const EXTERNAL_FETCH_TIMEOUT = Number(process.env.SEARCH_EXTERNAL_TIMEOUT_MS) || 2500;

const externalCache = new Map<string, { data: any[]; ts: number }>();

// ============= FUNÇÕES DE BUSCA =============

/**
 * Normaliza string removendo acentos e caracteres especiais
 */
const normalize = (s: string): string => {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Calcula score de relevância (0-100)
 */
const calculateRelevanceScore = (query: string, text: string): number => {
  if (!text) return 0;

  const q = normalize(query);
  const t = normalize(text);

  if (t === q) return 100;
  if (t.includes(q)) return 85;
  if (t.startsWith(q)) return 80;

  const queryWords = q.split(' ').filter(Boolean);
  const textWords = t.split(' ');
  const matchedWords = queryWords.filter(qw => textWords.some(tw => tw.includes(qw)));
  
  if (matchedWords.length === queryWords.length) {
    return 70 + (matchedWords.length / queryWords.length) * 15;
  }

  const anyWordMatch = queryWords.some(qw => t.includes(qw));
  if (anyWordMatch) return 40;

  const similarity = calculateStringSimilarity(q, t);
  if (similarity > 0.6) {
    return similarity * 60;
  }

  return 0;
};

/**
 * Calcula similaridade Levenshtein (0-1)
 */
const calculateStringSimilarity = (s1: string, s2: string): number => {
  const len1 = s1.length;
  const len2 = s2.length;
  
  if (len1 === 0) return len2 === 0 ? 1 : 0;
  if (len2 === 0) return 0;

  const matrix: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const maxLen = Math.max(len1, len2);
  const distance = matrix[len1][len2];
  return 1 - distance / maxLen;
};

/**
 * Detecta tipo de série
 */
const detectSeriesType = (item: any): 'seasons' | 'simple' => {
  const hasSeasons = Object.keys(item).some(key => 
    key.match(/^temporada_\d+$/) || key.match(/^season_\d+$/)
  );
  return hasSeasons ? 'seasons' : 'simple';
};

/**
 * Calcula score total
 */
const calculateItemScore = (item: any, query: string): number => {
  const fields = [
    { name: item.title || item.name || '', weight: 40 },
    { name: item.original_title || item.original_name || '', weight: 30 },
    { name: item.overview || item.description || '', weight: 20 },
    { name: item.genres || '', weight: 10 },
  ];

  let totalScore = 0;
  let totalWeight = 0;

  fields.forEach(field => {
    if (field.name) {
      const score = calculateRelevanceScore(query, String(field.name));
      totalScore += score * field.weight;
      totalWeight += field.weight;
    }
  });

  return totalWeight > 0 ? totalScore / totalWeight : 0;
};

/**
 * Filtra por relevância
 */
const filterByRelevance = (items: any[], query: string, minScore: number = 20): any[] => {
  return items
    .map(item => ({
      ...item,
      _relevanceScore: calculateItemScore(item, query),
    }))
    .filter(item => item._relevanceScore >= minScore)
    .sort((a, b) => b._relevanceScore - a._relevanceScore)
    .map(({ _relevanceScore, ...item }) => item);
};

/**
 * Enriquece série com info de episódios
 */
const enrichSeriesData = (item: any): any => {
  const seriesType = detectSeriesType(item);
  
  const enriched = {
    ...item,
    _seriesType: seriesType,
    _totalSeasons: 0,
    _totalEpisodes: 0,
  };

  if (seriesType === 'seasons') {
    let totalSeasons = 0;
    let totalEpisodes = 0;

    Object.entries(item).forEach(([key, value]) => {
      const seasonMatch = key.match(/^temporada_(\d+)$/i) || key.match(/^season_(\d+)$/i);
      if (seasonMatch && typeof value === 'object') {
        totalSeasons++;
        const episodes = Object.keys(value).filter(k => k.match(/^eps_\d+$/i));
        totalEpisodes += episodes.length;
      }
    });

    enriched._totalSeasons = totalSeasons;
    enriched._totalEpisodes = totalEpisodes;
  }

  return enriched;
};

/**
 * ⭐ DEDUPLICAÇÃO SUPER SIMPLES E RÁPIDA
 * Remove por ID primeiro, depois por título normalizado
 */
const deduplicateByIdAndTitle = (items: any[]): any[] => {
  const seenIds = new Set<string>();
  const seenTitles = new Map<string, any>();
  const result: any[] = [];

  for (const item of items) {
    // Prioridade 1: Remover por ID
    const id = String(item.id || item.tmdb || '').trim();
    if (id && id !== '0' && id !== '') {
      if (seenIds.has(id)) {
        continue; // Skip duplicata
      }
      seenIds.add(id);
      result.push(item);
      continue;
    }

    // Prioridade 2: Remover por título normalizado (sem ID)
    const title = normalize(item.title || item.name || item.original_title || item.original_name || '');
    if (title) {
      if (seenTitles.has(title)) {
        continue; // Skip duplicata
      }
      seenTitles.set(title, item);
      result.push(item);
      continue;
    }

    // Se não tem ID nem título, manter mesmo assim
    result.push(item);
  }

  return result;
};

// ============= FIM FUNÇÕES =============

const loadLocalData = async (file: string): Promise<any[]> => {
  try {
    const filePath = path.resolve(process.cwd(), file);
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    if (Array.isArray(data)) return data;
    if (data.results && Array.isArray(data.results)) return data.results;
    
    if (data.pages && Array.isArray(data.pages)) {
      const items: any[] = [];
      for (const page of data.pages) {
        if (page.results && Array.isArray(page.results)) {
          items.push(...page.results);
        }
      }
      return items;
    }

    return [];
  } catch (error) {
    console.warn(`[loadLocalData] Falha ao carregar ${file}:`, error);
    return [];
  }
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');
  
  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: 'Parâmetro query é obrigatório e deve ter pelo menos 2 caracteres.' },
      { status: 400 }
    );
  }

  const externalSearch = `https://streaming-api-ready-for-render.onrender.com/api/search?q=${encodeURIComponent(query)}`;
  const localOnly = !!searchParams.get('localOnly');
  const minRelevanceScore = Number(searchParams.get('minScore')) || 20;

  let externalResults: any[] = [];
  let externalFetchPromise: Promise<any[]> | null = null;

  if (!localOnly) {
    const cacheKey = `ext:${query}`;
    const cached = externalCache.get(cacheKey);
    
    if (cached && Date.now() - cached.ts < EXTERNAL_CACHE_TTL) {
      externalResults = cached.data;
    } else {
      externalFetchPromise = (async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), EXTERNAL_FETCH_TIMEOUT);
        
        try {
          const res = await fetch(externalSearch, { signal: controller.signal });
          if (!res.ok) return [];
          
          const data = await res.json().catch(() => null);
          const results = Array.isArray(data?.results) ? data.results : [];
          externalCache.set(cacheKey, { data: results, ts: Date.now() });
          return results;
        } catch (e) {
          return [];
        } finally {
          clearTimeout(timeout);
        }
      })();
    }
  }

  // Carregar dados locais
  const [localMovies, localSeries] = await Promise.all([
    loadLocalData('filmes.json'),
    loadLocalData('series.json'),
  ]);

  // Enriquecer séries
  const enrichedLocalSeries = localSeries.map(enrichSeriesData);

  // Filtrar por relevância
  const localMovieMatches = filterByRelevance(localMovies, query, minRelevanceScore).slice(
    0,
    DEFAULT_LOCAL_LIMIT
  );
  const localSeriesMatches = filterByRelevance(enrichedLocalSeries, query, minRelevanceScore).slice(
    0,
    DEFAULT_LOCAL_LIMIT
  );

  // Separar externos
  const externalMovieResults = externalResults.filter(
    (r: any) => r.media_type === 'movie' || r.tipo === 'filme'
  );
  const externalTvResults = externalResults.filter(
    (r: any) => r.media_type === 'tv' || r.tipo === 'serie'
  );
  const externalAnimeResults = externalResults.filter(
    (r: any) => r.tipo === 'anime' || (r.media_type === 'tv' && String(r.original_language || '').toLowerCase() === 'ja')
  );

  const animeIdSet = new Set(externalAnimeResults.map((r: any) => String(r.id)));

  // Mapear
  const mapMovie = (r: any) => ({
    ...r,
    media_type: 'movie',
    tipo: 'filme',
    URLvideo: (
      r.URLvideo ||
      r.video ||
      r.url ||
      r.URL ||
      (r.id ? `https://roxanoplay.bb-bet.top/pages/hostmov.php?id=${r.id}` : '')
    )
      ?.toString()
      .trim(),
  });

  const mapSeries = (r: any) => {
    const mapped = {
      ...r,
      media_type: 'tv',
      tipo: 'serie',
    };
    if (r._seriesType) {
      mapped._seriesType = r._seriesType;
      mapped._totalSeasons = r._totalSeasons;
      mapped._totalEpisodes = r._totalEpisodes;
    }
    return mapped;
  };

  const mapAnime = (r: any) => ({
    ...r,
    media_type: 'tv',
    tipo: 'anime',
  });

  // Mapear externos
  const filmesExternal = filterByRelevance(
    externalMovieResults.map(mapMovie),
    query,
    minRelevanceScore
  );

  const enrichedExternalSeries = externalTvResults.map(enrichSeriesData);
  const seriesExternal = filterByRelevance(
    enrichedExternalSeries
      .filter((r: any) => !animeIdSet.has(String(r.id)))
      .map(mapSeries),
    query,
    minRelevanceScore
  );

  const animes = filterByRelevance(
    externalAnimeResults.map(mapAnime),
    query,
    minRelevanceScore
  );

  // Mapear locais
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
    ...(it._seriesType && {
      _seriesType: it._seriesType,
      _totalSeasons: it._totalSeasons,
      _totalEpisodes: it._totalEpisodes,
    }),
  });

  const filmesLocal = localMovieMatches.map(mapLocalMovie);
  const seriesLocal = localSeriesMatches.map(mapLocalSeries);

  // Controle
  const preferLocal = !!searchParams.get('preferLocal');
  const externalOnly = !!searchParams.get('externalOnly');

  if (preferLocal) {
    if (externalFetchPromise) void externalFetchPromise;
    const external_url = `${new URL(request.url).origin}/api/pesquisa?query=${encodeURIComponent(query)}&externalOnly=1`;
    
    // ⭐ Deduplicar
    const dedup = deduplicateByIdAndTitle([...filmesLocal, ...seriesLocal]);
    const filmes = dedup.filter((i: any) => i.media_type === 'movie');
    const series = dedup.filter((i: any) => i.media_type === 'tv');
    
    return NextResponse.json({
      filmes,
      series,
      animes: [],
      total_filmes: filmes.length,
      total_series: series.length,
      total_animes: 0,
      source: {
        external_fetch_started: !!externalFetchPromise,
        external_url,
      },
    });
  }

  if (externalOnly) {
    if (externalFetchPromise) {
      try {
        externalResults = await externalFetchPromise;
      } catch (e) {
        externalResults = [];
      }
    }

    const extMovieResults = filterByRelevance(
      externalResults.filter((r: any) => r.media_type === 'movie' || r.tipo === 'filme').map(mapMovie),
      query,
      minRelevanceScore
    );

    const extSeriesResults = filterByRelevance(
      externalResults
        .filter((r: any) => r.media_type === 'tv' || r.tipo === 'serie')
        .map(enrichSeriesData)
        .map(mapSeries),
      query,
      minRelevanceScore
    );

    const localIdSet = new Set<string>([
      ...filmesLocal.map((i: any) => String(i.id)),
      ...seriesLocal.map((i: any) => String(i.id)),
    ].filter(Boolean));

    // ⭐ Deduplicar e remover locais
    const allExternal = [...extMovieResults, ...extSeriesResults];
    let dedup = deduplicateByIdAndTitle(allExternal);
    dedup = dedup.filter((it: any) => {
      const id = String(it.id || '');
      return !(id && localIdSet.has(id));
    });

    const filmes = dedup.filter((i: any) => i.media_type === 'movie');
    const series = dedup.filter((i: any) => i.media_type === 'tv');

    return NextResponse.json({
      filmes,
      series,
      animes: deduplicateByIdAndTitle(animes),
      total_filmes: filmes.length,
      total_series: series.length,
      total_animes: animes.length,
      source: {
        external_count: externalResults.length,
        local_movies: filmesLocal.length,
        local_series: seriesLocal.length,
        filtered_against_local: true,
      },
    });
  }

  // Caso padrão: local + externo
  let allResults = [...filmesLocal, ...seriesLocal, ...filmesExternal, ...seriesExternal, ...animes];
  
  // ⭐ DEDUPLICAÇÃO PRINCIPAL
  allResults = deduplicateByIdAndTitle(allResults);

  // Separar tipos
  const filmes = allResults.filter((i: any) => i.media_type === 'movie');
  const series = allResults.filter((i: any) => i.media_type === 'tv' && i.tipo === 'serie');
  const dedupAnimes = allResults.filter((i: any) => i.tipo === 'anime');

  // Se tiver promise externa, processar
  if (externalFetchPromise) {
    try {
      const externalData = await externalFetchPromise;
      
      const extProcessed = externalData
        .map((r: any) => {
          if (r.media_type === 'movie' || r.tipo === 'filme') {
            return mapMovie(r);
          } else if (r.media_type === 'tv' || r.tipo === 'serie') {
            return mapSeries(enrichSeriesData(r));
          } else if (r.tipo === 'anime') {
            return mapAnime(r);
          }
          return null;
        })
        .filter(Boolean);

      // ⭐ Deduplicar com resultado anterior
      const combined = [...allResults, ...extProcessed];
      const dedupCombined = deduplicateByIdAndTitle(combined);

      allResults = dedupCombined;
    } catch (e) {
      // Continuar com resultado anterior
    }
  }

  const filmes2 = allResults.filter((i: any) => i.media_type === 'movie');
  const series2 = allResults.filter((i: any) => i.media_type === 'tv' && i.tipo === 'serie');
  const animes2 = allResults.filter((i: any) => i.tipo === 'anime');

  return NextResponse.json({
    filmes: filmes2,
    series: series2,
    animes: animes2,
    total_filmes: filmes2.length,
    total_series: series2.length,
    total_animes: animes2.length,
    stats: {
      local_filmes: filmesLocal.length,
      local_series: seriesLocal.length,
      external_filmes: filmesExternal.length,
      external_series: seriesExternal.length,
    },
    search_config: {
      min_relevance_score: minRelevanceScore,
      query_normalized: normalize(query),
    },
  });
}