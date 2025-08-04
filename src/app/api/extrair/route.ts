
import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get('tipo'); // 'filme' ou 'serie'
  const id = searchParams.get('id');
  const temporada = searchParams.get('temporada') || '1';
  const episodio = searchParams.get('episodio') || '1';

  if (!tipo || !id) {
    return NextResponse.json({ error: 'Parâmetros obrigatórios: tipo e id' }, { status: 400 });
  }

  let urlPlayer = '';
  if (tipo === 'filme') {
    urlPlayer = `https://playerflixapi.com/filme/${id}`;
  } else if (tipo === 'serie') {
    urlPlayer = `https://playerflixapi.com/serie/${id}/${temporada}/${episodio}`;
  } else {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
  }

  let browser: any = null;
  try {
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    // Cria uma página em branco com um iframe apontando para o player
    await page.setContent(`<!DOCTYPE html><html><body><iframe id="playerframe" src="${urlPlayer}" style="width:100vw;height:100vh;"></iframe></body></html>`);
    // Aguarda o iframe carregar
    const frame = await page.waitForSelector('#playerframe');
    const playerFrame = await frame.contentFrame();
    if (!playerFrame) throw new Error('Não foi possível acessar o conteúdo do iframe (possível CORS)');
    await playerFrame.waitForSelector('.player-btn', { timeout: 10000 });
    const players = await playerFrame.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.player-btn'));
      return btns.map(btn => {
        const onclick = btn.getAttribute('onclick');
        const match = onclick && onclick.match(/callPlayer\("(https?:\/\/[^\"]+)/);
        const url = match ? match[1] : null;
        const nome = btn.querySelector('.player-name')?.textContent?.trim() || '';
        const descricao = btn.querySelector('.player-description')?.textContent?.trim() || '';
        return { url, nome, descricao };
      }).filter(p => p.url);
    });
    const filtrado = players.find(p => p.url && p.url.startsWith('https://llanfairpwllgwyngyllgo.com/video/'));
    if (filtrado) {
      return NextResponse.json(filtrado);
    } else {
      return new Response('Nenhum player llanfairpwllgwyngyllgo encontrado', { status: 404, headers: { 'Content-Type': 'text/plain' } });
    }
  } catch (e) {
    return NextResponse.json({ error: 'Erro ao buscar página do player', detalhes: e instanceof Error ? e.message : String(e), urlPlayer }, { status: 500 });
  } finally {
    if (browser) await browser.close();
  }
}
