
import { NextResponse } from 'next/server';
import axios from 'axios';

const TMDB_API_KEY = process.env.TMDB_API_KEY || '60b55db2a598d09f914411a36840d1cb';
const BASE_URL_TMDB = 'https://api.themoviedb.org/3';

// Função para capitalizar o tipo
const capitalize = (s: string) => typeof s === 'string' ? s.charAt(0).toUpperCase() + s.slice(1) : '';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);

  // 1. Busca séries populares na API externa
  const popularUrl = `https://streaming-api-ready-for-render.onrender.com/api/popular?type=tv&page=${page}`;
  let popularData;
  try {
    const resp = await axios.get(popularUrl);
    popularData = resp.data;
    // Log para depuração
  
  } catch (e) {
    return NextResponse.json({ error: 'Erro ao buscar séries populares', detalhes: e instanceof Error ? e.message : e }, { status: 500 });
  }

  const totalPaginas = popularData.total_pages || 1;
  const totalResults = popularData.total_results || 0;
  let results = Array.isArray(popularData.results) ? popularData.results : [];

  results = results.filter((serie: any) => !serie.adult);

  // 2. Para cada série, busca o imdb_id no TMDB
  // Retorna apenas os dados da API popular, adicionando tmdb_id igual ao id
  const resultados = results.map((serie: any) => ({
    ...serie,
    tmdb: String(serie.id)
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
