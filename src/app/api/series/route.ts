
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

type ExternalListResp = {
  status?: string;
  page?: number;
  per_page?: number;
  total_series?: number;
  total_pages?: number;
  data?: Array<{ tmdb_id?: string; [k: string]: any }>;
  [k: string]: any;
};

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
    // prefer proxys.php path for tv pages (keep existing behavior) then wrap with proxy
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

  // If already in temporada_N shape, return those keys
  for (const k of Object.keys(detail || {})) {
    if (k.startsWith('temporada_')) {
      temporadas[k] = detail[k];
    }
  }
  if (Object.keys(temporadas).length > 0) return temporadas;

  // If there's a seasons array (TMDB-like), convert
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

  // If there's a flat episodes array with season/episode fields
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = 20; // fixed page size as requested

  // carregar todos os arquivos locais (fs)
  const loadLocal = async (): Promise<any[]> => {
    const files = ['series.json', 'series_part1.json', 'series_part2.json'];
    const all: any[] = [];
    for (const f of files) {
      try {
        const p = path.resolve(process.cwd(), f);
        const txt = await fs.readFile(p, { encoding: 'utf8' }).catch(() => null);
        if (!txt) continue;
        const parsed = JSON.parse(txt);
        if (Array.isArray(parsed)) all.push(...parsed);
        else if (parsed.results && Array.isArray(parsed.results)) all.push(...parsed.results);
      } catch (e) {
        continue;
      }
    }
    return all;
  };

  try {
    const all = await loadLocal();
    const totalResults = all.length;
    const totalPaginas = Math.max(1, Math.ceil(totalResults / limit));

    const start = (page - 1) * limit;
    const end = start + limit;
    const pageItems = all.slice(start, end);

    const mapped: any[] = [];
    for (const item of pageItems) {
      const detail = item.detail || item;

      const posterPathRaw = detail.imagem_capa || detail.poster_path || detail.poster || detail.poster_url || detail.image || item?.poster_url || item?.poster || '';
      const posterPath = extractImagePath(posterPathRaw);
      const posterUrl = buildImageUrl(posterPath, 'w500');

      const backdropPathRaw = detail.backdrop_path || detail.imagem_backdrop || detail.backdrop || item?.backdrop || item?.backdrop_url || '';
      const backdropPath = extractImagePath(backdropPathRaw);
      const backdropUrl = buildImageUrl(backdropPath, 'w1280');

      const temporadas = normalizeSeasons(detail);

      // montar temporadas_meta arrays se houver seasons/episodes com metadados
      const temporadas_meta_arrays: Record<string, Array<any>> = {};
      const pad = (n: number) => String(n).padStart(2, '0');
      const addEpisodeMeta = (seasonKey: string, epObj: any) => {
        if (!temporadas_meta_arrays[seasonKey]) temporadas_meta_arrays[seasonKey] = [];
        temporadas_meta_arrays[seasonKey].push(epObj);
      };

      if (Array.isArray(detail?.seasons) && detail.seasons.length > 0) {
        for (const s of detail.seasons) {
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
      } else if (Array.isArray(detail?.episodes) && detail.episodes.length > 0) {
        for (const ep of detail.episodes) {
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

      const mappedObj: any = {
        id: Number(item?.tmdb_id || item?.tmdb || item?.id || item?.series_id || item?.id_tmdb || 0),
        name: detail.nome || detail.title || detail.name || item?.name || item?.title || '',
        original_name: detail.original_name || detail.original_title || '',
        first_air_date: detail.first_air_date || detail.ano || '',
        genre_ids: Array.isArray(detail.genre_ids) ? detail.genre_ids.map((g: any) => (g && typeof g === 'object' && g.name ? String(g.name) : String(g))) : (detail.generos ? String(detail.generos).split(',').map((g: string) => g.trim()) : []),
        original_language: detail.original_language || 'pt',
        poster_path: posterUrl || '',
        backdrop_path: backdropUrl || '',
        ...temporadas,
      };

      for (const k of Object.keys(temporadas_meta_arrays)) mappedObj[k] = temporadas_meta_arrays[k];

      mapped.push(mappedObj);
    }

    return NextResponse.json({
      page,
      totalPaginas,
      totalResults,
      results: mapped,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro desconhecido' }, { status: 500 });
  }
}
