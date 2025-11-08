import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

const TMDB_API_KEY = process.env.TMDB_API_KEY || '60b55db2a598d09f914411a36840d1cb';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tmdb = searchParams.get('tmdb');
  const tipo = (searchParams.get('tipo') || '').toLowerCase(); // filme | serie | anime
  const countParam = Number(searchParams.get('count') || '12');
  const count = Number.isFinite(countParam) && countParam > 0 ? Math.min(50, Math.floor(countParam)) : 12;
  // util: carrega locais
  const loadLocal = async (file: string) => {
    try {
      const p = path.resolve(process.cwd(), file);
      const str = await fs.readFile(p, 'utf-8');
      const data = JSON.parse(str);
      const items: any[] = [];
      for (const page of data.pages || []) {
        for (const r of page.results || []) items.push(r);
      }
      return items;
    } catch (e) {
      return [];
    }
  };

  // Se tmdb não foi informado, retorna recomendações locais combinadas
  if (!tmdb) {
    const filmes = await loadLocal('filmes.json');
    const series = await loadLocal('series.json');
    const animes = await loadLocal('animes.json');
    const combined = [
      ...filmes.map(f => ({ ...f, media_type: 'movie', tipo: 'filme' })),
      ...series.map(s => ({ ...s, media_type: 'tv', tipo: 'serie' })),
      ...animes.map(a => ({ ...a, media_type: 'tv', tipo: 'anime' })),
    ];
    combined.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    const slice = combined.slice(0, count);
    return NextResponse.json({ recommendations: slice, total: slice.length });
  }

  if (!['filme', 'serie', 'anime'].includes(tipo)) return NextResponse.json({ error: 'Parâmetro tipo inválido.' }, { status: 400 });

  // determinar endpoint TMDB (movie ou tv)
  const media = tipo === 'filme' ? 'movie' : 'tv';
  const url = `https://api.themoviedb.org/3/${media}/${tmdb}/recommendations?api_key=${TMDB_API_KEY}&language=pt-BR`;
  let tmdbResults = [];
  try {
    const res = await fetch(url);
    if (!res.ok) return NextResponse.json({ error: 'Erro ao consultar TMDB.' }, { status: 502 });
    const data = await res.json();
    tmdbResults = data.results || [];
  } catch (e) {
    return NextResponse.json({ error: 'Erro ao consultar TMDB.' }, { status: 502 });
  }



  const filmes = await loadLocal('filmes.json');
  const series = await loadLocal('series.json');
  const animes = await loadLocal('animes.json');

  // normalizador simples
  const normalize = (s?: string) => {
    if (!s) return '';
    try {
      return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, '');
    } catch (e) {
      return s.toLowerCase().replace(/\s+/g, '');
    }
  };

  const matched: any[] = [];
  for (const r of tmdbResults) {
    const id = String(r.id);
    // procurar em filmes
    const foundFilm = filmes.find(f => String(f.id) === id);
    if (foundFilm) {
      matched.push({ ...foundFilm, media_type: 'movie', tipo: 'filme' });
      continue;
    }
    // procurar em series
    const foundSeries = series.find(s => String(s.id) === id);
    if (foundSeries) {
      matched.push({ ...foundSeries, media_type: 'tv', tipo: 'serie' });
      continue;
    }
    // procurar em animes
    const foundAnime = animes.find(a => String(a.id) === id);
    if (foundAnime) {
      matched.push({ ...foundAnime, media_type: 'tv', tipo: 'anime' });
      continue;
    }
    // fallback: tentar por título normalizado
    const nTitle = normalize(r.title || r.name || r.original_name);
    const filmByTitle = filmes.find(f => normalize(f.title || f.name || f.original_name) === nTitle);
    if (filmByTitle) {
      matched.push({ ...filmByTitle, media_type: 'movie', tipo: 'filme' });
      continue;
    }
    const seriesByTitle = series.find(s => normalize(s.name || s.original_name || s.title) === nTitle);
    if (seriesByTitle) {
      matched.push({ ...seriesByTitle, media_type: 'tv', tipo: 'serie' });
      continue;
    }
    const animeByTitle = animes.find(a => normalize(a.name || a.original_name || a.title) === nTitle);
    if (animeByTitle) {
      matched.push({ ...animeByTitle, media_type: 'tv', tipo: 'anime' });
      continue;
    }
  }

  return NextResponse.json({ recommendations: matched, total: matched.length });
}

