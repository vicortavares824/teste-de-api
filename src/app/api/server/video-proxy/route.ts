import { NextResponse } from "next/server"

export const runtime = "nodejs"

// Headers that should never be forwarded or overridden
const BLOCKED_HEADERS = new Set([
"host",
"content-length",
"transfer-encoding",
"connection",
"keep-alive",
"upgrade",
"sec-fetch-mode",
"sec-fetch-site",
"sec-fetch-dest",
"sec-ch-ua",
"sec-ch-ua-mobile",
"sec-ch-ua-platform",
])

function sanitizeHeaders(input: Record<string, string> | undefined | null) {
const out: Record<string, string> = {}
if (!input) return out
for (const [k, v] of Object.entries(input)) {
  const key = k.toLowerCase()
  if (BLOCKED_HEADERS.has(key)) continue
  if (typeof v !== "string" || v.length === 0) continue
  out[key === "referer" ? "Referer" : key === "origin" ? "Origin" : k] = v
}
return out
}

// Build a couple of best-guess referers for sources like {sub}.{domain}.{tld}
function buildRefererCandidates(target: URL): string[] {
const hostParts = target.hostname.split(".")
const baseDomain =
  hostParts.length >= 2 ? `${hostParts.slice(-2).join(".")}` : target.hostname
const rootOrigin = `${target.protocol}//${baseDomain}`
const assetOrigin = `${target.protocol}//${target.hostname}`
// Ensure trailing slash where appropriate
const ensureSlash = (u: string) => (u.endsWith("/") ? u : `${u}/`)
const candidates = [ensureSlash(rootOrigin), ensureSlash(assetOrigin)]
// De-duplicate while preserving order
return Array.from(new Set(candidates))
}

async function proxyOnce(videoUrl: string, headersToSend: HeadersInit) {
return fetch(videoUrl, {
  headers: headersToSend,
  cache: "no-store",
  // Node fetch ignores these browser-only hints (safe to omit)
})
}

export async function GET(request: Request) {
const { searchParams } = new URL(request.url)
const videoUrl = searchParams.get("videoUrl")
const encodedHeaders = searchParams.get("headers")
const rangeHeader = request.headers.get("range")

if (!videoUrl) {
  return new NextResponse("URL do vídeo não fornecida.", { status: 400 })
}

let target: URL
try {
  target = new URL(videoUrl)
} catch {
  return new NextResponse("URL do vídeo inválida.", { status: 400 })
}

console.log(`[VideoProxy] Proxying request to: ${videoUrl}`)

// Base headers
const baseHeaders: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  Accept: "*/*",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8,en-US;q=0.7",
  "Accept-Encoding": "identity", // important for video byte ranges
  Connection: "keep-alive",
}

// Merge user-provided headers (stream may provide proxyHeaders or proxyHeaders.request)
let provided: Record<string, string> = {}
if (encodedHeaders) {
  try {
    const decoded = JSON.parse(decodeURIComponent(encodedHeaders))
    // If the object was the wrapper { request: { ... } }, unwrap it
    const maybeRequest = decoded?.request && typeof decoded.request === "object" ? decoded.request : decoded
    provided = sanitizeHeaders(maybeRequest)
    console.log("[VideoProxy] Using provided headers (sanitized):", provided)
  } catch (e) {
    console.error("[VideoProxy] Erro ao decodificar cabeçalhos:", e)
  }
}

// Forward Range if present
if (rangeHeader) {
  baseHeaders["Range"] = rangeHeader
  console.log(`[VideoProxy] Forwarding Range header: ${rangeHeader}`)
}

// Derive referer candidates from the target URL
const referers = buildRefererCandidates(target)
console.log("[VideoProxy] Referer candidates:", referers)

// Try in order:
// 1) Provided headers as-is (if they already include Referer/Origin)
// 2) Each derived referer candidate merged with provided headers
const attempts: HeadersInit[] = []

// Attempt 0: provided only (if any provided)
if (Object.keys(provided).length > 0) {
  attempts.push({ ...baseHeaders, ...provided })
}

// Attempts with derived referers
for (const ref of referers) {
  const origin = ref.replace(/\/+$/, "")
  const withDerived = {
    ...baseHeaders,
    Referer: ref,
    Origin: origin,
    ...provided, // user-provided should be able to override if needed
  }
  attempts.push(withDerived)
}

// Execute attempts
let lastResponse: Response | null = null
for (let i = 0; i < attempts.length; i++) {
  const headersToSend = attempts[i]
  try {
    console.log(`[VideoProxy] Attempt ${i + 1}/${attempts.length} -> Referer=${(headersToSend as any).Referer || provided.Referer || "none"}`)
    const res = await proxyOnce(videoUrl, headersToSend)
    console.log(`[VideoProxy] Attempt ${i + 1} status: ${res.status}`)

    if (res.ok || res.status === 206) {
      // Build response to client
      const responseHeaders = new Headers()
      const contentType = res.headers.get("Content-Type")
      const contentLength = res.headers.get("Content-Length")
      const acceptRanges = res.headers.get("Accept-Ranges")
      const contentRange = res.headers.get("Content-Range")

      if (contentType) responseHeaders.set("Content-Type", contentType)
      if (contentLength) responseHeaders.set("Content-Length", contentLength)
      if (acceptRanges) responseHeaders.set("Accept-Ranges", acceptRanges)
      if (contentRange) responseHeaders.set("Content-Range", contentRange)

      // No-cache for streaming
      responseHeaders.set("Cache-Control", "no-cache, no-store, must-revalidate")
      responseHeaders.set("Pragma", "no-cache")
      responseHeaders.set("Expires", "0")

      // CORS
      responseHeaders.set("Access-Control-Allow-Origin", "*")
      responseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
      responseHeaders.set("Access-Control-Allow-Headers", "Range, Content-Type")
      responseHeaders.set("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges")

      return new NextResponse(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers: responseHeaders,
      })
    }

    // Keep last response to log/debug
    lastResponse = res

    // If unauthorized/forbidden, try next attempt
    if (res.status === 401 || res.status === 403) continue

    // Other error statuses: break and return diagnostic
    const body = await res.text().catch(() => "")
    console.error(`[VideoProxy] Upstream error ${res.status}: ${body.slice(0, 300)}`)
    return new NextResponse(`Falha ao carregar vídeo: ${res.status} - ${res.statusText}`, {
      status: res.status,
    })
  } catch (error: any) {
    console.error(`[VideoProxy] Attempt ${i + 1} failed:`, error?.message || error)
    lastResponse = null
    continue
  }
}

// If we reached here, all attempts failed (likely 401/403 or token expired)
if (lastResponse) {
  const body = await lastResponse.text().catch(() => "")
  console.error(`[VideoProxy] All attempts failed. Last status ${lastResponse.status}: ${body.slice(0, 300)}`)
  return new NextResponse(
    `Acesso negado pelo provedor (status ${lastResponse.status}). O link pode ter expirado ou requer Referer específico.`,
    { status: lastResponse.status },
  )
}

return new NextResponse("Não foi possível alcançar o provedor de vídeo.", { status: 502 })
}

// Preflight and CORS
export async function OPTIONS() {
return new NextResponse(null, {
  status: 200,
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Range, Content-Type",
    "Access-Control-Max-Age": "86400",
  },
})
}
