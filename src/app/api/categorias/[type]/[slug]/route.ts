export const runtime = 'edge';
import { NextResponse, NextRequest } from 'next/server';
import { fetchDetails as tmdbFetchDetails } from '../../../../../lib/tmdb';

// ============================================================================
// CONSTANTS & CONFIG
// ============================================================================

const GITHUB_BASE_URL = 'https://raw.githubusercontent.com/vicortavares824/teste-de-api/refs/heads/main';
const DEFAULT_COUNT = 6;
const MAX_COUNT = 50;
const TMDB_API_KEY = process.env.TMDB_API_KEY || '60b55db2a598d09f914411a36840d1cb';
const CACHE_TTL = 5 * 60 * 1000; 

type MediaType = 'movie' | 'tv';
type ContentType = 'series' | 'movies' | 'animes';

interface Category {
  title: string;
  slug: string;
  startIndex: number;
}

const TYPE_CONFIG: Record<ContentType, { file: string; mediaType: MediaType; tipo: string }> = {
  series: { file: 'series.json', mediaType: 'tv', tipo: 'serie' },
  movies: { file: 'filmes.json', mediaType: 'movie', tipo: 'filme' },
  animes: { file: 'animes.json', mediaType: 'tv', tipo: 'anime' },
};

const CATEGORY_DEFINITIONS: Record<ContentType, any[]> = {
  movies: [
    { slug: 'adrenalina_pura', title: 'Adrenalina Pura', genres: [28, 12] },
    { slug: 'quebrando_a_mente', title: 'Quebrando a Mente', genres: [878, 9648] },
    { slug: 'noites_de_tensao', title: 'Noites de Tensão', genres: [27, 9648] },
    { slug: 'mundos_fantasticos', title: 'Mundos Fantásticos', genres: [16, 12, 878] },
  ],
  series: [
    { slug: 'maratona_epica', title: 'Maratona Épica', genres: [10765, 10759] },
    { slug: 'misterios_viciantes', title: 'Mistérios Viciantes', genres: [9648] },
    { slug: 'anime_animacao_adulta', title: 'Anime e Animação Adulta', genres: [16] },
    { slug: 'terror_seriado', title: 'Terror Seriado', genres: [] },
  ],
  animes: [],
};

const CATEGORY_JSON_FILE: Record<string, string> = {
  adrenalina_pura: 'adrenalina_pura.json',
  quebrando_a_mente: 'quebrando_a_mente.json',
  noites_de_tensao: 'noites_de_tensao.json',
  mundos_fantasticos: 'mundos_fantasticos.json',
  maratona_epica: 'maratona_epica.json',
  misterios_viciantes: 'misterios_viciantes.json',
  anime_animacao_adulta: 'animacao_adulta.json',
  terror_seriado: 'terror_seriado.json',
};

const CATEGORIES_BY_TYPE: Record<ContentType, Category[]> = {
  series: (CATEGORY_DEFINITIONS.series || []).map(c => ({ title: c.title, slug: c.slug, startIndex: 0 })),
  movies: (CATEGORY_DEFINITIONS.movies || []).map(c => ({ title: c.title, slug: c.slug, startIndex: 0 })),
  animes: [],
};

// ============================================================================
// CACHE & FETCH DATA
// ============================================================================

const cache = new Map<string, { data: any; timestamp: number }>();

const getCached = <T>(key: string): T | null => {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) return entry.data as T;
  return null;
};

const loadLocalData = async (file: string): Promise<any[]> => {
  const cacheKey = `github:${file}`;
  const cached = getCached<any[]>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`${GITHUB_BASE_URL}/${file}`);
    if (!response.ok) throw new Error(`Status: ${response.status}`);
    
    const data = await response.json();
    let items: any[] = [];

    if (Array.isArray(data)) {
      items = data;
    } else if (data.results && Array.isArray(data.results)) {
      items = data.results;
    } else if (data.pages) {
      for (const page of data.pages) {
        if (page?.results) items.push(...page.results);
      }
    }

    cache.set(cacheKey, { data: items, timestamp: Date.now() });
    return items;
  } catch (error) {
    console.error(`[loadLocalData] Erro ao carregar ${file}:`, error);
    return [];
  }
};

// ============================================================================
// LÓGICA DE PROCESSAMENTO (RESUMIDA)
// ============================================================================

const normalizeType = (type: string): ContentType | null => {
  const n = type.toLowerCase();
  if (n === 'series') return 'series';
  if (n === 'movies' || n === 'filmes') return 'movies';
  if (n === 'animes' || n === 'anime') return 'animes';
  return null;
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
  } catch { return item; }
};

const fetchTMDBCategory = async (mediaType: MediaType, genres: number[] = [], page: number = 1) => {
  try {
    const endpoint = genres.length > 0 ? `discover/${mediaType}` : `${mediaType}/popular`;
    const url = new URL(`https://api.themoviedb.org/3/${endpoint}`);
    url.searchParams.set('api_key', TMDB_API_KEY);
    url.searchParams.set('language', 'pt-BR');
    url.searchParams.set('page', String(page));
    if (genres.length > 0) url.searchParams.set('with_genres', genres.join(','));

    const res = await fetch(url.toString());
    const data = await res.json();
    return data.results || [];
  } catch { return []; }
};

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ type: string; slug?: string }> }
) {
  try {
    const params = await context.params;
    const type = normalizeType(params.type || '');
    const slug = params.slug;

    if (!type) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const count = Math.min(MAX_COUNT, Number(searchParams.get('count')) || DEFAULT_COUNT);
    const page = Number(searchParams.get('page')) || 1;

    const { file, mediaType, tipo } = TYPE_CONFIG[type];
    const localData = await loadLocalData(file);

    if (slug) {
      const category = CATEGORIES_BY_TYPE[type].find(c => c.slug === slug);
      if (!category) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });

      // Se existir arquivo específico no GitHub para o slug
      const specificFile = CATEGORY_JSON_FILE[slug];
      let itemsRaw = [];
      
      if (specificFile) {
        itemsRaw = await loadLocalData(specificFile);
      } else {
        const def = (CATEGORY_DEFINITIONS as any)[type]?.find((c: any) => c.slug === slug);
        itemsRaw = await fetchTMDBCategory(mediaType, def?.genres || [], page);
      }

      const offset = (page - 1) * count;
      const sliced = itemsRaw.slice(offset, offset + count);
      const items = await Promise.all(sliced.map(it => enrichWithTMDB(it, mediaType)));

      return NextResponse.json({ title: category.title, slug, items });
    }

    // Lógica para All Categories simplificada
    const all = await Promise.all(CATEGORIES_BY_TYPE[type].map(async (cat) => {
        const sFile = CATEGORY_JSON_FILE[cat.slug];
        const raw = sFile ? await loadLocalData(sFile) : localData.slice(0, count);
        const processed = await Promise.all(raw.slice(0, count).map(it => enrichWithTMDB(it, mediaType)));
        return { ...cat, items: processed };
    }));

    return NextResponse.json({ categories: all });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}