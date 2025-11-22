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
  if (!['filme', 'serie', 'anime'].includes(tipo)) return NextResponse.json({ error: 'Parâmetro tipo inválido.' }, { status: 400 });

  // Caso não tenha tmdb, retorna top locais (por popularity) conforme tipo
  if (!tmdb) {
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
      } catch { return []; }
    };
    const file = tipo === 'filme' ? 'filmes.json' : (tipo === 'anime' ? 'animes.json' : 'series.json');
    const items = await loadLocalFlat(file);
    items.sort((a,b) => (b.popularity||0)-(a.popularity||0));
    const mapped = items.slice(0, count).map(it => ({
      ...it,
      media_type: tipo === 'filme' ? 'movie' : 'tv',
      tipo
    }));
    return NextResponse.json({ results: mapped, total: mapped.length });
  }

  const media = tipo === 'filme' ? 'movie' : 'tv';
  const url = `https://api.themoviedb.org/3/${media}/${tmdb}/recommendations?api_key=${TMDB_API_KEY}&language=pt-BR`;

  let tmdbResults: any[] = [];
  try {
    const res = await fetch(url);
    if (!res.ok) return NextResponse.json({ error: 'Erro ao consultar TMDB.' }, { status: 502 });
    const data = await res.json();
    tmdbResults = data.results || [];
  } catch (e) {
    return NextResponse.json({ error: 'Erro ao consultar TMDB.' }, { status: 502 });
  }

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
    } catch {
      return [];
    }
  };

  const filmes = await loadLocal('filmes.json');
  const series = await loadLocal('series.json');
  const animes = await loadLocal('animes.json');

  const normalize = (s?: string) => {
    if (!s) return '';
    try { return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ''); }
    catch { return s.toLowerCase().replace(/\s+/g, ''); }
  };

  const results: any[] = [];
  for (const r of tmdbResults) {
    const id = String(r.id);
    if (tipo === 'anime') {
      const anime = animes.find(a => String(a.id) === id) || animes.find(a => normalize(a.name||a.original_name||a.title) === normalize(r.name||r.title||r.original_name));
      if (anime) { results.push({ ...anime, media_type: 'tv', tipo: 'anime' }); }
      continue; // não mistura com filmes/séries
    }
    // tipo filme ou serie
    if (tipo === 'filme') {
      const film = filmes.find(f => String(f.id) === id) || filmes.find(f => normalize(f.title||f.name||f.original_name) === normalize(r.title||r.name||r.original_name));
      if (film) { results.push({ ...film, media_type: 'movie', tipo: 'filme' }); }
      continue;
    }
    // tipo serie
    const serie = series.find(s => String(s.id) === id) || series.find(s => normalize(s.name||s.original_name||s.title) === normalize(r.name||r.title||r.original_name));
    if (serie) { results.push({ ...serie, media_type: 'tv', tipo: 'serie' }); }
  }

  return NextResponse.json({ results, total: results.length });
}
