
import { NextResponse } from 'next/server';
import filmesDataRaw from '../../../../filmes.json';

type Filme = {
  adult: boolean;
  id: number;
  [key: string]: any;
};
type Pagina = {
  page: number;
  results: Filme[];
};
type FilmesJson = {
  pages: Pagina[];
};

const filmesData = filmesDataRaw as FilmesJson;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);

  // Busca a página correta no JSON
  const pagina = filmesData.pages.find((p: any) => p.page === page);

  if (!pagina) {
    return NextResponse.json({ error: 'Página não encontrada.' }, { status: 404 });
  }


  // Filtra para não retornar filmes adultos
  let results = Array.isArray(pagina.results) ? pagina.results.filter((filme: any) => !filme.adult) : [];

  // Remove duplicados pelo id
  const idsUnicos = new Set();
  results = results.filter((filme: any) => {
    if (idsUnicos.has(filme.id)) return false;
    idsUnicos.add(filme.id);
    return true;
  });

  // Adiciona o campo tmdb
  const resultados = results.map((filme: any) => ({
    ...filme,
    tmdb: filme.id != null ? String(filme.id) : ''
  }));

  return NextResponse.json({
    page: pagina.page,
    totalPaginas: filmesData.pages.length,
    totalResults: filmesData.pages.reduce((acc: number, p: any) => acc + (p.results?.length || 0), 0),
    results: resultados
  });
}
