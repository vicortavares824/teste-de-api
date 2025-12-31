import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';
import { fetchDetails as tmdbFetchDetails } from '../../../../../lib/tmdb';

const DEFAULT_COUNT = 6;
const TMDB_API_KEY = process.env.TMDB_API_KEY || '60b55db2a598d09f914411a36840d1cb';
const categoriesByType = {
  series: [
    { title: 'Popular Series', slug: 'popSeries', startIndex: 0 },
    // { title: 'Terror Series', slug: 'terror', startIndex: 4 }, // Não existe terror para séries na TMDB
    { title: 'Documentarios', slug: 'documentarios', startIndex: 2 },
    { title: 'Mistérios Series', slug: 'misterios', startIndex: 6 },
    { title: 'Classic Series', slug: 'classic', startIndex: 8 },
  ],
  movies: [
    { title: 'Filmes Populares', slug: 'popfilmes', startIndex: 0 },
    { title: 'Terror', slug: 'terror', startIndex: 4 }, // Terror só em filmes
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

const loadLocalFlat = async (file: string) => {
  try {
    const p = path.resolve(process.cwd(), file);
    const str = await fs.readFile(p, 'utf-8');
    const data = JSON.parse(str);
    const items: any[] = [];
    for (const page of data.pages || []) {
      for (const r of page.results || []) items.push(r);
    }
    return items;
  } catch {
    return [];
  }
};

const enrichWithTmdb = async (item: any, media_type: 'movie' | 'tv') => {
  if (!item || !item.id) return item;
  try {
    const data = await tmdbFetchDetails(media_type as any, item.id);
    if (!data) return item;
    return {
      ...item,
      tmdb: {
        poster_path: data.poster_path || item.poster_path || null,
        backdrop_path: data.backdrop_path || item.backdrop_path || null,
        overview: data.overview || item.overview || null,
        release_date: data.release_date || data.first_air_date || item.release_date || null,
        vote_average: data.vote_average ?? item.vote_average ?? null,
        genres: data.genres || null,
      },
    };
  } catch (e) {
    return item;
  }
};

export async function GET(
  request: Request,
  context: { params?: { type?: string; slug?: string } }
) {
  // params pode ser uma Promise no App Router; aguarda para desempacotar
  const params = (context && (await (context as any).params)) || {};
  const type = params?.type || '';
  const slug = params?.slug;
  console.log('[api/categorias] request.url=', request.url, 'params=', params);
  const { searchParams } = new URL(request.url);
  const countParam = Number(searchParams.get('count') || '');
  const count = Number.isFinite(countParam) && countParam > 0 ? Math.min(50, Math.floor(countParam)) : DEFAULT_COUNT;

  let file = '';
  if (type === 'series') file = 'series.json';
  else if (type === 'movies' || type === 'filmes') file = 'filmes.json';
  else if (type === 'animes' || type === 'anime') file = 'animes.json';
  else {
    console.warn('[api/categorias] tipo inválido recebido:', type, 'params=', params);
    return NextResponse.json({ error: 'Tipo inválido. use series|movies|animes', receivedType: type || null, params }, { status: 400 });
  }

  const list = await loadLocalFlat(file);
  const cats = (categoriesByType as any)[type] || [];

  // se slug existir, retorna só essa categoria; senão retorna todas
  if (slug) {
    const cat = cats.find((c: any) => c.slug === slug);
    if (!cat) return NextResponse.json({ error: 'Categoria não encontrada', slug }, { status: 404 });
    const start = Math.max(0, cat.startIndex || 0);
    // fluxo especial: se for categoria de populares e TMDB disponível, buscar /tv/popular e cruzar com local
    const media_type = type === 'movies' ? 'movie' : 'tv';
    const tipo = type === 'movies' ? 'filme' : type === 'animes' ? 'anime' : 'serie';

    // Mapeamento de slug para busca TMDB
    const tmdbMap: Record<string, { endpoint: string, params?: Record<string, string|number> }> = {
      // Séries
      popSeries: { endpoint: 'tv/popular' },
      documentarios: { endpoint: 'discover/tv', params: { with_genres: '99' } },
      misterios: { endpoint: 'discover/tv', params: { with_genres: '9648' } },
      classic: { endpoint: 'discover/tv', params: { sort_by: 'vote_average.desc', 'vote_count.gte': 1000 } },
      // Filmes
      popfilmes: { endpoint: 'movie/popular' },
      terror: { endpoint: 'discover/movie', params: { with_genres: '27' } }, // Terror só em filmes
      acao: { endpoint: 'discover/movie', params: { with_genres: '28' } },
      drama: { endpoint: 'discover/movie', params: { with_genres: '18' } },
      fantasia: { endpoint: 'discover/movie', params: { with_genres: '14' } },
      classicos: { endpoint: 'discover/movie', params: { sort_by: 'vote_average.desc', 'vote_count.gte': 1000 } },
      // Animes (usando discover/tv com gênero animação ou palavra-chave anime)
      popanimes: { endpoint: 'tv/popular' },
      shounen: { endpoint: 'discover/tv', params: { with_keywords: '210024' } }, // Exemplo: palavra-chave shounen
      seinen: { endpoint: 'discover/tv', params: { with_keywords: '210025' } }, // Exemplo: palavra-chave seinen
      // fantasia e classicos já mapeados acima
    };

    const tmdbConfig = tmdbMap[slug];
    if (tmdbConfig) {
      try {
        const url = new URL(`https://api.themoviedb.org/3/${tmdbConfig.endpoint}`);
        url.searchParams.set('api_key', TMDB_API_KEY || '');
        url.searchParams.set('language', 'pt-BR');
        url.searchParams.set('page', '1');
        if (tmdbConfig.params) {
          for (const [k, v] of Object.entries(tmdbConfig.params)) {
            url.searchParams.set(k, String(v));
          }
        }
        const tmdbRes = await fetch(url.toString());
        if (tmdbRes && tmdbRes.ok) {
          const tmdbJson = await tmdbRes.json();
          const tmdbIds = new Set((tmdbJson.results || []).map((r: any) => Number(r.id)));
          // filtra somente os items locais que existem na lista do TMDB
          const filteredLocal = list.filter((it: any) => tmdbIds.has(Number(it.id)));
          // manter ordem de aparição do TMDB
          const ordered = (tmdbJson.results || []).map((r: any) => filteredLocal.find((f: any) => Number(f.id) === Number(r.id))).filter(Boolean).slice(0, count);
          const items = await Promise.all(ordered.map(async (it: any) => {
            const enriched = await enrichWithTmdb(it, media_type as any);
            return { ...enriched, media_type, tipo };
          }));
          return NextResponse.json({ title: cat.title, slug: cat.slug, total: items.length, items });
        }
      } catch (e) {
        console.warn('[api/categorias] erro ao buscar TMDB para slug', slug, e);
      }
      // se falhar com TMDB, cair para o fluxo local padrão abaixo
    }

    const sliced = list.slice(start, start + count);
    const items = await Promise.all(sliced.map(async (it: any) => {
      const enriched = await enrichWithTmdb(it, media_type as any);
      return { ...enriched, media_type, tipo };
    }));
    return NextResponse.json({ title: cat.title, slug: cat.slug, total: items.length, items });
  }

  // retorna todas categorias do tipo
  const media_type = type === 'movies' ? 'movie' : 'tv';
  const tipo = type === 'movies' ? 'filme' : type === 'animes' ? 'anime' : 'serie';
  const all = await Promise.all(cats.map(async (c: any) => {
    const start = Math.max(0, c.startIndex || 0);
    const sliced = list.slice(start, start + count);
    const items = await Promise.all(sliced.map(async (it: any) => {
      const enriched = await enrichWithTmdb(it, media_type as any);
      return { ...enriched, media_type, tipo };
    }));
    return { title: c.title, slug: c.slug, startIndex: c.startIndex, total: items.length, items };
  }));

  return NextResponse.json({ categories: all });
}
