import { NextResponse } from "next/server"

// Lista de URLs base para tentar
const STREAM_API_URLS = [
  "https://baby-beamup.club/stream/movie",
  "https://da5f663b4690-skyflixfork.baby-beamup.club/stream/movie",
]

export async function GET(request: Request, { params }: any) {
  const { imdbId } = params

  if (!imdbId) {
    console.error("[API/Stream/Movie] Erro: IMDb ID não fornecido na requisição.")
    return NextResponse.json({ error: "IMDb ID é necessário." }, { status: 400 })
  }

  console.log(`[API/Stream/Movie] Recebida requisição para IMDb ID: ${imdbId}`)

  // Tenta cada URL base até encontrar uma que funcione
  for (const baseUrl of STREAM_API_URLS) {
    try {
      const fullUrl = `${baseUrl}/${imdbId}.json`
      console.log(`[API/Stream/Movie] Tentando buscar streams de: ${fullUrl}`)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 segundos

      const response = await fetch(fullUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      })

      clearTimeout(timeoutId)

      console.log(
        `[API/Stream/Movie] Resposta de ${baseUrl} para ${imdbId}: Status ${response.status}, OK: ${response.ok}`,
      )

      if (!response.ok) {
        console.warn(`[API/Stream/Movie] Erro HTTP de ${baseUrl} para ${imdbId}: Status ${response.status}`)
        continue // Tenta a próxima URL
      }

      // Verifica o Content-Type
      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        console.warn(`[API/Stream/Movie] Resposta de ${baseUrl} não é JSON. Content-Type: ${contentType}`)
        continue // Tenta a próxima URL
      }

      let data
      try {
        data = await response.json()
      } catch (jsonError: any) {
        console.error(`[API/Stream/Movie] Erro de parsing JSON de ${baseUrl} para ${imdbId}:`, jsonError.message)
        continue // Tenta a próxima URL
      }

      console.log(
        `[API/Stream/Movie] Sucesso com ${baseUrl}! Streams encontrados para ${imdbId}: ${data.streams ? data.streams.length : 0}`,
      )

      // Se chegou até aqui, encontrou dados válidos
      return NextResponse.json(data)
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.error(`[API/Stream/Movie] Timeout na requisição para ${baseUrl}/${imdbId}`)
      } else {
        console.error(`[API/Stream/Movie] Erro inesperado com ${baseUrl} para ${imdbId}:`, error.message || error)
      }
      // Continua para a próxima URL
    }
  }

  // Se chegou até aqui, nenhuma URL funcionou
  console.error(`[API/Stream/Movie] Todas as URLs falharam para ${imdbId}`)
  return NextResponse.json(
    {
      streams: [],
      error: "Nenhum stream disponível no momento",
    },
    { status: 200 },
  )
}
