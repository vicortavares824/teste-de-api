import { NextResponse } from 'next/server';
import { fetchDetails as fetchTmdbDetails } from '../../../../lib/tmdb';
import { getCache, setCache } from '../../../../lib/cache';
import fs from 'fs/promises';
import path from 'path';

const EXTERNAL_BASE = 'https://roxanoplay.bb-bet.top/api';

const extractImagePath = (img: string | undefined) => {
  if (!img) return '';
  try {
    const u = new URL(img);
    return u.pathname.startsWith('/') ? u.pathname : `/${u.pathname}`;
  } catch (e) {
    if (!img) return '';
    return img.startsWith('/') ? img : `/${img}`;
  }
};

const buildImageUrl = (path: string, size: 'w500' | 'w1280' | string = 'w500') => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
};

function transformEpisodeUrl(originalUrl: string | undefined) {
  if (!originalUrl) return originalUrl || '';
  const PROXY_BASE = 'https://cinestream-kappa.vercel.app/api/proxy?url=';
  try {
    if (originalUrl.startsWith(PROXY_BASE) || originalUrl.includes('/api/proxy?url=')) return originalUrl;
    const modified = String(originalUrl).replace('/pages/tv.php?id=', '/pages/proxys.php?id=');
    return PROXY_BASE + encodeURIComponent(modified);
  } catch (e) {
    try {
      const fallback = String(originalUrl).replace('/pages/tv.php?id=', '/pages/proxys.php?id=');
      return PROXY_BASE + encodeURIComponent(fallback);
    } catch (inner) {
      return originalUrl || '';
    }
  }
}

function normalizeSeasons(detail: any): Record<string, Record<string, string>> {
  const temporadas: Record<string, Record<string, string>> = {};

  for (const k of Object.keys(detail || {})) {
    if (k.startsWith('temporada_')) {
      temporadas[k] = detail[k];
    }
  }
  if (Object.keys(temporadas).length > 0) return temporadas;

  if (Array.isArray(detail?.seasons) && detail.seasons.length > 0) {
    for (const s of detail.seasons) {
      const seasonNum = s.season_number ?? s.season ?? s.number ?? s.numero_temporada ?? '';
      if (!seasonNum && s.episodes == null) continue;
      const key = `temporada_${String(seasonNum)}`;
      temporadas[key] = {};
      if (Array.isArray(s.episodes)) {
        for (const ep of s.episodes) {
          const epNum = ep.episode_number ?? ep.number ?? ep.episodio ?? ep.ep ?? 1;
          const epKey = `eps_${String(epNum).padStart(2, '0')}`;
          const url = ep.file || ep.url || ep.video || ep.link || ep.source || '';
          temporadas[key][epKey] = url;
        }
      }
    }
    if (Object.keys(temporadas).length > 0) return temporadas;
  }

  if (Array.isArray(detail?.episodes) && detail.episodes.length > 0) {
    for (const ep of detail.episodes) {
      const seasonNum = ep.numero_temporada ?? ep.temporada ?? ep.season ?? ep.season_number ?? 1;
      const epNum = ep.episodio_numero ?? ep.episodio ?? ep.episode ?? ep.episode_number ?? ep.number ?? 1;
      const keySeason = `temporada_${seasonNum}`;
      if (!temporadas[keySeason]) temporadas[keySeason] = {};
      const epKey = `eps_${String(epNum).padStart(2, '0')}`;
      const url = ep.url || ep.file || ep.link || ep.video || ep.source || '';
      temporadas[keySeason][epKey] = url;
    }
    return temporadas;
  }

  return {};
}

export async function GET(request: Request, { params }: { params: Promise<Record<string, string>> }) {
  const resolvedParams = await params;
  const id = resolvedParams?.id || '';
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });

  // Carregar dados de séries a partir dos JSONs locais em vez de chamadas externas
  const loadLocalSeries = async (): Promise<any[]> => {
    const candidates = ['series.json', 'series_part1.json', 'series_part2.json'];
    const all: any[] = [];
    for (const fileName of candidates) {
      try {
        const filePath = path.resolve(process.cwd(), fileName);
        const content = await fs.readFile(filePath, { encoding: 'utf8' }).catch(() => null);
        if (!content) continue;
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          all.push(...parsed);
        } else if (parsed.results && Array.isArray(parsed.results)) {
          all.push(...parsed.results);
        }
      } catch (e) {
        // ignore missing or parse errors for each file
        continue;
      }
    }
    return all;
  };

  try {
    const cacheKey = `series:${id}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const allSeries = await loadLocalSeries();
    // localizar a série pelo tmdb id ou variações
    const seriesItem = allSeries.find((it: any) => {
      const candidates = [it?.id, it?.tmdb_id, it?.tmdb, it?.series_id, it?.tmdbId, it?.id_tmdb];
      return candidates.some((c: any) => String(c) === String(id));
    });

    if (!seriesItem) {
      return NextResponse.json({ error: 'Série não encontrada localmente' }, { status: 404 });
    }

  // detail pode estar embutido ou o próprio item já conter temporadas/episodes
  const seriesDetail: any = seriesItem.detail || seriesItem;
  const temporadas = normalizeSeasons(seriesDetail);

    // Build season metadata arrays (numero, titulo, sinopse, thumb, url)
    const temporadas_meta_arrays: Record<string, Array<any>> = {};
    const pad = (n: number) => String(n).padStart(2, '0');
    const addEpisodeMeta = (seasonKey: string, epObj: any) => {
      if (!temporadas_meta_arrays[seasonKey]) temporadas_meta_arrays[seasonKey] = [];
      temporadas_meta_arrays[seasonKey].push(epObj);
    };

    if (Array.isArray(seriesDetail?.seasons) && seriesDetail.seasons.length > 0) {
      for (const s of seriesDetail.seasons) {
        const seasonNum = s.season_number ?? s.season ?? s.number ?? s.numero_temporada ?? 1;
        const seasonKey = `temporada_${seasonNum}`;
        if (!Array.isArray(s.episodes)) continue;
        for (const ep of s.episodes) {
          const epNum = ep.episode_number ?? ep.number ?? ep.episodio ?? ep.ep ?? 1;
          const epKey = `eps_${pad(Number(epNum))}`;
          const rawUrl = String(ep.file || ep.url || ep.video || ep.link || ep.source || '');
          const proxied = transformEpisodeUrl(rawUrl);
          const banner = ep.episode_banner || ep.still_path || ep.still || '';
          const thumb = banner ? (banner.startsWith('http') ? (banner.includes('/image.tmdb.org/t/p/') ? banner.replace(/\/t\/p\/[^/]+\//, '/t/p/original/') : banner) : buildImageUrl(extractImagePath(String(banner)), 'original')) : '';
          addEpisodeMeta(seasonKey, {
            numero: Number(epNum),
            titulo: ep.titulo || ep.title || ep.name || '',
            sinopse_eps: ep.sinopse || ep.overview || ep.description || '',
            thumb,
            [epKey]: proxied,
          });
        }
      }
    } else if (Array.isArray(seriesDetail?.episodes) && seriesDetail.episodes.length > 0) {
      for (const ep of seriesDetail.episodes) {
        const seasonNum = ep.numero_temporada ?? ep.temporada ?? ep.season ?? ep.season_number ?? 1;
        const epNum = ep.episodio_numero ?? ep.episodio ?? ep.episode ?? ep.episode_number ?? ep.number ?? 1;
        const seasonKey = `temporada_${seasonNum}`;
        const epKey = `eps_${pad(Number(epNum))}`;
        const rawUrl = String(ep.url || ep.file || ep.link || ep.video || ep.source || '');
        const proxied = transformEpisodeUrl(rawUrl);
        const banner = ep.episode_banner || ep.still_path || ep.still || '';
        const thumb = banner ? (banner.startsWith('http') ? (banner.includes('/image.tmdb.org/t/p/') ? banner.replace(/\/t\/p\/[^/]+\//, '/t/p/original/') : banner) : buildImageUrl(extractImagePath(String(banner)), 'original')) : '';
        addEpisodeMeta(seasonKey, {
          numero: Number(epNum),
          titulo: ep.titulo || ep.title || ep.name || '',
          sinopse_eps: ep.sinopse || ep.overview || ep.description || '',
          thumb,
          [epKey]: proxied,
        });
      }
    }

    // Fetch TMDB details to enrich metadata when possible
    let name = '';
    let poster_path = '';
    let backdrop_path = '';
    try {
      const tmdbData = await fetchTmdbDetails('tv', String(id));
      if (tmdbData) {
        name = tmdbData.name || tmdbData.title || '';
        poster_path = tmdbData.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}` : '';
        backdrop_path = tmdbData.backdrop_path ? `https://image.tmdb.org/t/p/w1280${tmdbData.backdrop_path}` : '';
      }
    } catch (e) {
      // ignore
    }

    // calcular total de episódios: prefira temporadas_meta_arrays quando disponível
    let totalEpisodes = 0;
    if (Object.keys(temporadas_meta_arrays).length > 0) {
      for (const k of Object.keys(temporadas_meta_arrays)) {
        totalEpisodes += temporadas_meta_arrays[k].length;
      }
    } else if (Object.keys(temporadas).length > 0) {
      for (const k of Object.keys(temporadas)) {
        const epsObj = temporadas[k] as Record<string, any>;
        totalEpisodes += Object.keys(epsObj || {}).length;
      }
    }

    const responseObj: any = {
      id: Number(id),
      name,
      poster_path,
      backdrop_path,
      temporadas: Object.keys(temporadas).length ? temporadas : undefined,
      temporadas_meta: Object.keys(temporadas_meta_arrays).length ? temporadas_meta_arrays : undefined,
      totalEpisodes,
    };

    // cache-aside: popular cache com TTL de 1 hora
    try {
      await setCache(cacheKey, responseObj, 3600);
    } catch (e) {
      // ignore cache failures
    }

    return NextResponse.json(responseObj);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro desconhecido' }, { status: 500 });
  }
}
