// Cache simples em memória
const searchCache: Record<string, any> = {};
import { NextResponse } from 'next/server';
import axios from 'axios';

// Função para capitalizar o tipo de mídia
const capitalize = (s: string) => {
  if (typeof s !== 'string') return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
};

// Função para criar um atraso (delay)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ error: 'Parâmetro de busca "q" obrigatório.' }, { status: 400 });
  }

  try {
    // Chave do cache: termo + página
    const pageParam = searchParams.get('page') || '1';
    const cacheKey = `q=${query}&page=${pageParam}`;
    if (searchCache[cacheKey]) {
      return NextResponse.json(searchCache[cacheKey]);
    }
    // 1. Faz a primeira requisição para pegar o total de páginas
    const firstPageUrl = `https://streaming-api-ready-for-render.onrender.com/api/search?q=${encodeURIComponent(query)}&page=1`;
    const firstPageResponse = await axios.get(firstPageUrl);
    const firstPageData = firstPageResponse.data;

    const totalPages = firstPageData.total_pages || 1;
    let allResults = firstPageData.results || [];

    // 2. Se houver mais de uma página, busca as restantes com um intervalo
    if (totalPages > 1) {
      for (let page = 2; page <= totalPages; page++) {
        // Adiciona um intervalo de 250ms entre cada requisição
        await delay(250); 
        
        const pageUrl = `https://streaming-api-ready-for-render.onrender.com/api/search?q=${encodeURIComponent(query)}&page=${page}`;
        try {
          const pageResponse = await axios.get(pageUrl);
          if (pageResponse.data && pageResponse.data.results) {
            allResults = allResults.concat(pageResponse.data.results);
          }
        } catch (error) {
          console.error(`Falha ao buscar a página ${page}. Continuando...`, error);
          // Continua para a próxima página mesmo se uma falhar
        }
      }
    }

    if (!Array.isArray(allResults) || allResults.length === 0) {
      return NextResponse.json({ error: 'Nenhum resultado encontrado.' }, { status: 404 });
    }

    // Filtra conteúdo adulto antes de mapear
    const filteredResults = allResults.filter((item: any) => !item.adult);

    // 3. Mapeia a lista completa de resultados para o formato desejado
    const resultados = filteredResults.map((item: any) => {
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
        tmdb: String(item.id),
        score: item.vote_average ? Math.round(item.vote_average * 10).toString() : '0',
        media_type: item.media_type
      };
    }).filter(Boolean);

    if (resultados.length === 0) {
      return NextResponse.json({ error: 'Nenhum resultado encontrado.' }, { status: 404 });
    }

  const responseData = { resultados };
  // Salva no cache
  searchCache[cacheKey] = responseData;
  return NextResponse.json(responseData);

  } catch (e) {
    console.error('Erro ao buscar dados da nova API:', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'Erro ao buscar dados da nova API', detalhes: errorMessage }, { status: 500 });
  }
}
