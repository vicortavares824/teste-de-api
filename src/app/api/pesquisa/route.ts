import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

const TMDB_API_KEY = process.env.TMDB_API_KEY || '60b55db2a598d09f914411a36840d1cb';

const DEFAULT_LOCAL_LIMIT = 50;
const EXTERNAL_CACHE_TTL = Number(process.env.SEARCH_EXTERNAL_CACHE_TTL_MS) || 60 * 1000;
const EXTERNAL_FETCH_TIMEOUT = Number(process.env.SEARCH_EXTERNAL_TIMEOUT_MS) || 2500;

const externalCache = new Map<string, { data: any[]; ts: number }>();

// ============= FUNÇÕES DE BUSCA MELHORADAS =============

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
 * Calcula score de relevância entre query e texto (0-100)
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
 * Calcula similaridade usando Levenshtein (0-1)
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
 * Detecta o tipo de série (com temporadas ou simples)
 */
const detectSeriesType = (item: any): 'seasons' | 'simple' => {
  const hasSeasons = Object.keys(item).some(key => 
    key.match(/^temporada_\d+$/) || key.match(/^season_\d+$/)
  );
  return hasSeasons ? 'seasons' : 'simple';
};

/**
 * Calcula score total de um item baseado em múltiplos campos
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
 * Filtra e ordena resultados por relevância
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
 * Enriquece item de série com informações de episódios
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
 * ⭐ DEDUPLICAÇÃO AVANÇADA
 * Remove duplicatas comparando: ID, título normalizado, poster, URL do vídeo
 */
const deduplicateItems = (items: any[]): any[] => {
  const seen = new Map<string, any>();
  
  items.forEach(item => {
    // Criar chaves únicas para identificar duplicatas
    const id = String(item.id || item.tmdb || '');
    const normalizedTitle = normalize(item.title || item.name || item.original_title || item.original_name || '');
    const posterKey = (item.poster_path || item.poster_url || '').replace(/\/t\/p\/w\d+\/|\/t\/p\/w\d+\//g, '');
    const videoKey = (item.URLvideo || item.video || item.url || '').replace(/\?.*$/, ''); // Remove query params
    
    // Tentar encontrar duplicata por ID primeiro (mais confiável)
    if (id) {
      if (seen.has(`id:${id}`)) {
        return; // Skip - já existe com este ID
      }
      seen.set(`id:${id}`, item);
    }
    
    // Se não tem ID, tentar por título + poster
    if (normalizedTitle && posterKey) {
      const key = `title:${normalizedTitle}:${posterKey}`;
      if (seen.has(key)) {
        return; // Skip - já existe com este título e poster
      }
      seen.set(key, item);
    }
    
    // Se não tem poster, tentar por título + vídeo URL
    if (normalizedTitle && videoKey) {
      const key = `video:${normalizedTitle}:${videoKey}`;
      if (seen.has(key)) {
        return; // Skip - já existe com este título e vídeo
      }
      seen.set(key, item);
    }
    
    // Se só tem título
    if (normalizedTitle) {
      const key = `title:${normalizedTitle}`;
      if (!seen.has(key)) {
        seen.set(key, item);
      }
    }
  });

  return Array.from(seen.values());
};

// ============= FIM FUNÇÕES MELHORADAS =============

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

  // Enriquecer dados de séries
  const enrichedLocalSeries = localSeries.map(enrichSeriesData);

  // Aplicar filtro de relevância
  const localMovieMatches = filterByRelevance(localMovies, query, minRelevanceScore).slice(
    0,
    DEFAULT_LOCAL_LIMIT
  );
  const localSeriesMatches = filterByRelevance(enrichedLocalSeries, query, minRelevanceScore).slice(
    0,
    DEFAULT_LOCAL_LIMIT
  );

  // Separar externos por tipo
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

  // Mapear itens
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

  // Mapear filmes externos
  const filmesExternal = filterByRelevance(
    externalMovieResults.map(mapMovie),
    query,
    minRelevanceScore
  );

  // Mapear séries externas
  const enrichedExternalSeries = externalTvResults.map(enrichSeriesData);
  const seriesExternal = filterByRelevance(
    enrichedExternalSeries
      .filter((r: any) => !animeIdSet.has(String(r.id)))
      .map(mapSeries),
    query,
    minRelevanceScore
  );

  // Mapear animes
  const animes = filterByRelevance(
    externalAnimeResults.map(mapAnime),
    query,
    minRelevanceScore
  );

  // Mapear filmes locais
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

  // Flags de controle
  const preferLocal = !!searchParams.get('preferLocal');
  const externalOnly = !!searchParams.get('externalOnly');

  if (preferLocal) {
    if (externalFetchPromise) void externalFetchPromise;
    const external_url = `${new URL(request.url).origin}/api/pesquisa?query=${encodeURIComponent(query)}&externalOnly=1`;
    
    // ⭐ Deduplicate before returning
    const deduplicatedFilmes = deduplicateItems(filmesLocal);
    const deduplicatedSeries = deduplicateItems(seriesLocal);
    
    return NextResponse.json({
      filmes: deduplicatedFilmes,
      series: deduplicatedSeries,
      animes: [],
      total_filmes: deduplicatedFilmes.length,
      total_series: deduplicatedSeries.length,
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

    const filmesExternalFiltered = extMovieResults.filter((it: any) => {
      const id = String(it.id || '');
      return !(id && localIdSet.has(id));
    });

    const seriesExternalFiltered = extSeriesResults.filter((it: any) => {
      const id = String(it.id || '');
      return !(id && localIdSet.has(id));
    });

    // ⭐ Deduplicate
    const deduplicatedFilmes = deduplicateItems(filmesExternalFiltered);
    const deduplicatedSeries = deduplicateItems(seriesExternalFiltered);
    const deduplicatedAnimes = deduplicateItems(animes);

    return NextResponse.json({
      filmes: deduplicatedFilmes,
      series: deduplicatedSeries,
      animes: deduplicatedAnimes,
      total_filmes: deduplicatedFilmes.length,
      total_series: deduplicatedSeries.length,
      total_animes: deduplicatedAnimes.length,
      source: {
        external_count: externalResults.length,
        local_movies: filmesLocal.length,
        local_series: seriesLocal.length,
        filtered_against_local: true,
      },
    });
  }

  // Deduplicação principal
  const deduplicatedFilmesExternal = deduplicateItems(filmesExternal);
  const deduplicatedSeriesExternal = deduplicateItems(seriesExternal);
  const deduplicatedAnimes = deduplicateItems(animes);

  // Deduplicação local
  const deduplicatedFilmesLocal = deduplicateItems(filmesLocal);
  const deduplicatedSeriesLocal = deduplicateItems(seriesLocal);

  // Deduplicação entre local e externo (por ID)
  const localIdSet = new Set<string>([
    ...deduplicatedFilmesLocal.map((i: any) => String(i.id)),
    ...deduplicatedSeriesLocal.map((i: any) => String(i.id)),
  ].filter(Boolean));

  const filmesExternalFiltered = deduplicatedFilmesExternal.filter((it: any) => {
    const id = String(it.id || '');
    return !(id && localIdSet.has(id));
  });

  const seriesExternalFiltered = deduplicatedSeriesExternal.filter((it: any) => {
    const id = String(it.id || '');
    return !(id && localIdSet.has(id));
  });

  let filmes = [...deduplicatedFilmesLocal, ...filmesExternalFiltered];
  let series = [...deduplicatedSeriesLocal, ...seriesExternalFiltered];

  // Processar promise de fetch externo
  if (externalFetchPromise) {
    try {
      const externalData = await externalFetchPromise;
      
      const extFilmesMapped = filterByRelevance(
        externalData
          .filter((r: any) => r.media_type === 'movie' || r.tipo === 'filme')
          .map(mapMovie),
        query,
        minRelevanceScore
      );

      const extSeriesMapped = filterByRelevance(
        externalData
          .filter((r: any) => r.media_type === 'tv' || r.tipo === 'serie')
          .map(enrichSeriesData)
          .map(mapSeries),
        query,
        minRelevanceScore
      );

      // ⭐ Deduplicate before adding
      const deduplicatedExtFilmes = deduplicateItems(extFilmesMapped).filter((it: any) => {
        const id = String(it.id || '');
        return !(id && localIdSet.has(id));
      });

      const deduplicatedExtSeries = deduplicateItems(extSeriesMapped).filter((it: any) => {
        const id = String(it.id || '');
        return !(id && localIdSet.has(id));
      });

      filmes.push(...deduplicatedExtFilmes);
      series.push(...deduplicatedExtSeries);
    } catch (e) {
      // Falha ao obter externos
    }
  }

  // ⭐ Final deduplication of combined results
  filmes = deduplicateItems(filmes);
  series = deduplicateItems(series);

  return NextResponse.json({
    filmes,
    series,
    animes: deduplicatedAnimes,
    total_filmes: filmes.length,
    total_series: series.length,
    total_animes: deduplicatedAnimes.length,
    stats: {
      local_filmes: deduplicatedFilmesLocal.length,
      local_series: deduplicatedSeriesLocal.length,
      external_filmes: filmesExternalFiltered.length,
      external_series: seriesExternalFiltered.length,
    },
    search_config: {
      min_relevance_score: minRelevanceScore,
      query_normalized: normalize(query),
    },
  });
}