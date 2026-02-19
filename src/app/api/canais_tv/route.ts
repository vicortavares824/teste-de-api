export const runtime = 'nodejs';

import { NextResponse, NextRequest } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

const ADULT_KEYWORDS = [
  'adulto', 'xxx', '18+', '+18', 'playboy', 'sexy',
  'venus', 'brasileirinhas', 'sextreme', 'privê', 'for man'
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const countParam = Number(searchParams.get('count'));
    const pageParam = Number(searchParams.get('page'));

    // Tag especial para liberar conteúdo adulto
    const showAdult = searchParams.get('adult') === 'true';

    const count = Number.isFinite(countParam) && countParam > 0 ? Math.max(1, Math.floor(countParam)) : undefined;
    const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;

    const filePath = path.resolve(process.cwd(), 'canais_tv.json');
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    if (!Array.isArray(data)) {
      return NextResponse.json({ error: 'Formato inválido: esperado array' }, { status: 500 });
    }

    let filteredData = data;

    if (!showAdult) {
      filteredData = data.filter((canal: any) => {
        // Normaliza os textos para busca (minúsculo e evita erro se for nulo)
        const title = (canal.title || '').toLowerCase();
        const group = (canal.group || canal.category || '').toLowerCase();

        // Verifica se o título ou o grupo contém alguma das palavras proibidas
        const isAdult = ADULT_KEYWORDS.some(word =>
          title.includes(word) || group.includes(word)
        );

        return !isAdult; // mantém se não for adulto
      });
    }

    // Paginação agora usa a lista já filtrada
    const total = filteredData.length;
    let items = filteredData;

    if (count) {
      const offset = Math.max(0, (page - 1) * count);
      items = filteredData.slice(offset, offset + count);
    }

    return NextResponse.json({
      total,
      page: count ? page : 1,
      count: count ?? items.length,
      items,
    });
  } catch (error) {
    console.error('[api/canais_tv] Erro ao ler canais_tv.json:', error);
    return NextResponse.json({ error: 'Erro interno ao carregar canais' }, { status: 500 });
  }
}