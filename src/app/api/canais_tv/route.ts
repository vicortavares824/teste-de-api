export const runtime = 'nodejs';

import { NextResponse, NextRequest } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

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

    // ---------------------------------------------------------
    // SISTEMA DE BLOQUEIO DE CONTEÚDO ADULTO
    // ---------------------------------------------------------
    let filteredData = data;
    
    // Se a tag '?adult=true' NÃO foi passada, nós removemos os canais +18
    if (!showAdult) {
      filteredData = data.filter((canal: any) => {
        const title = (canal.title || '').toLowerCase();
        // Caso seu JSON tenha um campo "group" ou "category" para as categorias
        const group = (canal.group || canal.category || '').toLowerCase(); 
        
        // Adicione aqui as palavras que identificam os canais que devem ser escondidos
        const isAdultChannel = 
          group.includes('adulto') || 
          group.includes('xxx') || 
          group.includes('18+') || 
          title.includes('playboy') || 
          title.includes('sexy') || 
          title.includes('venus') ||
          title.includes('xxx') ||
          title.includes('BRASILEIRINHAS')
          ||
          title.includes('sextreme')

        // Se for canal adulto (true), o '!' inverte para 'false' e ele é removido da lista
        return !isAdultChannel; 
      });
    }

    // Paginação agora usa a lista já filtrada
    const total = filteredData.length;
    let items = filteredData;

    if (count) {
      const offset = Math.max(0, (page - 1) * count);
      items = filteredData.slice(offset, offset + count);
    } else {
      items = filteredData;
    }

    return NextResponse.json({
      total,
      page: count ? page : 1,
      count: count ?? items.length,
      items: items,
    });
  } catch (error) {
    console.error('[api/canais_tv] Erro ao ler canais_tv.json:', error);
    return NextResponse.json({ error: 'Erro interno ao carregar canais' }, { status: 500 });
  }
}