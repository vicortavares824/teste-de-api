import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/admin/publish
 * Body: { tmdbId, tmdbType: 'movie'|'tv', mp4Url }
 * Realiza o upload remoto para o StreamP2P e retorna o URLTxt.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tmdbId, tmdbType = 'movie', mp4Url } = body || {}

    if (!tmdbId || !mp4Url) {
      return NextResponse.json({ error: 'tmdbId e mp4Url são obrigatórios' }, { status: 400 })
    }

    const tmdbKey = process.env.TMDB_API_KEY
    if (!tmdbKey) {
      return NextResponse.json({ error: 'TMDB_API_KEY não configurada' }, { status: 500 })
    }

    // 1. Buscar metadados TMDB para o nome do arquivo
    const tmdbUrl = `https://api.themoviedb.org/3/${encodeURIComponent(tmdbType)}/${encodeURIComponent(tmdbId)}?api_key=${encodeURIComponent(tmdbKey)}&language=pt-BR`
    const tmdbRes = await fetch(tmdbUrl)
    const tmdbData = await tmdbRes.json()
    const title = tmdbData.title || tmdbData.name || `media_${tmdbId}`

    // 2. Configurações StreamP2P
    const streamp2pBase = 'https://streamp2p.com/api/v1'
    const apiToken = process.env.STREAMP2P_API_TOKEN || process.env.STREAMP2P_API_KEY

    if (!apiToken) {
      return NextResponse.json({ error: 'STREAMP2P_API_TOKEN não configurado' }, { status: 500 })
    }

    const headers: any = { 
      'Content-Type': 'application/json',
      'api-token': apiToken,
      'Authorization': `Bearer ${apiToken}`
    }

    // 3. Criar tarefa de upload remoto (advance-upload)
    console.log(`[StreamP2P] Iniciando upload remoto para: ${mp4Url}`)
    const createRes = await fetch(`${streamp2pBase}/video/advance-upload`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        url: mp4Url,
        name: title
      })
    })

    if (!createRes.ok) {
      const errorText = await createRes.text().catch(() => '')
      console.warn('[StreamP2P] Create failed:', createRes.status, errorText)

      // Fallback: se o cliente fornecer playerUrl ou txtUrl no body, tentar extrair o TXT e gerar proxy
      const bodyParams = body || {}
      const providedTxt = bodyParams.txtUrl as string | undefined
      const providedPlayer = bodyParams.playerUrl as string | undefined

      let originalTxt: string | null = null

      if (providedTxt) {
        originalTxt = providedTxt
      } else if (providedPlayer) {
        try {
          const playerRes = await fetch(providedPlayer)
          if (playerRes.ok) {
            const html = await playerRes.text()
            // Procurar primeira ocorrência de link .txt
              const m = html.match(/https?:\/\/[^"]+?\.txt/i)
            if (m) originalTxt = m[0]
          }
        } catch (e) {
          console.warn('[StreamP2P] Falha ao buscar playerUrl:', e)
        }
      }

      if (!originalTxt) {
        return NextResponse.json({ error: `Erro StreamP2P (Create): ${errorText}`, status: createRes.status }, { status: createRes.status })
      }

      // Modificar sufixo para -a1.txt
      const modifiedTxt = originalTxt.replace(/\.txt$/i, '-a1.txt')

      try {
        // Chamar nosso proxy para obter a URL proxificada (o proxy retorna o URL final quando ?url= é usado)
        const proxyUrl = `${request.nextUrl.origin}/api/proxy?url=${encodeURIComponent(modifiedTxt)}`
        const proxyRes = await fetch(proxyUrl)
        if (!proxyRes.ok) {
          const ptxt = await proxyRes.text().catch(() => '')
          return NextResponse.json({ error: 'Falha ao buscar proxy', detail: ptxt }, { status: 502 })
        }
        const proxied = await proxyRes.text()

        // Salvar resultado: URLTxt = modifiedTxt, URLvideo = proxied
        return NextResponse.json({ success: true, URLTxt: modifiedTxt, URLvideo: proxied })
      } catch (e: any) {
        console.error('[Publish Fallback Error]', e)
        return NextResponse.json({ error: 'Erro no fallback de publicação', detail: String(e) }, { status: 500 })
      }
    }

    const createJson = await createRes.json()
    const taskId = createJson.id

    if (!taskId) {
      return NextResponse.json({ error: 'ID da tarefa não retornado pelo StreamP2P' }, { status: 500 })
    }

    // 4. Polling para aguardar a conclusão e obter o vídeo ID
    let videoId = null
    const maxAttempts = 30 // 30 tentativas * 5 segundos = 150 segundos
    console.log(`[StreamP2P] Aguardando conclusão da tarefa: ${taskId}`)

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000)) // Esperar 5 segundos

      const statusRes = await fetch(`${streamp2pBase}/video/advance-upload/${taskId}`, { headers })
      if (!statusRes.ok) continue

      const statusJson = await statusRes.json()
      console.log(`[StreamP2P] Status da tarefa ${taskId}: ${statusJson.status}`)

      if (statusJson.status === 'Completed' && statusJson.videos && statusJson.videos.length > 0) {
        videoId = statusJson.videos[0]
        break
      } else if (statusJson.status === 'Failed') {
        return NextResponse.json({ error: `Tarefa de upload falhou: ${statusJson.error || 'Erro desconhecido'}` }, { status: 500 })
      }
    }

    if (!videoId) {
      return NextResponse.json({ error: 'Timeout aguardando conclusão do upload no StreamP2P' }, { status: 408 })
    }

    // 5. Obter o link do player/txt do vídeo
    // Nota: O StreamP2P geralmente gera o link no formato: https://streamp2p.com/v/<videoId>
    // E o arquivo .txt é acessível via: https://streamp2p.com/v/<videoId>.txt
    const urlTxt = `https://streamp2p.com/v/${videoId}.txt`

    return NextResponse.json({
      success: true,
      videoId,
      URLTxt: urlTxt,
      title
    })

  } catch (err: any) {
    console.error('[Publish Error]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
