
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

function transformUrl(originalUrl: string | undefined) {
  if (!originalUrl) return originalUrl || '';

  const PROXY_BASE = 'https://cinestream-kappa.vercel.app/api/proxy?url=';
  try {
    if (originalUrl.startsWith(PROXY_BASE) || originalUrl.includes('/api/proxy?url=')) return originalUrl;
    const u = new URL(originalUrl);
    if (u.pathname.includes('/pages/mov.php') || u.pathname.endsWith('mov.php')) {
      u.pathname = u.pathname.replace('mov.php', 'hostmov.php');
    }
    return PROXY_BASE + encodeURIComponent(u.toString());
  } catch (e) {
    try {
      const fallback = originalUrl.replace('/pages/mov.php?id=', '/pages/hostmov.php?id=');
      return PROXY_BASE + encodeURIComponent(fallback);
    } catch (inner) {
      return originalUrl || '';
    }
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = 20;

  const loadLocal = async (): Promise<any[]> => {
    const files = ['filmes.json'];
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
    const total = all.length;
    const total_pages = Math.max(1, Math.ceil(total / limit));

    const start = (page - 1) * limit;
    const end = start + limit;
    const pageItems = all.slice(start, end);

    const extractImagePath = (img: string | undefined) => {
      if (!img) return '';
      try {
        const u = new URL(img);
        return u.pathname.startsWith('/') ? u.pathname : `/${u.pathname}`;
      } catch (e) {
        return img && img.startsWith('/') ? img : `/${img}`;
      }
    };

    const buildImageUrl = (p: string, size: 'w500' | 'w1280' | string = 'w500') => {
      if (!p) return '';
      if (p.startsWith('http')) return p;
      return `https://image.tmdb.org/t/p/${size}${p}`;
    };

    const mapped = pageItems.map((it: any) => {
      const posterPath = extractImagePath(it.imagem_capa || it.poster_path || it.poster || '');
      const posterUrl = buildImageUrl(posterPath, 'w500');
      const backdropUrl = buildImageUrl(posterPath, 'w1280');

      return {
        adult: false,
        backdrop_path: posterPath || '',
        backdrop_url: backdropUrl || '',
        genres: it.generos || [],
        id: it.tmdb ? Number(it.tmdb) : (it.tmdb_id ? Number(it.tmdb_id) : (it.id ? Number(it.id) : 0)),
        original_language: it.original_language || 'pt',
        overview: it.sinopse || it.overview || '',
        popularity: it.nota_tmdb ? Number(it.nota_tmdb) : 0,
        poster_path: posterPath || '',
        poster_url: posterUrl || '',
        video: transformUrl(it.url),
        vote_average: it.nota_tmdb ? Number(it.nota_tmdb) : 0,
        vote_count: it.nota_tmdb ? Math.round(Number(it.nota_tmdb) * 10) : 0,
        original_title: it.nome || it.title || '',
        release_date: it.ano || it.release_date || '',
        title: it.nome || it.title || '',
        URLvideo: transformUrl(it.url),
        tmdb: it.tmdb ? String(it.tmdb) : (it.tmdb_id ? String(it.tmdb_id) : (it.id ? String(it.id) : '')),
      };
    });

    return NextResponse.json({
      page,
      per_page: limit,
      total,
      total_pages,
      results: mapped,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro desconhecido' }, { status: 500 });
  }
}