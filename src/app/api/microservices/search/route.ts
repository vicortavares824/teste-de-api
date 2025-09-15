
import { NextResponse } from 'next/server';

// Substitua pelas suas chaves de API
const TMDB_API_KEY = process.env.TMDB_API_KEY || '60b55db2a598d09f914411a36840d1cb';
const OMDB_API_KEY = process.env.OMDB_API_KEY || '10bd4817';


export async function GET(request: Request) {
  // Função auxiliar para buscar imdb_id pelo título no OMDb
  async function buscarImdbIdPorTitulo(titulo: string, ano?: string) {
    const url = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(titulo)}${ano ? `&y=${ano}` : ''}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.imdbID && data.imdbID !== 'N/A') {
      return data.imdbID;
    }
    return null;
  }
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
    if (!tmdbDetailsRes.ok) {
      return NextResponse.json({ error: 'Erro ao consultar TMDB.' }, { status: 502 });
    }
    tmdbDetails = await tmdbDetailsRes.json();
    // Busca dados do OMDb para comparar título
    if (tmdbDetails.imdb_id) {
      const omdbUrl = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${tmdbDetails.imdb_id}`;
      const omdbRes = await fetch(omdbUrl);
      if (omdbRes.ok) {
        const omdbData = await omdbRes.json();
        if (omdbData && omdbData.Title && tmdbDetails.title && omdbData.Title.toLowerCase() !== tmdbDetails.title.toLowerCase()) {
          // Títulos diferentes, buscar imdb_id pelo título do TMDB
          const novoImdbId = await buscarImdbIdPorTitulo(tmdbDetails.title, tmdbDetails.release_date ? tmdbDetails.release_date.slice(0,4) : undefined);
          if (novoImdbId) {
            tmdbDetails.imdb_id = novoImdbId;
          }
        }
      }
    } else if (tmdbDetails.title) {
      // Não tem imdb_id, tenta buscar pelo título
      const novoImdbId = await buscarImdbIdPorTitulo(tmdbDetails.title, tmdbDetails.release_date ? tmdbDetails.release_date.slice(0,4) : undefined);
      if (novoImdbId) {
        tmdbDetails.imdb_id = novoImdbId;
      }
    }
  } else {
    tmdbDetailsUrl = `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`;
    const tmdbDetailsRes = await fetch(tmdbDetailsUrl);
    if (!tmdbDetailsRes.ok) {
      return NextResponse.json({ error: 'Erro ao consultar TMDB.' }, { status: 502 });
    }
    tmdbDetails = await tmdbDetailsRes.json();
    // Se não vier imdb_id, tenta buscar em /external_ids
    if (!tmdbDetails.imdb_id) {
      const externalIdsUrl = `https://api.themoviedb.org/3/tv/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;
      const externalIdsRes = await fetch(externalIdsUrl);
      if (!externalIdsRes.ok) {
        return NextResponse.json({ error: 'Erro ao consultar external_ids da TMDB.' }, { status: 502 });
      }
      const externalIds = await externalIdsRes.json();
      if (externalIds && externalIds.imdb_id) {
        tmdbDetails.imdb_id = externalIds.imdb_id;
      }
    }
    // Busca dados do OMDb para comparar título
    if (tmdbDetails.imdb_id) {
      const omdbUrl = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${tmdbDetails.imdb_id}`;
      const omdbRes = await fetch(omdbUrl);
      if (omdbRes.ok) {
        const omdbData = await omdbRes.json();
        if (omdbData && omdbData.Title && tmdbDetails.name && omdbData.Title.toLowerCase() !== tmdbDetails.name.toLowerCase()) {
          // Títulos diferentes, buscar imdb_id pelo nome do TMDB
          const novoImdbId = await buscarImdbIdPorTitulo(tmdbDetails.name, tmdbDetails.first_air_date ? tmdbDetails.first_air_date.slice(0,4) : undefined);
          if (novoImdbId) {
            tmdbDetails.imdb_id = novoImdbId;
          }
        }
      }
    } else if (tmdbDetails.name) {
      // Não tem imdb_id, tenta buscar pelo nome
      const novoImdbId = await buscarImdbIdPorTitulo(tmdbDetails.name, tmdbDetails.first_air_date ? tmdbDetails.first_air_date.slice(0,4) : undefined);
      if (novoImdbId) {
        tmdbDetails.imdb_id = novoImdbId;
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
    if (streamRes.ok) {
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
    // Verifica se a url_im responde com status 206 (Partial Content)
    let status206_urlim = false;
    try {
      const headRes = await fetch(proxyUrl, { method: 'HEAD' });
      status206_urlim = headRes.status === 200;
    } catch (e) {
      status206_urlim = false;
    }
    // Verifica se a tmdbProxyUrl responde com status 206
    let status206_tmdb = false;
    if (tmdbProxyUrl) {
      try {
        const headRes = await fetch(tmdbProxyUrl, { method: 'HEAD' });
        status206_tmdb = headRes.status === 200;
      } catch (e) {
        status206_tmdb = false;
      }
    }
    // Monta resposta apenas com URLs que respondem 206
    let url_im_final = status206_urlim ? proxyUrl : null;
    let tmdb_final = status206_tmdb ? tmdbProxyUrl : null;
    // Se nenhuma das URLs responde 206, retorna ambas como null
    if (!url_im_final && !tmdb_final) {
      return NextResponse.json({ url_im: null, tmdb: null });
    }
    // Se só uma respondeu 206, retorna só ela
    return NextResponse.json({
      url_im: url_im_final,
      tmdb: tmdb_final
    });
  }

  // Se não encontrou nenhuma URL de vídeo, retorna só o proxy TMDB
  return NextResponse.json({
    url_im: null,
    tmdb: tmdbProxyUrl
  });
}
