import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get('id');
  const tmdbId = searchParams.get('tmdb');
  const tipo = (searchParams.get('tipo') || '').toLowerCase(); // 'filme' | 'serie' | 'anime'
  const season = searchParams.get('season');
  const episode = searchParams.get('episode');

  const buscaId = idParam || (tmdbId && (tipo === 'filme' || tipo === 'serie' || tipo === 'anime') ? tmdbId : null);
  if (!buscaId) {
    return NextResponse.json({ error: 'Parâmetro id ou (tmdb+tipo) obrigatório.' }, { status: 400 });
  }

  try {
    // procura em filmes.json
    const filmesPath = path.resolve(process.cwd(), 'filmes.json');
    const filmesStr = await fs.readFile(filmesPath, 'utf-8');
    const filmesData = JSON.parse(filmesStr);
    for (const page of filmesData.pages || []) {
      for (const result of page.results || []) {
        if (String(result.id) === String(buscaId)) {
          if (result.video) return NextResponse.json({ url_im: result.video, media_type: 'movie', tipo: 'filme' });
          return NextResponse.json({ error: 'Filme encontrado mas sem campo video.' }, { status: 404 });
        }
      }
    }

    // procura em series/animes conforme tipo
    const dataFile = tipo === 'anime' ? 'animes.json' : 'series.json';
    const seriesPath = path.resolve(process.cwd(), dataFile);
    const seriesStr = await fs.readFile(seriesPath, 'utf-8');
    const seriesData = JSON.parse(seriesStr);
    let found: any = null;
    for (const page of seriesData.pages || []) {
      for (const result of page.results || []) {
        if (String(result.id) === String(buscaId)) {
          found = result;
          break;
        }
      }
      if (found) break;
    }
    if (!found) return NextResponse.json({ error: 'Item não encontrado no JSON local.' }, { status: 404 });

    // monta seasons normalizados
    const seasons: Record<string, Record<string, string>> = {};
    for (const [k, v] of Object.entries(found)) {
      const m = k.match(/temporada[_\- ]?(\d+)/i);
      if (m && v && typeof v === 'object') {
        const sNum = String(Number(m[1]));
        seasons[sNum] = {};
        for (const [epKey, epVal] of Object.entries(v as Record<string, any>)) {
          const em = epKey.match(/(\d+)/);
          const epNum = em ? String(Number(em[1])) : epKey;
          if (typeof epVal === 'string') seasons[sNum][epNum] = epVal;
        }
      }
    }

    // se pediu season+episode retorna url direta
    if (season && episode) {
      const sNum = String(Number(season));
      const eNum = String(Number(episode));
      const epUrl = seasons[sNum]?.[eNum];
      if (epUrl) return NextResponse.json({ url_im: epUrl, media_type: 'tv', tipo: tipo === 'anime' ? 'anime' : 'serie' });
      // tenta procurar nas chaves originais
      for (const [k, v] of Object.entries(found)) {
        const m = k.match(/temporada[_\- ]?(\d+)/i);
        if (m && String(Number(m[1])) === sNum && v && typeof v === 'object') {
          for (const [epKey, epVal] of Object.entries(v as Record<string, any>)) {
            const em = epKey.match(/(\d+)/);
            const epKeyNum = em ? String(Number(em[1])) : epKey;
            if (epKeyNum === eNum && typeof epVal === 'string') return NextResponse.json({ url_im: epVal, media_type: 'tv', tipo: tipo === 'anime' ? 'anime' : 'serie' });
          }
        }
      }
      return NextResponse.json({ error: 'Episódio não encontrado.' }, { status: 404 });
    }

    // se não pediu episódio retorna objeto com seasons e metadados
    const transformed = { ...found } as any;
    for (const key of Object.keys(found)) {
      if (/^temporada[_\- ]?\d+/i.test(key)) delete transformed[key];
    }
    if (Object.keys(seasons).length > 0) transformed.seasons = seasons;
    transformed.media_type = 'tv';
    transformed.tipo = tipo === 'anime' ? 'anime' : 'serie';
    return NextResponse.json({ series: transformed });

  } catch (e) {
    console.error('[Download] erro:', e);
    return NextResponse.json({ error: 'Erro ao ler arquivos locais.' }, { status: 500 });
  }
}
