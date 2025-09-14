
import { NextResponse } from 'next/server';
import seriesDataRaw from '../../../../series.json';

type Serie = {
  adult: boolean;
  id: number;
  [key: string]: any;
};
type Pagina = {
  page: number;
  results: Serie[];
};
type SeriesJson = {
  pages: Pagina[];
};

const seriesData = seriesDataRaw as SeriesJson;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);

  // Busca a página correta no JSON
  const pagina = seriesData.pages.find((p: any) => p.page === page);

  if (!pagina) {
    return NextResponse.json({ error: 'Página não encontrada.' }, { status: 404 });
  }


  // Filtra para não retornar séries adultas
  let results = Array.isArray(pagina.results) ? pagina.results.filter((serie: any) => !serie.adult) : [];

  // Remove duplicados pelo id
  const idsUnicos = new Set();
  results = results.filter((serie: any) => {
    if (idsUnicos.has(serie.id)) return false;
    idsUnicos.add(serie.id);
    return true;
  });

  // Adiciona o campo tmdb
  const resultados = results.map((serie: any) => ({
    ...serie,
    tmdb: serie.id != null ? String(serie.id) : ''
  }));

  return NextResponse.json({
    page: pagina.page,
    totalPaginas: seriesData.pages.length,
    totalResults: seriesData.pages.reduce((acc: number, p: any) => acc + (p.results?.length || 0), 0),
    results: resultados
  });
}
