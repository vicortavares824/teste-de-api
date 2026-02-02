import { NextRequest, NextResponse } from 'next/server'

/**
 * API para processar arquivo StreamP2P completo
 * POST /api/admin/process-streamp2p
 * 
 * Fluxo:
 * 1. Extrai .m3u8 do arquivo StreamP2P
 * 2. Busca na TMDB usando o título
 * 3. Retorna todos os dados prontos para o formulário
 */

export async function POST(req: NextRequest) {
  try {
    const { fileId, fileName, mediaType } = await req.json()

    if (!fileId || !fileName) {
      return NextResponse.json(
        { error: 'fileId e fileName são obrigatórios' },
        { status: 400 }
      )
    }

    // 1. Montar URL base StreamP2P
    const streamP2pUrl = `https://cinestreamtent.strp2p.live/#${fileId}`

    // 2. Extrair .m3u8
    let m3u8Url = streamP2pUrl
    try {
      const extractResponse = await fetch('http://localhost:3000/api/admin/extract-m3u8', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId,
          streamUrl: streamP2pUrl,
        }),
      }).catch(() => null)

      if (extractResponse?.ok) {
        const data = await extractResponse.json()
        m3u8Url = data.m3u8Url || streamP2pUrl
      }
    } catch (error) {
      console.warn('Erro ao extrair .m3u8:', error)
    }

    // 3. Buscar na TMDB
    const type = mediaType || 'movie'
    const tmdbSearchResponse = await fetch(
      `http://localhost:3000/api/admin/search-tmdb?query=${encodeURIComponent(fileName)}&type=${type}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    )

    if (!tmdbSearchResponse.ok) {
      throw new Error('Erro ao buscar na TMDB')
    }

    const searchData = await tmdbSearchResponse.json()

    if (!searchData.results || searchData.results.length === 0) {
      // Se não encontrar, retornar dados parciais
      return NextResponse.json({
        success: false,
        message: `Nenhum resultado encontrado para "${fileName}" na TMDB`,
        partialData: {
          streamUrl: streamP2pUrl,
          m3u8Url,
          fileName,
          needsManualTMDBSearch: true,
        },
      }, { status: 404 })
    }

    const firstResult = searchData.results[0]

    // 4. Buscar dados completos
    const tmdbDataResponse = await fetch(
      `http://localhost:3000/api/admin/fetch-tmdb?id=${firstResult.id}&type=${type}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    )

    if (!tmdbDataResponse.ok) {
      throw new Error('Erro ao carregar dados completos da TMDB')
    }

    const tmdbData = await tmdbDataResponse.json()

    // 5. Retornar dados formatados para o formulário
    return NextResponse.json({
      success: true,
      message: `Arquivo processado com sucesso`,
      formData: {
        id: String(tmdbData.id),
        title: tmdbData.title || '',
        name: tmdbData.name || '',
        original_title: tmdbData.original_title || '',
        original_name: tmdbData.original_name || '',
        poster_path: tmdbData.poster_path || '',
        backdrop_path: tmdbData.backdrop_path || '',
        overview: tmdbData.overview || '',
        release_date: tmdbData.release_date || '',
        first_air_date: tmdbData.first_air_date || '',
        vote_average: String(tmdbData.vote_average || 0),
        vote_count: String(tmdbData.vote_count || 0),
        popularity: String(tmdbData.popularity || 0),
        genre_ids: (tmdbData.genre_ids || []).join(', '),
        original_language: tmdbData.original_language || 'pt',
        adult: tmdbData.adult || false,
        video: fileName,
        URLvideo: m3u8Url,
        URLTxt: streamP2pUrl,
      },
      metadata: {
        streamP2pUrl,
        m3u8Url,
        tmdbId: tmdbData.id,
        tmdbSearchResult: firstResult,
      },
    })
  } catch (error: any) {
    console.error('Erro ao processar StreamP2P:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao processar arquivo' },
      { status: 500 }
    )
  }
}
