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
          <input
            type="url"
            required
            className="w-full bg-input border border-ring rounded-md px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="https://cdn.cnvsplay.com/..."
            value={formData.video}
            onChange={(e) =>
              onFormDataChange({
                ...formData,
                video: e.target.value,
                URLvideo: e.target.value,
              })
            }
          />
        </div>
      )}

      {/* Episodes for Series */}
      {(activeTab === "series" || activeTab === "animes") && (
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
