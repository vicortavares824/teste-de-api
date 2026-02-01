import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/admin/streamp2p/list-files
 * Consulta o endpoint /api/v1/user/file do StreamP2P e agrega todas as páginas
 * Query params suportados (opcionais): perPage, page (inicia a partir desta), maxPages (0 = sem limite)
 */
export async function GET(request: NextRequest) {
  try {
    const apiToken = process.env.STREAMP2P_API_TOKEN || process.env.STREAMP2P_API_KEY
    if (!apiToken) {
      return NextResponse.json({ error: 'STREAMP2P_API_TOKEN não configurado' }, { status: 500 })
    }

    const streamp2pBase = 'https://streamp2p.com/api/v1'
    const headers: Record<string, string> = {
      'api-token': apiToken,
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    }

  const url = new URL(request.url)
  const perPage = Math.max(1, Math.min(500, Number(url.searchParams.get('perPage') || '50')))
  let page = Math.max(1, Number(url.searchParams.get('page') || '1'))
  const maxPages = Number(url.searchParams.get('maxPages') || '0') // 0 = sem limite
  const folder = url.searchParams.get('folder') || ''
  const debug = url.searchParams.get('debug') === '1'

  const allFiles: any[] = []
  let pagesFetched = 0
  let rawSample: any = null

    // Endpoints candidatos (tente /user/file primeiro, depois /video/manage)
    const endpoints = [
      `${streamp2pBase}/user/file`,
      `${streamp2pBase}/video/manage`,
    ]

    const debugResponses: Record<string, any> = {}

    let found = false

    for (const baseEnd of endpoints) {
      // reset paging for each endpoint
      page = Math.max(1, Number(url.searchParams.get('page') || '1'))
      let pagesFetchedForEndpoint = 0

      while (true) {
        let fetchUrl = `${baseEnd}?page=${page}&perPage=${perPage}`
        if (folder) fetchUrl += `&folder=${encodeURIComponent(folder)}`
        const res = await fetch(fetchUrl, { headers })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        return NextResponse.json({ error: 'Erro ao consultar StreamP2P', status: res.status, detail: text }, { status: 502 })
      }

  const json = await res.json()

  // capture raw sample for this endpoint (first page)
  if (debug && !debugResponses[baseEnd]) debugResponses[baseEnd] = json

      // Tentar localizar a lista de arquivos em várias chaves possíveis
      let data: any[] = []
      if (Array.isArray(json.data)) data = json.data
      else if (Array.isArray(json.data?.files)) data = json.data.files
      else if (Array.isArray(json.files)) data = json.files
      else if (Array.isArray(json.items)) data = json.items
      else if (Array.isArray(json.results)) data = json.results
      else if (Array.isArray(json.result)) data = json.result
      else if (Array.isArray(json.data?.items)) data = json.data.items
      else {
        // como fallback, se o body inteiro for um array, use ele
        if (Array.isArray(json)) data = json
      }

      const metadata = json.metadata || json.meta || {}

  // empilhar
  allFiles.push(...data)

  // se em modo debug, capture uma amostra do JSON bruto (não redeclare)
  if (debug && rawSample == null) rawSample = json
  pagesFetched++
  pagesFetchedForEndpoint++

      // Condições de parada
      if (!data.length) break
      if (typeof metadata.total === 'number' && allFiles.length >= metadata.total) break
      if (maxPages > 0 && pagesFetched >= maxPages) break
      if (pagesFetched >= 200) break // safety cap to avoid runaway loops

        page += 1
      }

      if (allFiles.length) {
        found = true
        break
      }
      // se não encontrou em um endpoint, passe para o próximo
    }

    const resp: any = { success: true, files: allFiles, pagesFetched, totalFetched: allFiles.length }
    if (debug) {
      resp.rawSample = rawSample
      resp.debugResponses = debugResponses
    }
  return NextResponse.json(resp)
  } catch (err: any) {
    console.error('[streamp2p/list-files] error', err)
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
  }
}
