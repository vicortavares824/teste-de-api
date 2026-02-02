"use client"

import type React from "react"

import { useState } from "react"
import { useToast } from '../../../hooks/use-toast'
import { PlayIcon } from "@heroicons/react/24/outline"
import { ClipboardIcon } from '@heroicons/react/24/outline'
import { EpisodeManager } from "./episode-manager"

type MediaType = "filmes" | "series" | "animes"

interface FormData {
  id: string
  title: string
  name: string
  original_title: string
  original_name: string
  video: string
  URLvideo: string
  videoStreamp?: string | null
  URLTxt?: string | null
  txtUrl?: string | null
  poster_path: string
  backdrop_path: string
  overview: string
  release_date: string
  first_air_date: string
  vote_average: string
  vote_count: string
  popularity: string
  genre_ids: string
  original_language: string
  adult: boolean
  temporadas: { [key: string]: { [key: string]: string } }
}

interface MediaFormProps {
  formData: FormData
  onFormDataChange: (data: FormData) => void
  onSubmit: (e: React.FormEvent) => void
  activeTab: MediaType
  loading: boolean
  loadingTMDB: boolean
}

export function MediaForm({ formData, onFormDataChange, onSubmit, activeTab, loading, loadingTMDB }: MediaFormProps) {
  const [currentSeason, setCurrentSeason] = useState("")
  const [currentEpisode, setCurrentEpisode] = useState("")
  const [currentEpisodeUrl, setCurrentEpisodeUrl] = useState("")
  const [episodeMessage, setEpisodeMessage] = useState("")
  const [isFetchingTxt, setIsFetchingTxt] = useState(false)
  const [isFetchingEpisodeTxt, setIsFetchingEpisodeTxt] = useState(false)
  const [publishResult, setPublishResult] = useState<any>(null)
  const { toast } = useToast()

  // Normaliza URLs de index-...-a1.txt substituindo -f<N>- por -f1- (ex: index-f2-v1-a1.txt -> index-f1-v1-a1.txt)
  const normalizeTxtIndex = (rawUrl: string | null | undefined) => {
    if (!rawUrl) return rawUrl
    const ensureA1 = (filename: string) => {
      // Se já contém -a{n} antes da extensão, mantém
      const dot = filename.lastIndexOf('.')
      const name = dot >= 0 ? filename.slice(0, dot) : filename
      const ext = dot >= 0 ? filename.slice(dot) : ''
      if (/-a\d+$/i.test(name)) return name + ext
      return name + '-a1' + ext
    }

    try {
      const u = new URL(rawUrl)
      const parts = u.pathname.split('/')
      const last = parts.pop() || ''
      if (last.toLowerCase().includes('index')) {
        let newLast = last.replace(/-f\d+-/i, '-f1-')
        newLast = ensureA1(newLast)
        parts.push(newLast)
        u.pathname = parts.join('/')
        return u.toString()
      }
      return rawUrl
    } catch (e) {
      // se não for URL absoluta, aplica transformações no próprio string
      try {
        const parts = rawUrl.split('/')
        const last = parts.pop() || ''
        if (/index/i.test(last)) {
          let newLast = last.replace(/-f\d+-/i, '-f1-')
          newLast = ensureA1(newLast)
          parts.push(newLast)
          return parts.join('/')
        }
      } catch (e2) {
        // fallback
      }
      return rawUrl.replace(/-f\d+-/i, '-f1-')
    }
  }
  

  const addEpisode = () => {
    if (!currentSeason || !currentEpisode || !currentEpisodeUrl) {
      setEpisodeMessage("⚠️ Preencha temporada, episódio e URL")
      return
    }

    const seasonKey = `temporada_${currentSeason}`
    const episodeKey = `eps_${currentEpisode.padStart(2, "0")}`

    onFormDataChange({
      ...formData,
      temporadas: {
        ...formData.temporadas,
        [seasonKey]: {
          ...(formData.temporadas[seasonKey] || {}),
          [episodeKey]: currentEpisodeUrl,
        },
      },
    })

    setCurrentEpisode("")
    setCurrentEpisodeUrl("")
    setEpisodeMessage("✅ Episódio adicionado!")
    setTimeout(() => setEpisodeMessage(""), 2000)
  }

  const removeEpisode = (season: string, episode: string) => {
    const newTemporadas = { ...formData.temporadas }
    delete newTemporadas[season][episode]

    if (Object.keys(newTemporadas[season]).length === 0) {
      delete newTemporadas[season]
    }

    onFormDataChange({ ...formData, temporadas: newTemporadas })
  }

  return (
    <form onSubmit={onSubmit} className="bg-card border border-border rounded-lg shadow-sm p-6 space-y-6">
      {/* Image Preview */}
      {(formData.poster_path || formData.backdrop_path) && (
        <div className="grid md:grid-cols-2 gap-6">
          {formData.poster_path && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Poster</p>
              <img
                src={`https://image.tmdb.org/t/p/w500${formData.poster_path}`}
                alt="Poster"
                className="w-full rounded-md shadow-md border border-border"
              />
            </div>
          )}
          {formData.backdrop_path && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Backdrop</p>
              <img
                src={`https://image.tmdb.org/t/p/w500${formData.backdrop_path}`}
                alt="Backdrop"
                className="w-full rounded-md shadow-md border border-border"
              />
            </div>
          )}
        </div>
      )}

      {/* Media Info */}
      <div className="bg-muted/50 rounded-md p-6 border border-border">
        <p className="text-sm font-semibold text-muted-foreground mb-2">
          {activeTab === "filmes" ? "Filme" : activeTab === "series" ? "Série" : "Anime"} Selecionado
        </p>
        <h3 className="text-2xl font-bold text-foreground mb-3">
          {activeTab === "filmes" ? formData.title : formData.name}
        </h3>
        <p className="text-foreground leading-relaxed">{formData.overview}</p>
        
        {/* StreamP2P Info */}
        {(formData.video || formData.URLTxt) && (
          <div className="mt-4 pt-4 border-t border-border space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">📦 Dados StreamP2P</p>
            {formData.video && (
              <div className="text-xs">
                <span className="text-muted-foreground">Arquivo: </span>
                <span className="text-foreground font-mono">{formData.video}</span>
              </div>
            )}
            {formData.URLTxt && (
              <div className="text-xs">
                <span className="text-muted-foreground">URL Base: </span>
                <a href={formData.URLTxt} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline font-mono break-all">
                  {formData.URLTxt}
                </a>
              </div>
            )}
            {formData.URLvideo && formData.URLvideo !== formData.URLTxt && (
              <div className="text-xs">
                <span className="text-muted-foreground">URL m3u8: </span>
                <span className="text-foreground font-mono break-all text-[10px]">{formData.URLvideo.substring(0, 50)}...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Video URL for Movies */}
      {activeTab === "filmes" && (
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
            <PlayIcon className="w-5 h-5" />
            URL do Vídeo * (Obrigatório)
          </label>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">URL Streamp2P (player/mp4)</label>
              <input
                type="url"
                className="w-full bg-input border border-ring rounded-md px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="https://cinestreamteste.strp2p.site/#afxb5e"
                value={formData.videoStreamp || ''}
                onChange={(e) => onFormDataChange({ ...formData, videoStreamp: e.target.value || null })}
              />
              <div className="mt-2">
                <button
                  type="button"
                  onClick={async () => {
                    // publicar MP4 para streamp2p usando videoStreamp como origem
                    if (!formData.videoStreamp) {
                      toast({ title: 'Preencha a URL Streamp2P', description: 'Forneça a URL Streamp2P antes de publicar.' })
                      return
                    }
                    try {
                      const res = await fetch('/api/admin/publish', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ tmdbId: formData.id, tmdbType: 'movie', mp4Url: formData.videoStreamp }),
                      })
                      if (!res.ok) {
                        const err = await res.json().catch(() => ({ error: 'Erro' }))
                        toast({ title: 'Falha ao publicar', description: String(err.error || JSON.stringify(err)) })
                        return
                      }
                      const data = await res.json()
                      // atualizar URLTxt com retorno (não substitui o campo principal ainda)
                      onFormDataChange({ ...formData, URLTxt: data.URLTxt || formData.URLTxt })
                      setPublishResult(data)
                      toast({ title: 'Publicação Streamp2P concluída', description: data.URLTxt || 'URLTxt não retornado' })
                    } catch (err) {
                      toast({ title: 'Erro ao publicar', description: String(err) })
                    }
                  }}
                  className="px-3 py-2 bg-emerald-600 text-white rounded-md hover:opacity-90 text-sm"
                >
                  Publicar (Streamp2P)
                </button>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">URL TXT (obrigatório para gerar .m3u8)</label>
              <input
                type="url"
                required
                className="w-full bg-input border border-ring rounded-md px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="https://.../index-a1.txt"
                value={formData.txtUrl || ''}
                onChange={(e) => onFormDataChange({ ...formData, txtUrl: e.target.value || null })}
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (!formData.txtUrl) {
                      toast({ title: 'Preencha a URL TXT', description: 'Forneça a URL .txt antes de gerar m3u8.' })
                      return
                    }
                    try {
                      setIsFetchingTxt(true)
                      toast({ title: 'Buscando m3u8', description: 'Aguarde enquanto o m3u8 é gerado via proxy.' })
                      const normalized = normalizeTxtIndex(formData.txtUrl)
                      if (normalized && normalized !== formData.txtUrl) {
                        toast({ title: 'TXT transformado', description: `${formData.txtUrl} → ${normalized}` })
                      }
                      const proxyRes = await fetch(`/api/proxy?url=${encodeURIComponent(normalized || '')}`)
                      if (!proxyRes.ok) {
                        const err = await proxyRes.text().catch(() => 'Erro ao chamar proxy')
                        toast({ title: 'Falha ao gerar m3u8', description: String(err) })
                        return
                      }
                      const proxiedUrl = (await proxyRes.text()).trim()
                      // substituir o input principal de adicionar filme (video) com o m3u8
                      // E também atualizar o campo txtUrl com o resultado
                      onFormDataChange({ ...formData, video: proxiedUrl, URLvideo: proxiedUrl, txtUrl: proxiedUrl })
                      setPublishResult({ URLvideo: proxiedUrl, note: 'm3u8 obtido via proxy' })
                      toast({ title: 'm3u8 obtido', description: 'm3u8 definido como URL principal para adicionar o filme.' })
                    } catch (err) {
                      toast({ title: 'Erro ao buscar m3u8', description: String(err) })
                    } finally {
                      setIsFetchingTxt(false)
                    }
                  }}
                  disabled={isFetchingTxt}
                  className="px-3 py-2 bg-blue-600 text-white rounded-md hover:opacity-90 text-sm disabled:opacity-60"
                >
                  {isFetchingTxt ? 'Buscando...' : 'Buscar m3u8'}
                </button>
                <a href={formData.txtUrl || '#'} target="_blank" rel="noreferrer" className="px-3 py-2 bg-zinc-800 text-zinc-200 rounded-md text-sm">
                  Abrir TXT
                </a>
              </div>
              {/* Input visível mostrando a URL .m3u8 obtida (proxied) */}
              <div className="mt-3">
                <label className="text-sm font-semibold text-foreground mb-1 block">URL m3u8 obtida</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={formData.URLvideo && formData.URLvideo.includes('.m3u8') ? formData.URLvideo : ''}
                    className="flex-1 bg-muted/30 border border-border rounded-md px-3 py-2 text-sm text-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const v = formData.URLvideo && formData.URLvideo.includes('.m3u8') ? formData.URLvideo : ''
                      if (v) {
                        navigator.clipboard?.writeText(v)
                        toast({ title: 'Copiado', description: 'URL m3u8 copiada para a área de transferência' })
                      } else {
                        toast({ title: 'Nada para copiar', description: 'Não há URL m3u8 disponível' })
                      }
                    }}
                    className="px-3 py-2 bg-zinc-800 text-zinc-200 rounded-md text-sm flex items-center gap-2"
                  >
                    <ClipboardIcon className="w-4 h-4" /> Copiar
                  </button>
                </div>

                {/* Painel simples mostrando resultado da última publicação */}
                {publishResult && (
                  <div className="mt-2 p-2 bg-muted/40 border border-border rounded-md text-sm">
                    <div><strong>Resultado:</strong></div>
                    {publishResult.taskId && <div>taskId: {String(publishResult.taskId)}</div>}
                    {publishResult.videoId && <div>videoId: {String(publishResult.videoId)}</div>}
                    {publishResult.URLTxt && <div>URLTxt: <a href={publishResult.URLTxt} target="_blank" rel="noreferrer noopener" className="underline">abrir</a></div>}
                    {publishResult.URLvideo && <div>URLvideo: <span className="break-all">{String(publishResult.URLvideo)}</span></div>}
                    {publishResult.note && <div>nota: {String(publishResult.note)}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Episodes for Series */}
      {(activeTab === "series" || activeTab === "animes") && (
        <div className="space-y-4">
          <EpisodeManager
            temporadas={formData.temporadas}
            currentSeason={currentSeason}
            onSeasonChange={setCurrentSeason}
            currentEpisode={currentEpisode}
            onEpisodeChange={setCurrentEpisode}
            currentEpisodeUrl={currentEpisodeUrl}
            onEpisodeUrlChange={setCurrentEpisodeUrl}
            onAddEpisode={addEpisode}
            onRemoveEpisode={removeEpisode}
            message={episodeMessage}
          />
          <div className="flex gap-2">
                <button
              type="button"
              onClick={async () => {
                  if (!currentSeason || !currentEpisode || !currentEpisodeUrl) {
                    toast({ title: 'Preencha dados do episódio', description: 'Temporada, episódio e URL são obrigatórios.' })
                    return
                  }
                try {
                  if (currentEpisodeUrl.toLowerCase().endsWith('.txt')) {
                    const normalized = normalizeTxtIndex(currentEpisodeUrl)
                    if (normalized && normalized !== currentEpisodeUrl) {
                      toast({ title: 'TXT transformado', description: `${currentEpisodeUrl} → ${normalized}` })
                    }
                    const proxyRes = await fetch(`/api/proxy?url=${encodeURIComponent(normalized || '')}`)
                    if (!proxyRes.ok) {
                      const err = await proxyRes.text().catch(() => 'Erro ao chamar proxy')
                      toast({ title: 'Falha ao gerar m3u8', description: String(err) })
                      return
                    }
                    const proxiedUrl = await proxyRes.text()
                    // Atualizar o campo de episódio atual (essa URL será usada ao adicionar episódio)
                    setCurrentEpisodeUrl(proxiedUrl.trim())
                      setPublishResult({ URLvideo: proxiedUrl.trim(), note: 'episódio m3u8 obtido' })
                      toast({ title: 'Episódio publicado (proxy)', description: proxiedUrl.trim() })
                    return
                  }

                  // fallback: publish via API de upload
                  const res = await fetch('/api/admin/publish', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tmdbId: formData.id, tmdbType: 'tv', mp4Url: currentEpisodeUrl }),
                  })

                  if (!res.ok) {
                    const err = await res.json().catch(() => ({ error: 'Erro' }))
                    toast({ title: 'Falha ao publicar', description: String(err.error || JSON.stringify(err)) })
                    return
                  }

                  const data = await res.json()
                  setCurrentEpisodeUrl(data.URLTxt || currentEpisodeUrl)
                  setPublishResult(data)
                  toast({ title: 'Publicação concluída', description: data.URLTxt || 'URLTxt não retornado' })
                } catch (e) {
                  toast({ title: 'Erro ao publicar', description: String(e) })
                }
              }}
              className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:opacity-90 text-sm font-medium"
            >
              Publicar Episódio (streamp2p)
            </button>
                <button
                  type="button"
                  disabled={isFetchingEpisodeTxt}
                  onClick={async () => {
                    if (!currentEpisodeUrl) {
                      toast({ title: 'Preencha a URL do episódio', description: 'Forneça a URL antes de buscar m3u8.' })
                      return
                    }
                    if (!currentEpisodeUrl.toLowerCase().endsWith('.txt')) {
                      toast({ title: 'URL inválida', description: 'A URL do episódio precisa ser um .txt' })
                      return
                    }
                    try {
                      setIsFetchingEpisodeTxt(true)
                      const normalized = normalizeTxtIndex(currentEpisodeUrl)
                      if (normalized && normalized !== currentEpisodeUrl) {
                        toast({ title: 'TXT transformado', description: `${currentEpisodeUrl} → ${normalized}` })
                      }
                      const proxyRes = await fetch(`/api/proxy?url=${encodeURIComponent(normalized || '')}`)
                      if (!proxyRes.ok) {
                        const err = await proxyRes.text().catch(() => 'Erro ao chamar proxy')
                        alert('Falha ao gerar m3u8 via proxy: ' + err)
                        return
                      }
                      const proxiedUrl = (await proxyRes.text()).trim()
                      setCurrentEpisodeUrl(proxiedUrl)
                      setPublishResult({ URLvideo: proxiedUrl, note: 'episódio m3u8 obtido' })
                      toast({ title: 'm3u8 obtido', description: proxiedUrl })
                    } catch (e) {
                      toast({ title: 'Erro ao buscar m3u8 do episódio', description: String(e) })
                    } finally {
                      setIsFetchingEpisodeTxt(false)
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:opacity-90 text-sm"
                >
                  {isFetchingEpisodeTxt ? 'Buscando...' : 'Buscar m3u8'}
                </button>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading || loadingTMDB}
        className={`w-full py-3 rounded-md font-semibold transition-all flex items-center justify-center gap-2 ${
          loading || loadingTMDB
            ? "bg-muted text-muted-foreground cursor-not-allowed"
            : "bg-primary text-primary-foreground hover:opacity-90"
        }`}
      >
        {loading ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current" />
            Enviando...
          </>
        ) : (
          "Adicionar " + (activeTab === "filmes" ? "Filme" : activeTab === "series" ? "Série" : "Anime")
        )}
      </button>
    </form>
  )
}
