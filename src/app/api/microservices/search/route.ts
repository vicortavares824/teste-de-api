
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
  const tipo = (searchParams.get('tipo') || '').toLowerCase(); // 'filme' ou 'serie'
  const season = searchParams.get('season');
  const episode = searchParams.get('episode');
  if (idParam) {
    try {
      const filmesPath = path.resolve(process.cwd(), 'filmes.json');
      const jsonStr = await fs.readFile(filmesPath, 'utf-8');
      const filmesData = JSON.parse(jsonStr);
      // Procura o filme pelo id (número ou string)
      let found = null;
      for (const page of filmesData.pages || []) {
        for (const result of page.results || []) {
          if (String(result.id) === String(idParam)) {
            found = result;
            break;
          }
        }
        if (found) break;
      }
      if (found && found.video) {
        return NextResponse.json({ tmdbProxyUrl: found.video });
      } else {
        return NextResponse.json({ error: 'Filme não encontrado no JSON ou sem campo video.' }, { status: 404 });
      }
    } catch (e) {
      return NextResponse.json({ error: 'Erro ao ler filmes.json.' }, { status: 500 });
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
  if (tipo !== 'filme' && tipo !== 'serie') {
    return NextResponse.json({ error: 'Parâmetro "tipo" deve ser "filme" ou "serie".', status: 'erro' }, { status: 400 });
  }

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
