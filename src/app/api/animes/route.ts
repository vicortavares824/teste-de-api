
import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

type Anime = {
  adult?: boolean;
  id: number;
  [key: string]: any;
};
type Page = {
  page: number;
  results: Anime[];
};
type AnimesJson = {
  pages: Page[];
};

async function loadAnimesData(): Promise<AnimesJson> {
  const p = path.resolve(process.cwd(), 'animes.json');
  const txt = await fs.readFile(p, 'utf-8');
  return JSON.parse(txt) as AnimesJson;
}

function transformUrl(originalUrl: string | undefined) {
  if (!originalUrl) return originalUrl || '';
  try {
    const u = new URL(originalUrl);
    if (u.pathname.includes('/pages/mov.php') || u.pathname.endsWith('mov.php')) {
      u.pathname = u.pathname.replace('mov.php', 'hostmov.php');
      return u.toString();
    }
    return originalUrl;
  } catch (e) {
    return originalUrl.replace('/pages/mov.php?id=', '/pages/hostmov.php?id=');
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);

  const animesData = await loadAnimesData();
  // Busca a página correta no JSON
  const pagina = animesData.pages.find((p: any) => p.page === page);

  if (!pagina) {
    return NextResponse.json({ error: 'Página não encontrada.' }, { status: 404 });
  }

  // Filtra para não retornar conteúdo adulto
  let results: Anime[] = Array.isArray(pagina.results) ? pagina.results.filter((anime: Anime) => !anime.adult) : [];

  // Remove duplicados pelo id
  const idsUnicos = new Set<number>();
  results = results.filter((anime: Anime) => {
    if (idsUnicos.has(anime.id)) return false;
    idsUnicos.add(anime.id);
    return true;
  });

  // Adiciona o campo tmdb (string do id) se desejar
  const resultados = results.map((anime: Anime) => ({
    ...anime,
    tmdb: anime.id != null ? String(anime.id) : ''
  }));

  // Além disso, expor URLvideo com hostmov.php (transformação padrão)
  const mapped = resultados.map((a: any) => ({
    ...a,
    poster_url: a.imagem_capa || a.poster || '',
    URLvideo: transformUrl(a.url || a.URLvideo || ''),
  }));
  return NextResponse.json({
    page: pagina.page,
    totalPaginas: animesData.pages.length,
    totalResults: animesData.pages.reduce((acc: number, p: any) => acc + (p.results?.length || 0), 0),
    results: mapped
  });
}
