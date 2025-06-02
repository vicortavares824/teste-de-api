import { NextResponse } from 'next/server';
import axios from 'axios';

const TMDB_API_KEY = process.env.TMDB_API_KEY || '60b55db2a598d09f914411a36840d1cb';
const BASE_URL_TMDB = 'https://api.themoviedb.org/3';
const IDS_API_URL = 'https://superflixapi.wales/series/lista/';

type MediaDetalhe = {
  id: number;
  title?: string;
  release_date?: string;
  tmdb_media_type: 'movie' | 'tv';
  [key: string]: any;
};

export async function GET(request: Request) {
  let ids: string[] = [];
  try {
    const resp = await axios.get(IDS_API_URL);
    if (typeof resp.data === 'string') {
      ids = resp.data
        .replace(/<br\s*\/?>(\r)?/gi, '\n')
        .split('\n')
        .map(id => id.trim())
        .filter(Boolean);
    } else if (Array.isArray(resp.data.ids)) {
      ids = resp.data.ids;
    }
    if (ids.length === 0) {
      return NextResponse.json({ error: 'Nenhum ID encontrado na resposta da API de IDs', detalhes: resp.data }, { status: 500 });
    }
  } catch (e) {
    return NextResponse.json({ error: 'Erro ao buscar IDs da API de IDs', detalhes: e instanceof Error ? e.message : e }, { status: 500 });
  }

  // Paginação
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = 20;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const idsLote = ids.slice(start, end);

  // Retorna o total de páginas em uma variável separada
  const totalPaginas = Math.ceil(ids.length / pageSize);

  // Busca todos os resultados
  async function buscarDetalhes(id: string): Promise<MediaDetalhe | null> {
    try {
      const movie = await axios.get(`${BASE_URL_TMDB}/movie/${id}?api_key=${TMDB_API_KEY}&language=pt-BR`);
      return { ...movie.data, tmdb_media_type: 'movie' };
    } catch (e) {}
    try {
      const tv = await axios.get(`${BASE_URL_TMDB}/tv/${id}?api_key=${TMDB_API_KEY}&language=pt-BR`);
      return { ...tv.data, tmdb_media_type: 'tv' };
    } catch (e) {}
    return null;
  }

  const resultados: MediaDetalhe[] = [];
  for (const id of idsLote) {
    const detalhe = await buscarDetalhes(id);
    if (detalhe) resultados.push(detalhe);
  }

  // Ordena por data (mais recente primeiro)
  resultados.sort((a, b) => {
    const dataA = a.release_date || a.first_air_date || '';
    const dataB = b.release_date || b.first_air_date || '';
    return dataB.localeCompare(dataA);
  });

  if (resultados.length === 0) {
    return NextResponse.json({ error: 'Nenhum resultado encontrado no TMDb para os IDs informados.', ids: idsLote }, { status: 404 });
  }

  return NextResponse.json({
    page,
    totalPaginas,
    totalResults: ids.length,
    results: resultados
  });
}
