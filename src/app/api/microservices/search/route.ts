
import { NextResponse } from 'next/server';

// Substitua pelas suas chaves de API
const TMDB_API_KEY = process.env.TMDB_API_KEY || '60b55db2a598d09f914411a36840d1cb';
const OMDB_API_KEY = process.env.OMDB_API_KEY || '10bd4817';


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tmdbId = searchParams.get('tmdb');
  const tipo = (searchParams.get('tipo') || '').toLowerCase(); // 'filme' ou 'serie'
  const season = searchParams.get('season');
  const episode = searchParams.get('episode');

  if (!tmdbId) {
    return NextResponse.json({ error: 'Parâmetro "tmdb" é obrigatório.' }, { status: 400 });
  }
  if (tipo !== 'filme' && tipo !== 'serie') {
    return NextResponse.json({ error: 'Parâmetro "tipo" deve ser "filme" ou "serie".' }, { status: 400 });
  }


  let tmdbDetailsUrl = '';
  let tmdbDetails;
  if (tipo === 'filme') {
    tmdbDetailsUrl = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`;
    const tmdbDetailsRes = await fetch(tmdbDetailsUrl);
    tmdbDetails = await tmdbDetailsRes.json();
  } else {
    tmdbDetailsUrl = `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`;
    const tmdbDetailsRes = await fetch(tmdbDetailsUrl);
    tmdbDetails = await tmdbDetailsRes.json();
    // Se não vier imdb_id, tenta buscar em /external_ids
    if (!tmdbDetails.imdb_id) {
      const externalIdsUrl = `https://api.themoviedb.org/3/tv/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;
      const externalIdsRes = await fetch(externalIdsUrl);
      const externalIds = await externalIdsRes.json();
      if (externalIds && externalIds.imdb_id) {
        tmdbDetails.imdb_id = externalIds.imdb_id;
      }
    }
  }

  if ((tipo === 'filme' && !tmdbDetails.title) || (tipo === 'serie' && !tmdbDetails.name)) {
    return NextResponse.json({ error: 'TMDB não encontrou filme ou série para esse ID.' }, { status: 404 });
  }

  // Para filmes: retorna URLs usando id (TMDB) e imdb_id (IMDb)
  // Para séries: o tmdbId já vem montado como id/temporada/episodio

  let urlDublado = null;
  let urlLegendado = null;
  let streamApiUrl = '';
  if (tipo === 'filme') {
    if (!tmdbDetails.imdb_id) {
      return NextResponse.json({ error: 'Filme não possui imdb_id na TMDB.' }, { status: 404 });
    }
    streamApiUrl = `https://teste-de-api-zeta.vercel.app/api/server/stream/movie/${tmdbDetails.imdb_id}`;
  } else {
    if (!tmdbDetails.imdb_id) {
      return NextResponse.json({ error: 'Série não possui imdb_id na TMDB.' }, { status: 404 });
    }
    if (!season || !episode) {
      return NextResponse.json({ error: 'Parâmetros season e episode são obrigatórios para séries.' }, { status: 400 });
    }
    streamApiUrl = `https://teste-de-api-zeta.vercel.app/api/server/stream/series/${tmdbDetails.imdb_id}/${season}/${episode}`;
  }
  

  try {
    const streamRes = await fetch(streamApiUrl);
    const streamData = await streamRes.json();
    if (Array.isArray(streamData.streams)) {
      for (const s of streamData.streams) {
        if (s.description && s.description.toLowerCase().includes('dublado')) {
          urlDublado = s.url;
          break;
        }
        if (!urlLegendado && s.description && s.description.toLowerCase().includes('legendado')) {
          urlLegendado = s.url;
        }
      }
    }
  } catch (e) {
    // Se der erro, retorna vazio
  }

  // Se não encontrar dublado, retorna legendado
  const finalUrl = urlDublado || urlLegendado || null;


  let tmdbProxyUrl = '';
  let tmdbProxyApiUrl = '';
  if (tipo === 'filme') {
    tmdbProxyApiUrl = `https://teste-de-api-zeta.vercel.app/api/media/filmes-proxy?id=${tmdbDetails.id}`;
  } else {
    tmdbProxyApiUrl = `https://teste-de-api-zeta.vercel.app/api/media/series-proxy?id=${tmdbId}/${season}/${episode}`;
  }
  try {
    const proxyRes = await fetch(tmdbProxyApiUrl);
    if (proxyRes.ok) {
      const proxyData = await proxyRes.json();
      if (proxyData && proxyData.url) {
        tmdbProxyUrl = proxyData.url;
      } else {
        tmdbProxyUrl = null;
      }
    } else {
      tmdbProxyUrl = null;
    }
  } catch (e) {
    tmdbProxyUrl = null;
  }

  // Se encontrou uma URL de vídeo, retorna JSON com proxyUrl e headers (igual ao padrão do frontend)
  if (finalUrl) {
    // Busca o stream completo para pegar headers se existirem
    let proxyHeaders = null;
    let foundStream = null;
    try {
      const streamRes = await fetch(streamApiUrl);
      const streamData = await streamRes.json();
      if (Array.isArray(streamData.streams)) {
        for (const s of streamData.streams) {
          if (s.description && s.description.toLowerCase().includes('dublado')) {
            foundStream = s;
            break;
          }
          if (!foundStream && s.description && s.description.toLowerCase().includes('legendado')) {
            foundStream = s;
          }
        }
      }
    } catch (e) {}
    if (foundStream && foundStream.proxyHeaders) {
      proxyHeaders = foundStream.proxyHeaders;
    }
    let proxyUrl = `https://teste-de-api-zeta.vercel.app/api/server/video-proxy?videoUrl=${encodeURIComponent(finalUrl)}`;
    if (proxyHeaders) {
      proxyUrl += `&headers=${encodeURIComponent(JSON.stringify(proxyHeaders))}`;
    }
    return NextResponse.json({
      url_im: proxyUrl,
      tmdb: tmdbProxyUrl
    });
  }

  // Se não encontrou nenhuma URL de vídeo, retorna só o proxy TMDB
  return NextResponse.json({
    url_im: null,
    tmdb: tmdbProxyUrl
  });
}
