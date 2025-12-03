import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tmdb = searchParams.get('tmdb');
  if (!tmdb) return NextResponse.json({ error: 'Parâmetro tmdb é obrigatório.' }, { status: 400 });

  try {
    // procura em series.json
    const seriesPath = path.resolve(process.cwd(), 'series.json');
    const seriesStr = await fs.readFile(seriesPath, 'utf-8');
    const seriesData = JSON.parse(seriesStr);
    for (const page of seriesData.pages || []) {
      for (const item of page.results || []) {
        if (String(item.id) === String(tmdb)) {
          return NextResponse.json({ tipo: 'serie', item });
        }
      }
    }

    // procura em animes.json
    const animesPath = path.resolve(process.cwd(), 'animes.json');
    const animesStr = await fs.readFile(animesPath, 'utf-8');
    const animesData = JSON.parse(animesStr);
    for (const page of animesData.pages || []) {
      for (const item of page.results || []) {
        if (String(item.id) === String(tmdb)) {
          return NextResponse.json({ tipo: 'anime', item });
        }
      }
    }

    return NextResponse.json({ error: 'ID não encontrado em series.json ou animes.json.' }, { status: 404 });
  } catch (e) {
    console.error('[proximo] erro:', e);
    return NextResponse.json({ error: 'Erro ao ler arquivos locais.' }, { status: 500 });
  }
}
