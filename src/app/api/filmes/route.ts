
import { NextResponse } from 'next/server';

type ExternalFilme = {
  id: string;
  tmdb_id?: string;
  nome?: string;
  sinopse?: string;
  imagem_capa?: string;
  ano?: string;
  generos?: string;
  nota_tmdb?: string;
  duracao?: string;
  url?: string;
  ativo?: string;
  [key: string]: any;
};

function transformUrl(originalUrl: string | undefined) {
  if (!originalUrl) return originalUrl || '';

  // Evitar proxificar duas vezes
  const PROXY_BASE = 'https://cinestream-kappa.vercel.app/api/proxy?url=';
  try {
    if (originalUrl.startsWith(PROXY_BASE) || originalUrl.includes('/api/proxy?url=')) return originalUrl;

    const u = new URL(originalUrl);
    // Se o pathname contém mov.php, trocamos para hostmov.php
    if (u.pathname.includes('/pages/mov.php') || u.pathname.endsWith('mov.php')) {
      u.pathname = u.pathname.replace('mov.php', 'hostmov.php');
    }

    const modified = u.toString();
    return PROXY_BASE + encodeURIComponent(modified);
  } catch (e) {
    // Fallback simples: tenta substituir o path e proxificar
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
  const page = parseInt(searchParams.get('page') || '1', 10);

  const externalUrl = `https://roxanoplay.bb-bet.top/api/filmes.php?page=${page}&limit=20`;

  try {
    const res = await fetch(externalUrl);
    if (!res.ok) {
      return NextResponse.json({ error: 'Erro ao buscar API externa' }, { status: res.status });
    }

    const data = await res.json();
    const filmes: ExternalFilme[] = Array.isArray(data.filmes) ? data.filmes : [];

    // Filtrar apenas ativos (se campo existir)
    let results = filmes.filter((f) => (f.ativo == null ? true : String(f.ativo) === '1'));

    // Remover duplicados por tmdb_id ou id
    const seen = new Set<string>();
    results = results.filter((f) => {
      const key = String(f.tmdb_id || f.id || '');
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Helpers para manipular imagens (extrai caminho e constrói URLs nos tamanhos usados)
    const extractImagePath = (img: string | undefined) => {
      if (!img) return ''
      try {
        const u = new URL(img)
        return u.pathname.startsWith('/') ? u.pathname : `/${u.pathname}`
      } catch (e) {
        // Se já for apenas o path
        return img.startsWith('/') ? img : `/${img}`
      }
    }

    const buildImageUrl = (path: string, size: 'w500' | 'w1280' | string = 'w500') => {
      if (!path) return ''
      // Se path já for uma URL completa, retorna ela
      if (path.startsWith('http')) return path
      return `https://image.tmdb.org/t/p/${size}${path}`
    }

    // Mapear para o formato antigo utilizado pelo projeto
    const mapped = results.map((f) => {
      const posterPath = extractImagePath(f.imagem_capa)
      const posterUrl = buildImageUrl(posterPath, 'w500')
      const backdropUrl = buildImageUrl(posterPath, 'w1280')

      return {
        adult: false,
        backdrop_path: posterPath || '',
        backdrop_url: backdropUrl || '',
        genres: f.generos || [],
        id: f.tmdb_id ? Number(f.tmdb_id) : Number(f.id),
        original_language: 'pt',
        overview: f.sinopse || '',
        popularity: f.nota_tmdb ? Number(f.nota_tmdb) : 0,
        poster_path: posterPath || '',
        poster_url: posterUrl || '',
        video: transformUrl(f.url),
        vote_average: f.nota_tmdb ? Number(f.nota_tmdb) : 0,
        vote_count: f.nota_tmdb ? Math.round(Number(f.nota_tmdb) * 10) : 0,
        original_title: f.nome || '',
        release_date: f.ano || '',
        title: f.nome || '',
        URLvideo: transformUrl(f.url),
        tmdb: f.tmdb_id ? String(f.tmdb_id) : String(f.id),
      }
    })

    return NextResponse.json({
      page: data.page || page,
      per_page: data.per_page || mapped.length,
      total: data.total || mapped.length,
      total_pages: data.total_pages || 1,
      results: mapped,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro desconhecido' }, { status: 500 });
  }
}