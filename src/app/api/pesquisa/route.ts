import { NextResponse } from 'next/server';
import axios from 'axios';
import { BASE_SUPERFLIX_URL } from '../../../url';
import * as cheerio from 'cheerio';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  if (!query) {
    return NextResponse.json({ error: 'Parâmetro de busca "q" obrigatório.' }, { status: 400 });
  }

  // Busca na página de pesquisa do Superflix
  const url = `${BASE_SUPERFLIX_URL}/pesquisar/?p=1&s=${encodeURIComponent(query)}`;
  let html = '';
  try {
    const resp = await axios.get(url);
    html = resp.data;
  } catch (e) {
    return NextResponse.json({ error: 'Erro ao buscar dados do Superflix', detalhes: e instanceof Error ? e.message : e }, { status: 500 });
  }

  // Faz o parse do HTML e extrai as informações dos cards (nova estrutura)
  const $ = cheerio.load(html);
  const resultados: any[] = [];
  // Seleciona todos os <article> dentro do grid de resultados
  $('main .grid > article').each((_, el) => {
    // Capa
    const img = $(el).find('a img').attr('src') || '';
    // Título
    const title = $(el).find('a h3').text().trim();
    // Ano (span logo após o título)
    const ano = $(el).find('a span').text().trim();
    // Link do conteúdo (href do <a>)
    let link = $(el).find('a').attr('href') || '';
    // Corrige link relativo para absoluto
    if (link && !link.startsWith('http')) {
      link = BASE_SUPERFLIX_URL + link;
    }
    // TMDb (botão com data-copy numérico)
    let tmdb = '';
    $(el).find('button[data-copy]').each((_, btn) => {
      const val = $(btn).attr('data-copy') || '';
      // TMDb geralmente é só número e tem texto "TMDb copiado!"
      if (/^\d+$/.test(val) && $(btn).text().toLowerCase().includes('tmdb')) {
        tmdb = val;
      }
    });
    // Score (porcentagem no canto superior direito)
    let score = '';
    const scoreEl = $(el).find('a > div.absolute.top-2.right-2 text');
    if (scoreEl.length) {
      score = scoreEl.text().replace('%', '').trim();
    } else {
      // Alternativa: pega o texto do <text> dentro do SVG
      const svgText = $(el).find('a > div.absolute.top-2.right-2 text').text().replace('%', '').trim();
      if (svgText) score = svgText;
    }
    // Tipo: filme, serie, anime, dorama (deduzido pelo link)
    let tipo = '';
    if (link.includes('/filme/')) tipo = 'Filme';
    else if (link.includes('/serie/')) tipo = 'Série';
    else if (link.includes('/anime/')) tipo = 'Anime';
    else if (link.includes('/dorama/')) tipo = 'Dorama';
    else tipo = 'Desconhecido';
    if (title && link) {
      resultados.push({ title, ano, tipo, img, link, tmdb, score });
    }
  });

  if (resultados.length === 0) {
    return NextResponse.json({ error: 'Nenhum resultado encontrado.' }, { status: 404 });
  }

  return NextResponse.json({ resultados });
}
