
import { NextResponse } from 'next/server';
import { fetchDetails as fetchTmdbDetails } from '../../../lib/tmdb';

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
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  const listUrl = `${EXTERNAL_BASE}/get_all_series.php?page=${page}&limit=${limit}`;

  try {
    const listRes = await fetch(listUrl);
    if (!listRes.ok) {
      const bodyText = await listRes.text().catch(() => '');
      return NextResponse.json({ error: 'Erro ao buscar lista externa', status: listRes.status, body: bodyText }, { status: 502 });
    }

    const listData: ExternalListResp = await listRes.json();
    const items = Array.isArray(listData.data) ? listData.data : [];

    // Fetch details in parallel (be mindful of rate limits).
    // The external API uses 'page' as season number. We'll iterate pages starting at 1 and stop when a page has no episodes.
    const MAX_SEASONS = 40;
    const detailPromises = items.map(async (it) => {
      const tmdb = it.tmdb_id || it.tmdb || it.id || it.series_id || '';
      if (!tmdb) return null;
      try {
        let episodes: any[] = [];
        for (let p = 1; p <= MAX_SEASONS; p++) {
          const url = `${EXTERNAL_BASE}/series.php?tmdb_id=${encodeURIComponent(tmdb)}&page=${p}&limit=200`;
          const r = await fetch(url).catch(() => null);
          if (!r || !r.ok) break;
          const pd = await r.json().catch(() => null);
          if (!pd) break;
          const pageDetail = pd.data && Array.isArray(pd.data) && pd.data.length > 0 ? pd.data[0] : pd;
          const pageEpisodes = Array.isArray(pageDetail.episodes) ? pageDetail.episodes : [];
          if (!pageEpisodes.length) {
            // no episodes on this page -> consider end
            if (p === 1) {
              // first page has no episodes: nothing to aggregate
            }
            break;
          }

          // collect and proxify URLs
          for (const ep of pageEpisodes) {
            const urlEp = String(ep.url || ep.file || '');
            const proxied = transformEpisodeUrl(urlEp);
            episodes.push({ ...ep, url: proxied });
          }
        }

        const finalDetail = { episodes };
        return { tmdb, detail: finalDetail, item: it };
      } catch (e) {
        return null;
      }
    });

    const detailsResults = await Promise.all(detailPromises);

    const mapped = [] as any[];
    for (const res of detailsResults) {
      if (!res) continue;
      const { tmdb, detail, item } = res as any;

  const posterPathRaw = detail.imagem_capa || detail.poster_path || detail.poster || detail.poster_url || detail.image || item?.poster_url || item?.poster || '';
      const posterPath = extractImagePath(posterPathRaw);
      const posterUrl = buildImageUrl(posterPath, 'w500');

  const backdropPathRaw = detail.backdrop_path || detail.imagem_backdrop || detail.backdrop || item?.backdrop || item?.backdrop_url || '';
      const backdropPath = extractImagePath(backdropPathRaw);
      const backdropUrl = buildImageUrl(backdropPath, 'w1280');

      const temporadas = normalizeSeasons(detail);

      // Montar arrays por temporada com metadados (numero, titulo, sinopse_eps, thumb, eps_xx)
      const temporadas_meta_arrays: Record<string, Array<any>> = {};
      const pad = (n: number) => String(n).padStart(2, '0');
      const addEpisodeMeta = (seasonKey: string, epObj: any) => {
        if (!temporadas_meta_arrays[seasonKey]) temporadas_meta_arrays[seasonKey] = [];
        temporadas_meta_arrays[seasonKey].push(epObj);
      };

      // Se detail.seasons estiver presente (formato TMDB-like)
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
      }
      // Caso exista um array plano detail.episodes
      else if (Array.isArray(detail?.episodes) && detail.episodes.length > 0) {
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
  id: Number(tmdb),
  name: detail.nome || detail.title || detail.name || item?.name || item?.title || '',
        original_name: detail.original_name || detail.original_title || '',
        first_air_date: detail.first_air_date || detail.ano || '',
        // convert genre ids or names into an array of genre names when possible
        genre_ids: Array.isArray(detail.genre_ids)
          ? detail.genre_ids.map((g: any) => (g && typeof g === 'object' && g.name ? String(g.name) : String(g)))
          : (detail.generos ? String(detail.generos).split(',').map((g: string) => g.trim()) : []),
        original_language: detail.original_language || 'pt',
        poster_path: posterUrl || '',
        backdrop_path: backdropUrl || '',
        ...temporadas,
      };

      // Substituir temporadas por arrays com metadados quando disponíveis
      for (const k of Object.keys(temporadas_meta_arrays)) {
        mappedObj[k] = temporadas_meta_arrays[k];
      }

      const needTmdb = !mappedObj.name || !mappedObj.poster_path || !mappedObj.backdrop_path;
      if (needTmdb) {
        try {
          const tmdbData = await fetchTmdbDetails('tv', String(tmdb));
          if (tmdbData) {
            mappedObj.name = mappedObj.name || tmdbData.name || tmdbData.title || mappedObj.name;
            mappedObj.original_name = mappedObj.original_name || tmdbData.original_name || tmdbData.original_title || mappedObj.original_name;
            mappedObj.first_air_date = mappedObj.first_air_date || tmdbData.first_air_date || tmdbData.release_date || mappedObj.first_air_date;
            if (!Array.isArray(mappedObj.genre_ids) || mappedObj.genre_ids.length === 0) {
              // replace numeric ids with genre names from TMDB
              mappedObj.genre_ids = tmdbData.genres ? tmdbData.genres.map((g: any) => String(g.name)) : mappedObj.genre_ids;
            }
            mappedObj.poster_path = mappedObj.poster_path || (tmdbData.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}` : mappedObj.poster_path);
            mappedObj.backdrop_path = mappedObj.backdrop_path || (tmdbData.backdrop_path ? `https://image.tmdb.org/t/p/w1280${tmdbData.backdrop_path}` : mappedObj.backdrop_path);
          }
        } catch (e) {
          // swallow TMDB errors
        }
      }

      mapped.push(mappedObj);
    }

    return NextResponse.json({
      page: listData.page || page,
      totalPaginas: listData.total_pages || listData.total_pages || Math.ceil((listData.total_series || mapped.length) / limit),
      totalResults: listData.total_series || listData.total || mapped.length,
      results: mapped,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro desconhecido' }, { status: 500 });
  }
}
