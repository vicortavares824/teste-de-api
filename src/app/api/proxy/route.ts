import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'Parâmetro "url" obrigatório.' }, { status: 400 });
  }

  try {
    const resp = await axios.get(url);
    const html = resp.data;
    const $ = cheerio.load(html);
    const iframes = $('iframe').toArray();
    if (iframes.length < 2) {
      return NextResponse.json({ error: 'Menos de 2 iframes encontrados.' }, { status: 404 });
    }
    const secondIframe = $.html(iframes[1]);
    return new Response(secondIframe, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Erro ao buscar ou processar a página', detalhes: e.message }, { status: 500 });
  }
}
