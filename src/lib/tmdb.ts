const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_KEY = process.env.TMDB_API_KEY || '';

const buildUrl = (pathSegment: string, params: Record<string, any> = {}) => {
  const u = new URL(`${TMDB_BASE}/${pathSegment}`);
  if (TMDB_KEY) u.searchParams.set('api_key', TMDB_KEY);
  for (const k of Object.keys(params || {})) {
    if (params[k] == null) continue;
    u.searchParams.set(k, String(params[k]));
  }
  return u.toString();
};

export const fetchTmdb = async (pathSegment: string, params: Record<string, any> = {}) => {
  if (!TMDB_KEY) return null;
  try {
    const res = await fetch(buildUrl(pathSegment, params));
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[tmdb] fetch error', err);
    return null;
  }
};

export const fetchGenres = async (media_type: 'movie' | 'tv') => {
  if (!TMDB_KEY) return null;
  return fetchTmdb(`${media_type}/genres`, { language: 'pt-BR' });
};

export const fetchDetails = async (media_type: 'movie' | 'tv', id: number | string) => {
  if (!TMDB_KEY) return null;
  return fetchTmdb(`${media_type}/${id}`, { language: 'pt-BR' });
};

export default {
  fetchTmdb,
  fetchGenres,
  fetchDetails,
};
