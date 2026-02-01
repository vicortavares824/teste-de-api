"use client"

import type React from "react"

import { useState } from "react"
import { PlayIcon } from "@heroicons/react/24/outline"
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
                    if (!formData.videoStreamp) return alert('Preencha a URL Streamp2P para publicar')
                    try {
                      const res = await fetch('/api/admin/publish', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ tmdbId: formData.id, tmdbType: 'movie', mp4Url: formData.videoStreamp }),
                      })
                      if (!res.ok) {
                        const err = await res.json().catch(() => ({ error: 'Erro' }))
                        alert('Falha ao publicar: ' + (err.error || JSON.stringify(err)))
                        return
                      }
                      const data = await res.json()
                      // atualizar URLTxt com retorno (não substitui o campo principal ainda)
                      onFormDataChange({ ...formData, URLTxt: data.URLTxt || formData.URLTxt })
                      alert('Publicação Streamp2P concluída. URLTxt: ' + (data.URLTxt || 'não retornado'))
                    } catch (err) {
                      alert('Erro ao publicar: ' + err)
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
                    if (!formData.txtUrl) return alert('Preencha a URL TXT antes de buscar o m3u8')
                    try {
                      setIsFetchingTxt(true)
                      alert('Buscando m3u8...')
                      const normalized = normalizeTxtIndex(formData.txtUrl)
                      if (normalized && normalized !== formData.txtUrl) {
                        alert(`Transformando TXT:\n${formData.txtUrl}\n→\n${normalized}`)
                      }
                      const proxyRes = await fetch(`/api/proxy?url=${encodeURIComponent(normalized || '')}`)
                      if (!proxyRes.ok) {
                        const err = await proxyRes.text().catch(() => 'Erro ao chamar proxy')
                        alert('Falha ao gerar m3u8 via proxy: ' + err)
                        return
                      }
                      const proxiedUrl = (await proxyRes.text()).trim()
                      // substituir o input principal de adicionar filme (video) com o m3u8
                      onFormDataChange({ ...formData, video: proxiedUrl, URLTxt: proxiedUrl })
                      alert('m3u8 obtido e definido como URL principal para adicionar o filme')
                    } catch (err) {
                      alert('Erro ao buscar m3u8: ' + err)
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
                <input
                  type="text"
                  readOnly
                  value={(formData.video && formData.video.trim()) || (formData.URLTxt && formData.URLTxt.trim()) || ''}
                  onClick={(e) => { if ((e.target as HTMLInputElement).value) navigator.clipboard?.writeText((e.target as HTMLInputElement).value) }}
                  className="w-full bg-muted/30 border border-border rounded-md px-3 py-2 text-sm text-foreground"
                />
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
                  alert('⚠️ Preencha temporada, episódio e URL para publicar')
                  return
                }
                try {
                  if (currentEpisodeUrl.toLowerCase().endsWith('.txt')) {
                    const normalized = normalizeTxtIndex(currentEpisodeUrl)
                    if (normalized && normalized !== currentEpisodeUrl) {
                      alert(`Transformando TXT:\n${currentEpisodeUrl}\n→\n${normalized}`)
                    }
                    const proxyRes = await fetch(`/api/proxy?url=${encodeURIComponent(normalized || '')}`)
                    if (!proxyRes.ok) {
                      const err = await proxyRes.text().catch(() => 'Erro ao chamar proxy')
                      alert('Falha ao gerar m3u8 via proxy: ' + err)
                      return
                    }
                    const proxiedUrl = await proxyRes.text()
                    // Atualizar o campo de episódio atual (essa URL será usada ao adicionar episódio)
                    setCurrentEpisodeUrl(proxiedUrl.trim())
                    alert('Publicação do episódio concluída. URLTxt: ' + proxiedUrl.trim())
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
                    alert('Falha ao publicar: ' + (err.error || JSON.stringify(err)))
                    return
                  }

                  const data = await res.json()
                  setCurrentEpisodeUrl(data.URLTxt || currentEpisodeUrl)
                  alert('Publicação concluída. URLTxt: ' + (data.URLTxt || 'não retornado'))
                } catch (e) {
                  alert('Erro ao publicar: ' + e)
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
                    if (!currentEpisodeUrl) return alert('Preencha a URL do episódio antes de buscar o m3u8')
                    if (!currentEpisodeUrl.toLowerCase().endsWith('.txt')) return alert('A URL do episódio precisa ser um .txt')
                    try {
                      setIsFetchingEpisodeTxt(true)
                      const normalized = normalizeTxtIndex(currentEpisodeUrl)
                      if (normalized && normalized !== currentEpisodeUrl) {
                        alert(`Transformando TXT:\n${currentEpisodeUrl}\n→\n${normalized}`)
                      }
                      const proxyRes = await fetch(`/api/proxy?url=${encodeURIComponent(normalized || '')}`)
                      if (!proxyRes.ok) {
                        const err = await proxyRes.text().catch(() => 'Erro ao chamar proxy')
                        alert('Falha ao gerar m3u8 via proxy: ' + err)
                        return
                      }
                      const proxiedUrl = (await proxyRes.text()).trim()
                      setCurrentEpisodeUrl(proxiedUrl)
                      alert('m3u8 obtido para episódio. URLTxt: ' + proxiedUrl)
                    } catch (e) {
                      alert('Erro ao buscar m3u8 do episódio: ' + e)
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
