export const runtime = 'nodejs';

import { NextResponse, NextRequest } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

const DEFAULT_COUNT = 50;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const countParam = Number(searchParams.get('count'));
    const pageParam = Number(searchParams.get('page'));

    const count = Number.isFinite(countParam) && countParam > 0 ? Math.max(1, Math.floor(countParam)) : undefined;
    const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;

    const filePath = path.resolve(process.cwd(), 'canais_tv.json');
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    if (!Array.isArray(data)) {
      return NextResponse.json({ error: 'Formato inválido: esperado array' }, { status: 500 });
    }

    const total = data.length;
    let items = data;

    if (count) {
      const offset = Math.max(0, (page - 1) * count);
      items = data.slice(offset, offset + count);
    } else {
      // sem 'count' informado, retornar todos os canais
      items = data;
    }

    // ---------------------------------------------------------
    // A MÁGICA ACONTECE AQUI:
    // Transforma os links .ts em .m3u8 antes de enviar pro Frontend
    // ---------------------------------------------------------
    const itemsTratados = items.map((canal: any) => {
      if (canal.iframe && typeof canal.iframe === 'string') {
        // Esta expressão regular (Regex) troca o .ts por .m3u8 
        // e preserva qualquer coisa que venha depois (como ?token=123)
        const novoLink = canal.iframe.replace(/\.ts(\?|$)/i, '.m3u8$1');
        
        return {
          ...canal,
          iframe: novoLink
        };
      }
      return canal;
    });

    return NextResponse.json({
      total,
      page: count ? page : 1,
      count: count ?? itemsTratados.length,
      items: itemsTratados, // Retornamos a lista tratada
    });
  } catch (error) {
    console.error('[api/canais_tv] Erro ao ler canais_tv.json:', error);
    return NextResponse.json({ error: 'Erro interno ao carregar canais' }, { status: 500 });
  }
}