import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/admin/publish
 * Body: { tmdbId, tmdbType: 'movie'|'tv', mp4Url, playerUrl?, txtUrl? }
 * Realiza o upload remoto para o StreamP2P e retorna o URLTxt (ou fallback via proxy quando create falha)
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

    // Buscar metadados TMDB para título
    const tmdbUrl = `https://api.themoviedb.org/3/${encodeURIComponent(tmdbType)}/${encodeURIComponent(tmdbId)}?api_key=${encodeURIComponent(tmdbKey)}&language=pt-BR`
    const tmdbRes = await fetch(tmdbUrl)
    const tmdbData = await tmdbRes.json()
    const title = tmdbData.title || tmdbData.name || `media_${tmdbId}`

    // StreamP2P
    const streamp2pBase = 'https://streamp2p.com/api/v1'
    const apiToken = process.env.STREAMP2P_API_TOKEN || process.env.STREAMP2P_API_KEY
    if (!apiToken) {
      return NextResponse.json({ error: 'STREAMP2P_API_TOKEN não configurado' }, { status: 500 })
    }

    const headers: any = {
      'Content-Type': 'application/json',
      'api-token': apiToken,
      'Authorization': `Bearer ${apiToken}`,
    }

    // Criar tarefa de upload remoto
    console.log(`[StreamP2P] Iniciando upload remoto para: ${mp4Url}`)
    const createRes = await fetch(`${streamp2pBase}/video/advance-upload`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url: mp4Url, name: title }),
    })

    // Se create falhar, tentar fallback via playerUrl/txtUrl
    if (!createRes.ok) {
      const errorText = await createRes.text().catch(() => '')
      console.warn('[StreamP2P] Create failed:', createRes.status, errorText)

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
            const m = html.match(/https?:\/\/[^\"\s]+?\.txt/i)
            if (m) originalTxt = m[0]
          }
        } catch (e) {
          console.warn('[StreamP2P] Falha ao buscar playerUrl:', e)
        }
      }

      if (!originalTxt) {
        return NextResponse.json({ error: `Erro StreamP2P (Create): ${errorText}`, status: createRes.status, createStatus: createRes.status, createBody: errorText }, { status: createRes.status })
      }

      const modifiedTxt = originalTxt.replace(/\.txt$/i, '-a1.txt')
      try {
        const proxyUrl = `https://cdn-cinestream.appcinestream.workers.dev/proxy?url=${encodeURIComponent(modifiedTxt)}`
        const proxyRes = await fetch(proxyUrl)
        if (!proxyRes.ok) {
          const ptxt = await proxyRes.text().catch(() => '')
          return NextResponse.json({ error: 'Falha ao buscar proxy', detail: ptxt, fallback: true, originalTxt, modifiedTxt }, { status: 502 })
        }
        const proxied = await proxyRes.text()
        return NextResponse.json({ success: true, fallback: true, originalTxt, modifiedTxt, URLTxt: modifiedTxt, URLvideo: proxied })
      } catch (e: any) {
        console.error('[Publish Fallback Error]', e)
        return NextResponse.json({ error: 'Erro no fallback de publicação', detail: String(e), fallback: true }, { status: 500 })
      }
    }

    const createJson = await createRes.json()
    const taskId = createJson.id
    if (!taskId) {
      return NextResponse.json({ error: 'ID da tarefa não retornado pelo StreamP2P' }, { status: 500 })
    }

    // Polling
    let videoId: any = null
    const maxAttempts = 30
    console.log(`[StreamP2P] Aguardando conclusão da tarefa: ${taskId}`)
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 5000))
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
      return NextResponse.json({ error: 'Timeout aguardando conclusão do upload no StreamP2P', taskId, attempts: maxAttempts }, { status: 408 })
    }

    const urlTxt = `https://streamp2p.com/v/${videoId}.txt`
    const playerUrl = `https://streamp2p.com/v/${videoId}`

    return NextResponse.json({ success: true, taskId, videoId, URLTxt: urlTxt, playerUrl, title, createResponse: createJson })
  } catch (err: any) {
    console.error('[Publish Error]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
