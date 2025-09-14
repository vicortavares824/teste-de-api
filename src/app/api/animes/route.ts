import { NextResponse } from 'next/server';
import axios from 'axios';
import animes from './animes.json';

const TMDB_API_KEY = process.env.TMDB_API_KEY || '60b55db2a598d09f914411a36840d1cb';
const BASE_URL_TMDB = 'https://api.themoviedb.org/3';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = 20;

  const allAnimeIds = Array.isArray(animes) ? animes.map(a => a.id) : [];
  const totalResults = allAnimeIds.length;
  const totalPaginas = Math.ceil(totalResults / pageSize);

  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const pageIds = allAnimeIds.slice(start, end);

  const fetchDetails = async (id: string | number) => {
    try {
      const movieUrl = `${BASE_URL_TMDB}/movie/${id}?api_key=${TMDB_API_KEY}&language=pt-BR`;
      const movieResponse = await axios.get(movieUrl);
      if (movieResponse.data) {
        return movieResponse.data;
      }
    } catch (error) {
      // Se não encontrar como filme, tenta como série
    }

    try {
      const tvUrl = `${BASE_URL_TMDB}/tv/${id}?api_key=${TMDB_API_KEY}&language=pt-BR`;
      const tvResponse = await axios.get(tvUrl);
      if (tvResponse.data) {
        return tvResponse.data;
      }
    } catch (error) {
      // Se falhar em ambos, retorna null
    }

    return null;
  };

  const detailPromises = pageIds.map(id => fetchDetails(id));
  const allDetails = await Promise.all(detailPromises);

  // Filtra os que não foram encontrados e os que são adultos
  const nonAdultResults = allDetails.filter(detail => detail && !detail.adult);
  
  const resultados = nonAdultResults.map((item: any) => ({
    ...item,
    tmdb: String(item.id)
  }));

  if (resultados.length === 0 && page > 1) {
    return NextResponse.json({ error: 'Nenhum resultado encontrado para esta página.' }, { status: 404 });
  }

  return NextResponse.json({
    page,
    totalPaginas,
    totalResults, // Retorna o total de animes do JSON, não apenas da página filtrada
    results: resultados,
  });
}
