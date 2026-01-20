
import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

// Substitua pelas suas chaves de API
const TMDB_API_KEY = process.env.TMDB_API_KEY || '60b55db2a598d09f914411a36840d1cb';
const OMDB_API_KEY = process.env.OMDB_API_KEY || '10bd4817';


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get('id');
  const tmdbId = searchParams.get('tmdb');
    const tipo = (searchParams.get('tipo') || '').toLowerCase(); // 'filme' ou 'serie' ou 'anime'
  const season = searchParams.get('season');
  const episode = searchParams.get('episode');
  // Busca local por id (aceita tmdb para filme/serie/anime)
  const buscaId = idParam || (tmdbId && (tipo === 'filme' || tipo === 'serie' || tipo === 'anime') ? tmdbId : null);
  if (buscaId) {
    try {
      // Monta URL direta sem consultar JSONs locais
      const buildHostMovUrl = (id: string) => `https://roxanoplay.bb-bet.top/pages/hostmov.php?id=${id}`;
      const buildProxyEpisodeUrl = (id: string, s: string, e: string) => `https://roxanoplay.bb-bet.top/pages/proxys.php?id=${id}/${s}/${e}`;

      if (tipo === 'filme') {
        return NextResponse.json({ url_im: buildHostMovUrl(String(buscaId)) });
      }

      if (tipo === 'serie' || tipo === 'anime') {
        if (!season || !episode) {
          return NextResponse.json({ error: 'Parâmetros "season" e "episode" são obrigatórios para series/animes.' }, { status: 400 });
        }
        return NextResponse.json({ url_im: buildProxyEpisodeUrl(String(buscaId), String(Number(season)), String(Number(episode)))});
      }

      return NextResponse.json({ error: 'Tipo inválido.' }, { status: 400 });
    } catch (e) {
      console.error('[Search] Erro ao montar URL:', e);
      return NextResponse.json({ error: 'Erro interno ao montar URL.' }, { status: 500 });
    }
  }
  // ...continua fluxo original abaixo...
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
  // ...existing code...

  if (!tmdbId) {
    return NextResponse.json({ error: 'Parâmetro "tmdb" é obrigatório.', status: 'erro' }, { status: 400 });
  }
  if (tipo !== 'filme' && tipo !== 'serie' && tipo !== 'anime') {
    return NextResponse.json({ error: 'Parâmetro "tipo" deve ser "filme", "serie" ou "anime".', status: 'erro' }, { status: 400 });
  }


  let tmdbDetailsUrl = '';
  let tmdbDetails;
  if (tipo === 'filme') {
    tmdbDetailsUrl = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`;
    const tmdbDetailsRes = await fetch(tmdbDetailsUrl);
    if (!tmdbDetailsRes.ok) {
      return NextResponse.json({ error: 'Erro ao consultar TMDB.', status: 'erro_tmdb' }, { status: 502 });
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
    // tratar 'serie' e 'anime' como TV na TMDB
    tmdbDetailsUrl = `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`;
    const tmdbDetailsRes = await fetch(tmdbDetailsUrl);
    if (!tmdbDetailsRes.ok) {
      return NextResponse.json({ error: 'Erro ao consultar TMDB.', status: 'erro_tmdb' }, { status: 502 });
    }
    tmdbDetails = await tmdbDetailsRes.json();
    // Se não vier imdb_id, tenta buscar em /external_ids
    if (!tmdbDetails.imdb_id) {
      const externalIdsUrl = `https://api.themoviedb.org/3/tv/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;
      const externalIdsRes = await fetch(externalIdsUrl);
      if (!externalIdsRes.ok) {
        return NextResponse.json({ error: 'Erro ao consultar external_ids da TMDB.', status: 'erro_external_ids_tmdb' }, { status: 502 });
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
    return NextResponse.json({ error: 'TMDB não encontrou filme ou série para esse ID.', status: 'nao_encontrado' }, { status: 404 });
  }

  // Para filmes: retorna URLs usando id (TMDB) e imdb_id (IMDb)
  // Para séries: o tmdbId já vem montado como id/temporada/episodio

  // Após remover blocos de /server, retorna erro padrão para requisições que não sejam por id
  return NextResponse.json({ error: 'Apenas busca por id local disponível.' }, { status: 400 });
}
