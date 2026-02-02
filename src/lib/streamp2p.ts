/**
 * Utilitários para StreamP2P
 * Extração de URLs .m3u8 e processamento de manifests
 */

export interface StreamP2PFile {
  id: string
  name: string
  poster?: string
  preview?: string
  size?: number
  duration?: number
  resolution?: string
  createdAt?: string
  updatedAt?: string
}

export interface ExtractedStream {
  m3u8Url: string
  hlsUrl?: string
  streamUrl: string
  fileId: string
  fileName: string
  success: boolean
}

/**
 * Constrói a URL base do StreamP2P a partir do ID
 */
export function buildStreamP2PUrl(fileId: string, baseHost = 'cinestreamtent.strp2p.live'): string {
  return `https://${baseHost}/#${fileId}`
}

/**
 * Extrai URL .m3u8 de um bloco de texto
 */
export function extractM3U8FromText(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i)
  return match ? match[0] : null
}

/**
 * Lista possíveis URLs de manifesto para um fileId
 */
export function generateManifestUrls(fileId: string): string[] {
  return [
    `https://asset.syncp2p.com/${fileId}/manifest.txt`,
    `https://asset.syncp2p.com/${fileId}/index.txt`,
    `https://asset.syncp2p.com/${fileId}/playlist.txt`,
    `https://cinestreamtent.strp2p.live/${fileId}/index.txt`,
    `https://sy6.marketprediction.cfd/v4/mf/${fileId}/index-f1-v1-a1.txt`,
  ]
}

/**
 * Busca uma URL com timeout
 */
export async function fetchWithTimeout(
  url: string,
  timeoutMs = 10000,
  options?: RequestInit
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...options?.headers,
      },
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Processa um arquivo StreamP2P completo
 */
export async function processStreamP2PFile(
  file: StreamP2PFile
): Promise<ExtractedStream> {
  const fileId = file.id
  const streamUrl = buildStreamP2PUrl(fileId)
  let m3u8Url = streamUrl

  // Tentar buscar manifests conhecidos
  const manifestUrls = generateManifestUrls(fileId)

  for (const manifestUrl of manifestUrls) {
    try {
      const response = await fetchWithTimeout(manifestUrl, 5000)

      if (response.ok) {
        const text = await response.text()
        const m3u8Match = extractM3U8FromText(text)

        if (m3u8Match) {
          m3u8Url = m3u8Match
          break
        }

        // Se não achou .m3u8, procura por linhas que pareçam URLs
        const lines = text.split('\n').filter((l) => l.trim().startsWith('http'))
        if (lines.length > 0) {
          m3u8Url = lines[0].trim()
          break
        }
      }
    } catch (error) {
      console.warn(`Falha ao buscar ${manifestUrl}:`, error)
    }
  }

  return {
    m3u8Url,
    streamUrl,
    fileId,
    fileName: file.name,
    success: m3u8Url !== streamUrl || streamUrl === m3u8Url,
  }
}
