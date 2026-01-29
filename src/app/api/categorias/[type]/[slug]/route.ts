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

// As 8 categorias solicitadas (4 filmes + 4 series)
const CATEGORY_DEFINITIONS: Record<ContentType, Array<{
  slug: string;
  title: string;
  genres: number[];
  vote_average_gte?: number;
  vote_count_gte?: number;
}>> = {
  movies: [
    { slug: 'adrenalina_pura', title: 'Adrenalina Pura', genres: [28, 12], vote_average_gte: 0, vote_count_gte: 0 },
    { slug: 'quebrando_a_mente', title: 'Quebrando a Mente', genres: [878, 9648], vote_average_gte: 0, vote_count_gte: 0 },
    { slug: 'noites_de_tensao', title: 'Noites de Tensão', genres: [27, 9648], vote_average_gte: 0, vote_count_gte: 0 },
    { slug: 'mundos_fantasticos', title: 'Mundos Fantásticos', genres: [16, 12, 878], vote_average_gte: 0, vote_count_gte: 0 },
  ],
  series: [
    { slug: 'maratona_epica', title: 'Maratona Épica', genres: [10765, 10759], vote_average_gte: 0, vote_count_gte: 0 },
    { slug: 'misterios_viciantes', title: 'Mistérios Viciantes', genres: [9648], vote_average_gte: 0, vote_count_gte: 0 },
    { slug: 'anime_animacao_adulta', title: 'Anime e Animação Adulta', genres: [16], vote_average_gte: 0, vote_count_gte: 0 },
    { slug: 'terror_seriado', title: 'Terror Seriado', genres: [], vote_average_gte: 0, vote_count_gte: 0 },
  ],
  animes: [],
};

// Map de slug -> arquivo JSON específico (quando existir um arquivo com itens dessa categoria)
const CATEGORY_JSON_FILE: Record<string, string> = {
  // filmes
  adrenalina_pura: 'adrenalina_pura.json',
  quebrando_a_mente: 'quebrando_a_mente.json',
  noites_de_tensao: 'noites_de_tensao.json',
  mundos_fantasticos: 'mundos_fantasticos.json',
  // series
  maratona_epica: 'maratona_epica.json',
  misterios_viciantes: 'misterios_viciantes.json',
  anime_animacao_adulta: 'animacao_adulta.json',
  terror_seriado: 'terror_seriado.json',
};

const CATEGORIES_BY_TYPE: Record<ContentType, Category[]> = {
  series: (CATEGORY_DEFINITIONS.series || []).map((c, i) => ({ title: c.title, slug: c.slug, startIndex: 0 })),
  movies: (CATEGORY_DEFINITIONS.movies || []).map((c, i) => ({ title: c.title, slug: c.slug, startIndex: 0 })),
  animes: [],
};

// Mantemos um map mínimo — a maior parte das categorias vem de CATEGORY_DEFINITIONS
const TMDB_CATEGORY_MAP: Record<string, TMDBConfig> = {
  // entradas de exemplo / fallback
  pop: { endpoint: 'popular' },
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

    // Suporta três formatos comuns:
    // 1) Array direto (ex: [...])
    // 2) Objeto com `results: []` (ex: { results: [...] })
    // 3) Objeto com `pages: [ { results: [...] }, ... ]`
    if (Array.isArray(data)) {
      setCache(cacheKey, data);
      return data;
    }

    if (data.results && Array.isArray(data.results)) {
      setCache(cacheKey, data.results);
      return data.results;
    }

    const items: any[] = [];
    for (const page of data.pages || []) {
      if (page && Array.isArray(page.results)) items.push(...page.results);
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

const fetchTMDBCategory = async (slug: string, mediaType: MediaType, genres: number[] = [], page: number = 1): Promise<any[] | null> => {
  if (!TMDB_API_KEY) return null;

  const cacheKey = `tmdb:${mediaType}:${slug}:${genres.join(',')}:page:${page}`;
  const cached = getCached<any[]>(cacheKey);
  if (cached) return cached;

  try {
    // Se temos gêneros, usamos discover; caso contrário, usamos endpoint /{mediaType}/popular
    let endpoint = '';
    const params: Record<string, string | number> = {};

    if (genres && genres.length > 0) {
      endpoint = `discover/${mediaType}`;
      params.with_genres = genres.join(',');
      params.sort_by = 'popularity.desc';
    } else {
      endpoint = `${mediaType}/popular`;
    }

    const url = new URL(`https://api.themoviedb.org/3/${endpoint}`);
    url.searchParams.set('api_key', TMDB_API_KEY);
    url.searchParams.set('language', 'pt-BR');
  url.searchParams.set('page', String(page));

    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));

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

const getGenreIdsFromTMDBConfig = (slug: string, type: ContentType): number[] => {
  // Primeiro tenta ler da definição de categoria fornecida
  const def = (CATEGORY_DEFINITIONS as any)[type]?.find((c: any) => c.slug === slug);
  if (def && Array.isArray(def.genres) && def.genres.length > 0) return def.genres.map(Number).filter(n => !isNaN(n));

  // Fallback para configurações estáticas
  const config = TMDB_CATEGORY_MAP[slug];
  if (!config?.params?.with_genres) return [];
  const genres = String(config.params.with_genres);
  return genres.split(',').map(g => Number(g.trim())).filter(g => !isNaN(g));
};

const itemMatchesGenres = (item: any, genreIds: number[]): boolean => {
  if (!genreIds.length) return false;
  // TMDB pode expor 'genre_ids' (lista de ids) ou 'genres' (lista de objetos)
  if (Array.isArray(item.genre_ids)) return item.genre_ids.some((gid: number) => genreIds.includes(Number(gid)));
  if (Array.isArray(item.genres)) return item.genres.some((g: any) => genreIds.includes(Number(g?.id)));
  return false;
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

  // Extrair genre_ids da definição de categoria
  // tentaremos inferir type a partir do category encontrado
  const inferredType: ContentType = (category && CATEGORY_DEFINITIONS.movies.find(c => c.slug === slug)) ? 'movies' : 'series';
  const targetGenres = getGenreIdsFromTMDBConfig(slug, inferredType);

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
  localData: any[],
  page: number = 1
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
  // Priorizar arquivo JSON específico se existir
  const jsonFile = CATEGORY_JSON_FILE[slug];
  if (jsonFile) {
    const loaded = await loadLocalData(jsonFile).catch(() => []);
    const offset = Math.max(0, (page - 1) * count);
    const sliced = (Array.isArray(loaded) ? loaded.slice(offset, offset + count) : []);
    const items = await processCategoryItems(sliced, mediaType, tipo);

    return NextResponse.json({
      title: category.title,
      slug: category.slug,
      requestedCount: count,
      page,
      total: items.length,
      items,
    });
  }

  // Tentar buscar do TMDB (usando gêneros da definição, quando houver)
  const def = (CATEGORY_DEFINITIONS as any)[type]?.find((c: any) => c.slug === slug);
  const genres = def && Array.isArray(def.genres) ? def.genres : [];
  const tmdbResults = await fetchTMDBCategory(slug, mediaType, genres as number[], page);

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
      page,
      total: items.length,
      items,
    });
  }

  // Fallback para dados locais
  const offset = Math.max(0, (page - 1) * count);
  const slicedItems = localData.slice(offset, offset + count);
  const items = await processCategoryItems(slicedItems, mediaType, tipo);

  if (items.length < count) {
    console.warn(`[api/categorias] Menos itens locais retornados para ${type}/${slug}: solicitado=${count}, retornado=${items.length}`);
  }

  return NextResponse.json({
    title: category.title,
    slug: category.slug,
    requestedCount: count,
    page,
    total: items.length,
    items,
  });
};

const handleAllCategories = async (
  type: ContentType,
  count: number,
  localData: any[],
  page: number = 1
): Promise<NextResponse> => {
  const categories = CATEGORIES_BY_TYPE[type];
  const { mediaType, tipo } = TYPE_CONFIG[type];

  const allCategories = await Promise.all(
    categories.map(async category => {
      // Tentar carregar arquivo JSON específico para a categoria
      const jsonFile = CATEGORY_JSON_FILE[category.slug];
      let sourceItems: any[] = [];

      if (jsonFile) {
        const loaded = await loadLocalData(jsonFile).catch(() => []);
        if (Array.isArray(loaded) && loaded.length > 0) {
          const offset = Math.max(0, (page - 1) * count);
          sourceItems = loaded.slice(offset, offset + count);
        }
      }

      // Se não há arquivo específico, tentar TMDB discover com géneros da definição
      if (sourceItems.length === 0) {
        const def = (CATEGORY_DEFINITIONS as any)[type]?.find((c: any) => c.slug === category.slug);
        const genres = def && Array.isArray(def.genres) ? def.genres : [];
  const tmdbResults = await fetchTMDBCategory(category.slug, mediaType, genres as number[], page);

        if (tmdbResults && tmdbResults.length > 0) {
          // mapear para itens locais quando possível
          const tmdbIds = new Set(tmdbResults.map((r: any) => Number(r.id)));
          const filteredLocal = localData.filter(item => tmdbIds.has(Number(item.id)));
          const orderedItems = tmdbResults
            .map((r: any) => filteredLocal.find((f: any) => Number(f.id) === Number(r.id)))
            .filter(Boolean);
          sourceItems = fillWithLocalItems(orderedItems, localData, category, category.slug, count);
        }
      }

      // Fallback: usar slice local
      if (sourceItems.length === 0) {
        const offset = Math.max(0, (page - 1) * count);
        sourceItems = localData.slice(offset, offset + count);
      }

      const items = await processCategoryItems(sourceItems, mediaType, tipo);

      if (items.length < count) {
        console.warn(`[api/categorias] Menos itens locais para categoria ${category.slug}: solicitado=${count}, retornado=${items.length}`);
      }

      return {
        title: category.title,
        slug: category.slug,
        startIndex: category.startIndex,
        requestedCount: count,
        page,
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
  const pageParam = Number(searchParams.get('page'));
    const count = Number.isFinite(countParam) && countParam > 0
      ? Math.min(MAX_COUNT, Math.floor(countParam))
      : DEFAULT_COUNT;
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;

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
      return handleSingleCategory(type, slug, count, localData, page);
    }

    return handleAllCategories(type, count, localData, page);
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