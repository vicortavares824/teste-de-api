import { NextResponse } from 'next/server';
import axios from 'axios';

// Função para capitalizar o tipo de mídia
const capitalize = (s: string) => {
  if (typeof s !== 'string') return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ error: 'Parâmetro de busca "q" obrigatório.' }, { status: 400 });
  }

  try {
    // 1. Faz a primeira requisição para pegar o total de páginas
    const firstPageUrl = `https://streaming-api-ready-for-render.onrender.com/api/search?q=${encodeURIComponent(query)}&page=1`;
    const firstPageResponse = await axios.get(firstPageUrl);
    const firstPageData = firstPageResponse.data;

    const totalPages = firstPageData.total_pages || 1;
    let allResults = firstPageData.results || [];

    // 2. Se houver mais de uma página, busca as restantes
    if (totalPages > 1) {
      const pagePromises = [];
      for (let page = 2; page <= totalPages; page++) {
        const pageUrl = `https://streaming-api-ready-for-render.onrender.com/api/search?q=${encodeURIComponent(query)}&page=${page}`;
        pagePromises.push(axios.get(pageUrl));
      }

      const pageResponses = await Promise.all(pagePromises);
      for (const pageResponse of pageResponses) {
        allResults = allResults.concat(pageResponse.data.results || []);
      }
    }

    if (!Array.isArray(allResults) || allResults.length === 0) {
      return NextResponse.json({ error: 'Nenhum resultado encontrado.' }, { status: 404 });
    }

    // 3. Mapeia a lista completa de resultados para o formato desejado
    const resultados = allResults.map((item: any) => {
      if (item.media_type === 'person') {
        return null;
      }

      const ano = item.release_date ? item.release_date.substring(0, 4) : (item.first_air_date ? item.first_air_date.substring(0, 4) : '');
      const tipo = item.media_type === 'movie' ? 'Filme' : (item.media_type === 'tv' ? 'Série' : capitalize(item.media_type));
      
      return {
        title: item.title || item.name,
        ano: ano,
        tipo: tipo,
        img: item.poster_url,
        link: `/${item.media_type}/${item.id}`,
        imdb_id: item.imdb_id || '',
        score: item.vote_average ? Math.round(item.vote_average * 10).toString() : '0',
      };
    }).filter(Boolean);

    if (resultados.length === 0) {
      return NextResponse.json({ error: 'Nenhum resultado encontrado.' }, { status: 404 });
    }

    return NextResponse.json({ resultados });

  } catch (e) {
    console.error('Erro ao buscar dados da nova API:', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'Erro ao buscar dados da nova API', detalhes: errorMessage }, { status: 500 });
  }
}
