import { NextResponse } from "next/server"

// Lista de URLs base para tentar para séries
const STREAM_API_URLS = [
  "https://baby-beamup.club/stream/series",
  "https://da5f663b4690-skyflixfork.baby-beamup.club/stream/series",
]

export async function GET(request: Request, { params }: { params: { params: string[] } }) {
  const [imdbId, season, episode] = params.params

  if (!imdbId || !season || !episode) {
    return NextResponse.json({ error: "IMDb ID, temporada e episódio são necessários." }, { status: 400 })
  }

  const streamId = `${imdbId}:${season}:${episode}`
  console.log(`[API/Stream/Series] Recebida requisição para: ${streamId}`)

  for (const baseUrl of STREAM_API_URLS) {
    try {
      const fullUrl = `${baseUrl}/${streamId}.json`
      console.log(`[API/Stream/Series] Tentando buscar streams de: ${fullUrl}`)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)

      const response = await fetch(fullUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          Accept: "application/json, text/plain, */*",
        },
      })

      clearTimeout(timeoutId)

      console.log(`[API/Stream/Series] Resposta de ${baseUrl} para ${streamId}: Status ${response.status}`)

      if (!response.ok) {
        continue
      }

      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        console.warn(`[API/Stream/Series] Resposta de ${baseUrl} não é JSON.`)
        continue
      }

      const data = await response.json()
      console.log(`[API/Stream/Series] Sucesso com ${baseUrl}! Streams encontrados: ${data.streams?.length || 0}`)
      return NextResponse.json(data)
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.error(`[API/Stream/Series] Timeout na requisição para ${baseUrl}/${streamId}`)
      } else {
        console.error(`[API/Stream/Series] Erro inesperado com ${baseUrl} para ${streamId}:`, error.message)
      }
    }
  }

  console.error(`[API/Stream/Series] Todas as URLs falharam para ${streamId}`)
  return NextResponse.json({ streams: [], error: "Nenhum stream disponível no momento" }, { status: 200 })
}
