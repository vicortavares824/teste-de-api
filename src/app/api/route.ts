import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET() {
  try {
    const [filmes, series, animes] = await Promise.all([
      axios.get('http://localhost:3000/api/filmes'),
      axios.get('http://localhost:3000/api/series'),
      axios.get('http://localhost:3000/api/animes'),
    ]);

    return NextResponse.json({
      filmes: filmes.data,
      series: series.data,
      animes: animes.data,
    });
  } catch (e) {
    return NextResponse.json({ error: 'Erro ao buscar dados das rotas internas' }, { status: 500 });
  }
}
