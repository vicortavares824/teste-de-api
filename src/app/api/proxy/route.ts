import { NextRequest, NextResponse } from 'next/server';

/**
 * CONVERSOR TXT -> M3U8 (VERSÃO MELHORADA)
 * - Aceita links terminados em .m3u8 para compatibilidade total com players
 * - Tratamento de erro Cloudflare/403
 * - Headers adicionais para bypass
 * - Logs de debug
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // Shortcut: if caller passes ?url=<txt-url> return the player-ready URL
  const providedUrl = searchParams.get('url');
  if (providedUrl) {
    try {
      const raw = decodeURIComponent(providedUrl);
      const b64 = Buffer.from(raw).toString('base64');
      const final = `${request.nextUrl.origin}${request.nextUrl.pathname}?t=${encodeURIComponent(b64)}.m3u8`;
      return new NextResponse(final, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    } catch (err: any) {
      console.error('[ERRO] Falha ao gerar URL final:', err.message);
      return new NextResponse('Falha ao gerar URL final', { status: 500 });
    }
  }

  let targetUrlEncoded = searchParams.get('t');
  const isSegment = searchParams.get('s') === '1';

  if (!targetUrlEncoded) {
    return new NextResponse('URL alvo (t) não fornecida', { status: 400 });
  }

  // Remove .m3u8 do final se presente
  if (targetUrlEncoded.endsWith('.m3u8')) {
    targetUrlEncoded = targetUrlEncoded.replace('.m3u8', '');
  }

  // Decodifica a URL alvo
  let targetUrl = '';
  try {
    targetUrl = Buffer.from(decodeURIComponent(targetUrlEncoded), 'base64').toString('utf-8');
    if (!targetUrl.startsWith('http')) throw new Error();
  } catch (e) {
    targetUrl = decodeURIComponent(targetUrlEncoded);
  }

  console.log('[INFO] Target URL:', targetUrl);
  console.log('[INFO] Is Segment:', isSegment);

  // Headers melhorados para bypass Cloudflare
  const enhancedHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': new URL(targetUrl).origin + '/',
    'Origin': new URL(targetUrl).origin,
    'Connection': 'keep-alive',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'cross-site',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
  };

  try {
    // Fazer fetch com headers melhorados
    const response = await fetch(targetUrl, { 
      headers: enhancedHeaders,
      // Adicionar timeout para evitar travamentos
      signal: AbortSignal.timeout(10000), // 10 segundos
    });

    // Tratamento específico para erro 403 (Cloudflare)
    if (response.status === 403) {
      console.error('[ERRO] HTTP 403 - Cloudflare bloqueou o acesso');
      return new NextResponse(
        JSON.stringify({
          error: 'Acesso bloqueado pelo Cloudflare',
          message: 'O servidor de origem está protegido por Cloudflare e bloqueou esta requisição.',
          suggestions: [
            'Verifique se o domínio permite acesso via API',
            'Considere usar um serviço de proxy/scraping',
            'Entre em contato com o administrador do site',
            'Implemente cache local do conteúdo'
          ],
          targetUrl: targetUrl,
          status: 403
        }),
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Verificar outros erros HTTP
    if (!response.ok) {
      console.error(`[ERRO] HTTP ${response.status} - ${response.statusText}`);
      return new NextResponse(
        `Erro ao acessar URL: HTTP ${response.status}`,
        { status: response.status }
      );
    }

    // LÓGICA DE SEGMENTO
    if (isSegment) {
      console.log('[INFO] Retornando segmento de vídeo');
      const headers = new Headers();
      
      // Detectar Content-Type correto
      const contentType = response.headers.get('content-type') || 'video/mp2t';
      headers.set('Content-Type', contentType);
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Cache-Control', 'public, max-age=31536000'); // Cache de 1 ano para segmentos
      
      return new NextResponse(response.body, { headers });
    }

    // LÓGICA DE CONVERSÃO (TXT -> M3U8)
    const text = await response.text();
    console.log('[INFO] Conteúdo baixado, tamanho:', text.length);

    // Se não contém #EXTM3U, redirecionar para a URL original
    if (!text.includes('#EXTM3U')) {
      console.log('[INFO] Não é M3U8, redirecionando para URL original');
      return NextResponse.redirect(targetUrl);
    }

    console.log('[INFO] Processando playlist M3U8');
    const baseDir = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
    const proxyUrlBase = `${request.nextUrl.origin}${request.nextUrl.pathname}`;

    const lines = text.split('\n');
    const m3u8Lines = lines.map(line => {
      const trimmed = line.trim();
      
      // Linhas vazias ou comentários
      if (!trimmed || trimmed.startsWith('#')) {
        // Trata tags com URI (ex: #EXT-X-MAP:URI="...")
        if (trimmed.includes('URI="')) {
          return trimmed.replace(/URI="([^"]+)"/, (match, uri) => {
            const absUri = uri.startsWith('http') ? uri : new URL(uri, baseDir).href;
            const encoded = Buffer.from(absUri).toString('base64');
            console.log('[DEBUG] URI proxificado:', uri, '->', absUri);
            return `URI="${proxyUrlBase}?t=${encodeURIComponent(encoded)}&s=1"`;
          });
        }
        return trimmed;
      }

      // Resolve link do segmento
      const absSegUrl = trimmed.startsWith('http') ? trimmed : new URL(trimmed, baseDir).href;
      const encodedSeg = Buffer.from(absSegUrl).toString('base64');
      
      // Retorna o link do segmento via proxy
      return `${proxyUrlBase}?t=${encodeURIComponent(encodedSeg)}&s=1`;
    });

    console.log('[INFO] Playlist processado com sucesso');

    return new NextResponse(m3u8Lines.join('\n'), {
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (error: any) {
    console.error('[ERRO] Exceção:', error.message);
    
    // Tratamento específico para timeout
    if (error.name === 'AbortError') {
      return new NextResponse(
        JSON.stringify({
          error: 'Timeout',
          message: 'A requisição demorou muito para responder (>10s)',
          targetUrl: targetUrl
        }),
        { 
          status: 504,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    return new NextResponse(
      JSON.stringify({
        error: error.message,
        targetUrl: targetUrl,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Suporte para OPTIONS (CORS preflight)
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
