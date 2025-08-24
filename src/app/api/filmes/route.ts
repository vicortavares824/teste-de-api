
import { NextResponse } from 'next/server';
import axios from 'axios';

const TMDB_API_KEY = process.env.TMDB_API_KEY || '60b55db2a598d09f914411a36840d1cb';
const BASE_URL_TMDB = 'https://api.themoviedb.org/3';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);

  // 1. Busca filmes populares na API externa
  const popularUrl = `https://streaming-api-ready-for-render.onrender.com/api/popular?type=movie&page=${page}`;
  let popularData;
  try {
    const resp = await axios.get(popularUrl);
    popularData = resp.data;
  } catch (e) {
    return NextResponse.json({ error: 'Erro ao buscar filmes populares', detalhes: e instanceof Error ? e.message : e }, { status: 500 });
  }

  const totalPaginas = popularData.total_pages || 1;
  const totalResults = popularData.total_results || 0;
  let results = Array.isArray(popularData.results) ? popularData.results : [];
  // Filtra para não retornar filmes adultos
  results = results.filter((filme: any) => !filme.adult);

  // 2. Não buscar TMDB por item: retorna os dados externos adicionando o campo tmdb_id = String(id)
  const resultados = results.map((filme: any) => ({
    ...filme,
    tmdb: filme.id != null ? String(filme.id) : ''
  }));

  if (resultados.length === 0) {
    return NextResponse.json({ error: 'Nenhum resultado encontrado.' }, { status: 404 });
  }

  return NextResponse.json({
    page,
    totalPaginas,
    totalResults,
    results: resultados
  });
}
