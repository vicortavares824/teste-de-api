export const runtime = 'nodejs';

import { NextResponse, NextRequest } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';
import { fetchDetails as tmdbFetchDetails } from '../../../../../lib/tmdb';

// ============================================================================
// CONSTANTS & TYPES
// ============================================================================

const DEFAULT_COUNT = 6;
const MAX_COUNT = 50;
const TMDB_API_KEY = process.env.TMDB_API_KEY || '60b55db2a598d09f914411a36840d1cb';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

type MediaType = 'movie' | 'tv';
type ContentType = 'series' | 'movies' | 'animes';

interface Category {
  title: string;
  slug: string;
  startIndex: number;
}

interface TMDBConfig {
  endpoint: string;
  params?: Record<string, string | number>;
}

interface CacheEntry {
  data: any;
  timestamp: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const TYPE_CONFIG: Record<ContentType, { file: string; mediaType: MediaType; tipo: string }> = {
  series: { file: 'series.json', mediaType: 'tv', tipo: 'serie' },
  movies: { file: 'filmes.json', mediaType: 'movie', tipo: 'filme' },
  animes: { file: 'animes.json', mediaType: 'tv', tipo: 'anime' },
};

const CATEGORIES_BY_TYPE: Record<ContentType, Category[]> = {
  series: [
    { title: 'Popular Series', slug: 'popSeries', startIndex: 0 },
    { title: 'Documentarios', slug: 'documentarios', startIndex: 2 },
    { title: 'Mistérios Series', slug: 'misterios', startIndex: 6 },
    { title: 'Classic Series', slug: 'classic', startIndex: 8 },
  ],
  movies: [
    { title: 'Filmes Populares', slug: 'popfilmes', startIndex: 0 },
    { title: 'Terror', slug: 'terror', startIndex: 4 },
    { title: 'Ação', slug: 'acao', startIndex: 6 },
    { title: 'Drama', slug: 'drama', startIndex: 2 },
    { title: 'Fantasia', slug: 'fantasia', startIndex: 8 },
    { title: 'Clássicos', slug: 'classicos', startIndex: 10 },
  ],
  animes: [
    { title: 'Animes Populares', slug: 'popanimes', startIndex: 0 },
    { title: 'Shounen', slug: 'shounen', startIndex: 4 },
    { title: 'Seinen', slug: 'seinen', startIndex: 2 },
    { title: 'Fantasia', slug: 'fantasia', startIndex: 6 },
    { title: 'Clássicos', slug: 'classicos', startIndex: 8 },
  ],
};

const TMDB_CATEGORY_MAP: Record<string, TMDBConfig> = {
  // Series
  popSeries: { endpoint: 'tv/popular' },
  documentarios: { endpoint: 'discover/tv', params: { with_genres: '99' } },
  misterios: { endpoint: 'discover/tv', params: { with_genres: '9648' } },
  classic: { endpoint: 'discover/tv', params: { sort_by: 'vote_average.desc', 'vote_count.gte': 1000 } },
  
  // Movies
  popfilmes: { endpoint: 'movie/popular' },
  terror: { endpoint: 'discover/movie', params: { with_genres: '27' } },
  acao: { endpoint: 'discover/movie', params: { with_genres: '28' } },
  drama: { endpoint: 'discover/movie', params: { with_genres: '18' } },
  fantasia: { endpoint: 'discover/movie', params: { with_genres: '14' } },
  classicos: { endpoint: 'discover/movie', params: { sort_by: 'vote_average.desc', 'vote_count.gte': 1000 } },
  
  // Animes
  popanimes: { endpoint: 'tv/popular' },
  shounen: { endpoint: 'discover/tv', params: { with_keywords: '210024' } },
  seinen: { endpoint: 'discover/tv', params: { with_keywords: '210025' } },
};

// ============================================================================
// CACHE
// ============================================================================

const cache = new Map<string, CacheEntry>();

const getCached = <T>(key: string): T | null => {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data as T;
  }
  return null;
};

const setCache = (key: string, data: any): void => {
  cache.set(key, { data, timestamp: Date.now() });
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const normalizeType = (type: string): ContentType | null => {
  const normalized = type.toLowerCase();
  if (normalized === 'series') return 'series';
  if (normalized === 'movies' || normalized === 'filmes') return 'movies';
  if (normalized === 'animes' || normalized === 'anime') return 'animes';
  return null;
};

const loadLocalData = async (file: string): Promise<any[]> => {
  const cacheKey = `local:${file}`;
  const cached = getCached<any[]>(cacheKey);
  if (cached) return cached;

  try {
    const filePath = path.resolve(process.cwd(), file);
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    const items: any[] = [];
    for (const page of data.pages || []) {
      items.push(...(page.results || []));
    }
    
    setCache(cacheKey, items);
    return items;
  } catch (error) {
    console.error(`[loadLocalData] Erro ao carregar ${file}:`, error);
    return [];
  }
};

const enrichWithTMDB = async (item: any, mediaType: MediaType) => {
  if (!item?.id) return item;

  try {
    const details = await tmdbFetchDetails(mediaType, item.id);
    if (!details) return item;

    return {
      ...item,
      tmdb: {
        poster_path: details.poster_path || item.poster_path || null,
        backdrop_path: details.backdrop_path || item.backdrop_path || null,
        overview: details.overview || item.overview || null,
        release_date: details.release_date || details.first_air_date || item.release_date || null,
        vote_average: details.vote_average ?? item.vote_average ?? null,
        genres: details.genres || null,
      },
    };
  } catch (error) {
    console.warn(`[enrichWithTMDB] Erro ao enriquecer item ${item.id}:`, error);
    return item;
  }
};

const fetchTMDBCategory = async (slug: string): Promise<any[] | null> => {
  const config = TMDB_CATEGORY_MAP[slug];
  if (!config || !TMDB_API_KEY) return null;

  const cacheKey = `tmdb:${slug}`;
  const cached = getCached<any[]>(cacheKey);
  if (cached) return cached;

  try {
    const url = new URL(`https://api.themoviedb.org/3/${config.endpoint}`);
    url.searchParams.set('api_key', TMDB_API_KEY);
    url.searchParams.set('language', 'pt-BR');
    url.searchParams.set('page', '1');

    if (config.params) {
      Object.entries(config.params).forEach(([key, value]) => {
        url.searchParams.set(key, String(value));
      });
    }

    const response = await fetch(url.toString());
    if (!response.ok) return null;

    const data = await response.json();
    const results = data.results || [];
    
    setCache(cacheKey, results);
    return results;
  } catch (error) {
    console.error(`[fetchTMDBCategory] Erro ao buscar categoria ${slug}:`, error);
    return null;
  }
};

const getGenreIdsFromTMDBConfig = (slug: string): number[] => {
  const config = TMDB_CATEGORY_MAP[slug];
  if (!config?.params?.with_genres) return [];
  
  const genres = String(config.params.with_genres);
  return genres.split(',').map(g => Number(g.trim())).filter(g => !isNaN(g));
};

const itemMatchesGenres = (item: any, genreIds: number[]): boolean => {
  if (!genreIds.length) return false;
  if (!item.genre_ids || !Array.isArray(item.genre_ids)) return false;
  
  return item.genre_ids.some((gid: number) => genreIds.includes(Number(gid)));
};

const fillWithLocalItems = (
  tmdbOrderedItems: any[],
  localData: any[],
  category: Category,
  slug: string,
  requestedCount: number
): any[] => {
  // Se já tem itens suficientes do TMDB, retorna-os (limitando ao solicitado)
  if (tmdbOrderedItems.length >= requestedCount) {
    // garante que os ids sejam numéricos e filtra falsy
    return tmdbOrderedItems
      .filter(Boolean)
      .filter(item => Number.isFinite(Number(item.id)))
      .slice(0, requestedCount);
  }

  // Start com os itens do TMDB (apenas com ids numéricos)
  const result: any[] = [];
  const addedIds = new Set<number>();

  for (const it of tmdbOrderedItems) {
    if (!it) continue;
    const nid = Number(it.id);
    if (!Number.isFinite(nid)) continue;
    if (addedIds.has(nid)) continue;
    result.push(it);
    addedIds.add(nid);
  }

  // Extrair genre_ids da configuração TMDB
  const targetGenres = getGenreIdsFromTMDBConfig(slug);

  // Filtrar itens locais que correspondem aos gêneros da categoria e que tenham id numérico
  const matchingItems = targetGenres.length > 0
    ? localData.filter(item => {
        const nid = Number(item?.id);
        return Number.isFinite(nid) && !addedIds.has(nid) && itemMatchesGenres(item, targetGenres);
      })
    : [];

  // Primeiro: adiciona itens que correspondem aos gêneros
  for (const item of matchingItems) {
    if (result.length >= requestedCount) break;
    const nid = Number(item.id);
    result.push(item);
    addedIds.add(nid);
  }

  // Se ainda não completou, adiciona itens do startIndex da categoria (apenas ids válidos)
  if (result.length < requestedCount) {
    const startIndex = Math.max(0, category.startIndex);
    const categoryItems = localData.slice(startIndex);
    
    for (const item of categoryItems) {
      if (result.length >= requestedCount) break;
      const nid = Number(item?.id);
      if (!Number.isFinite(nid) || addedIds.has(nid)) continue;
      result.push(item);
      addedIds.add(nid);
    }
  }

  // Por último: adiciona itens gerais se ainda faltar
  if (result.length < requestedCount) {
    for (const item of localData) {
      if (result.length >= requestedCount) break;
      const nid = Number(item?.id);
      if (!Number.isFinite(nid) || addedIds.has(nid)) continue;
      result.push(item);
      addedIds.add(nid);
    }
  }

  return result.slice(0, requestedCount);
};

const processCategoryItems = async (
  items: any[],
  mediaType: MediaType,
  tipo: string,
  shouldEnrich = true
): Promise<any[]> => {
  // Remove itens falsy antes de enrich
  const filtered = (items || []).filter(Boolean);

  // Enriquecer (se necessário)
  const processed = shouldEnrich
    ? await Promise.all(filtered.map(item => enrichWithTMDB(item, mediaType)))
    : filtered;

  // Normalizar: filtrar itens sem id numérico e deduplicar por id
  const seen = new Set<number>();
  const normalized: any[] = [];

  for (const item of processed) {
    if (!item) continue;
    const nid = Number(item?.id);
    if (!Number.isFinite(nid)) continue;
    if (seen.has(nid)) continue;
    seen.add(nid);
    normalized.push({ ...item, media_type: mediaType, tipo });
  }

  return normalized;
};

// ============================================================================
// MAIN HANDLERS
// ============================================================================

const handleSingleCategory = async (
  type: ContentType,
  slug: string,
  count: number,
  localData: any[]
): Promise<NextResponse> => {
  const categories = CATEGORIES_BY_TYPE[type];
  const category = categories.find(c => c.slug === slug);

  if (!category) {
    return NextResponse.json(
      { error: 'Categoria não encontrada', slug },
      { status: 404 }
    );
  }

  const { mediaType, tipo } = TYPE_CONFIG[type];

  // Tentar buscar do TMDB primeiro
  const tmdbResults = await fetchTMDBCategory(slug);
  
  if (tmdbResults && tmdbResults.length > 0) {
    const tmdbIds = new Set(tmdbResults.map(r => Number(r.id)));
    const filteredLocal = localData.filter(item => tmdbIds.has(Number(item.id)));
    
    // Manter ordem do TMDB e mapear para itens locais
    const orderedItems = tmdbResults
      .map(r => filteredLocal.find(f => Number(f.id) === Number(r.id)))
      .filter(Boolean);

    // Completar com itens locais se necessário (priorizando por gênero)
    const finalItems = fillWithLocalItems(orderedItems, localData, category, slug, count);
    const items = await processCategoryItems(finalItems, mediaType, tipo);

    if (items.length < count) {
      console.warn(`[api/categorias] Menos itens retornados para ${type}/${slug}: solicitado=${count}, retornado=${items.length}`);
    }

    return NextResponse.json({
      title: category.title,
      slug: category.slug,
      requestedCount: count,
      total: items.length,
      items,
    });
  }

  // Fallback para dados locais
  const start = Math.max(0, category.startIndex);
  const slicedItems = localData.slice(start, start + count);
  const items = await processCategoryItems(slicedItems, mediaType, tipo);

  if (items.length < count) {
    console.warn(`[api/categorias] Menos itens locais retornados para ${type}/${slug}: solicitado=${count}, retornado=${items.length}`);
  }

  return NextResponse.json({
    title: category.title,
    slug: category.slug,
    requestedCount: count,
    total: items.length,
    items,
  });
};

const handleAllCategories = async (
  type: ContentType,
  count: number,
  localData: any[]
): Promise<NextResponse> => {
  const categories = CATEGORIES_BY_TYPE[type];
  const { mediaType, tipo } = TYPE_CONFIG[type];

  const allCategories = await Promise.all(
    categories.map(async category => {
      const start = Math.max(0, category.startIndex);
      const slicedItems = localData.slice(start, start + count);
      const items = await processCategoryItems(slicedItems, mediaType, tipo);

      if (items.length < count) {
        console.warn(`[api/categorias] Menos itens locais para categoria ${category.slug}: solicitado=${count}, retornado=${items.length}`);
      }

      return {
        title: category.title,
        slug: category.slug,
        startIndex: category.startIndex,
        requestedCount: count,
        total: items.length,
        items,
      };
    })
  );

  return NextResponse.json({ categories: allCategories });
};

// ============================================================================
// MAIN ROUTE HANDLER
// ============================================================================

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ type: string; slug: string }> }
) {
  try {
    // No App Router, params vem como Promise
    const params = await context.params;
    const rawType = params?.type || '';
    const slug = params?.slug;

    console.log('[api/categorias] URL:', request.url, 'Params:', params);

    // Validação e normalização do tipo
    const type = normalizeType(rawType);
    if (!type) {
      return NextResponse.json(
        {
          error: 'Tipo inválido. Use: series, movies ou animes',
          receivedType: rawType || null,
        },
        { status: 400 }
      );
    }

    // Parse do count
    const { searchParams } = new URL(request.url);
    const countParam = Number(searchParams.get('count'));
    const count = Number.isFinite(countParam) && countParam > 0
      ? Math.min(MAX_COUNT, Math.floor(countParam))
      : DEFAULT_COUNT;

    // Carrega dados locais
    const { file } = TYPE_CONFIG[type];
    const localData = await loadLocalData(file);

    if (localData.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum dado disponível para este tipo', type },
        { status: 404 }
      );
    }

    // Processar requisição
    if (slug) {
      return handleSingleCategory(type, slug, count, localData);
    }

    return handleAllCategories(type, count, localData);
  } catch (error) {
    console.error('[api/categorias] Erro não tratado:', error);
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}