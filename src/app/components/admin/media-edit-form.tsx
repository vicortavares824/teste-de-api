"use client"

import { useState } from "react"
import { XMarkIcon, TvIcon, PlusIcon, TrashIcon, PencilIcon } from "@heroicons/react/24/outline"

interface MediaEditFormProps {
  item: any
  type: "filmes" | "series" | "animes"
  onClose: () => void
  onSave: () => void
}

// Componente auxiliar para gerenciar episódios
function EpisodeManagerEdit({ temporadas, onChange }: { temporadas: any; onChange: (newData: any) => void }) {
  const [currentSeason, setCurrentSeason] = useState("")
  const [currentEpisode, setCurrentEpisode] = useState("")
  const [currentUrl, setCurrentUrl] = useState("")
  const [episodeMessage, setEpisodeMessage] = useState("")
  const [editingEpisode, setEditingEpisode] = useState<{ season: string; episode: string } | null>(null)

  // Extrair apenas as temporadas do objeto
  const getTemporadas = () => {
    const temp: any = {}
    Object.keys(temporadas).forEach((key) => {
      if (key.startsWith("temporada_")) {
        temp[key] = temporadas[key]
      }
    })
    return temp
  }

  const handleAddOrUpdateEpisode = () => {
    if (!currentSeason || !currentEpisode || !currentUrl) {
      setEpisodeMessage("⚠️ Preencha temporada, episódio e URL")
      return
    }

    const seasonKey = `temporada_${currentSeason}`
    const episodeKey = `eps_${currentEpisode.padStart(2, "0")}`

    const updatedTemporadas = {
      ...temporadas,
      [seasonKey]: {
        ...temporadas[seasonKey],
        [episodeKey]: currentUrl,
      },
    }

    onChange(updatedTemporadas)
    setCurrentSeason("")
    setCurrentEpisode("")
    setCurrentUrl("")
    setEditingEpisode(null)
    setEpisodeMessage(editingEpisode ? "✅ Episódio atualizado!" : "✅ Episódio adicionado!")
    setTimeout(() => setEpisodeMessage(""), 3000)
  }

  const handleEditEpisode = (season: string, episode: string, url: string) => {
    const seasonNum = season.replace("temporada_", "")
    const episodeNum = episode.replace("eps_", "")
    
    setCurrentSeason(seasonNum)
    setCurrentEpisode(episodeNum)
    setCurrentUrl(url)
    setEditingEpisode({ season, episode })
    setEpisodeMessage("")
  }

  const handleCancelEdit = () => {
    setCurrentSeason("")
    setCurrentEpisode("")
    setCurrentUrl("")
    setEditingEpisode(null)
    setEpisodeMessage("")
  }

  const handleRemoveEpisode = (season: string, episode: string) => {
    if (!confirm(`Deseja realmente remover este episódio?`)) {
      return
    }

    const updatedTemporadas = { ...temporadas }
    delete updatedTemporadas[season][episode]

    // Se a temporada ficar vazia, remove ela também
    if (Object.keys(updatedTemporadas[season]).length === 0) {
      delete updatedTemporadas[season]
    }

    onChange(updatedTemporadas)
    setEpisodeMessage("✅ Episódio removido!")
    setTimeout(() => setEpisodeMessage(""), 3000)
  }

  const temporadasObj = getTemporadas()

  return (
    <div className="bg-zinc-800/30 rounded-xl p-6 border border-zinc-700 space-y-4">
      <h3 className="flex items-center gap-2 font-bold text-lg text-white">
        <TvIcon className="w-6 h-6" />
        Temporadas e Episódios
      </h3>

      {/* Episode Input */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <input
          type="number"
          placeholder="Temporada"
          className="bg-zinc-900/50 border border-zinc-700 rounded-lg px-4 py-2 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={currentSeason}
          onChange={(e) => setCurrentSeason(e.target.value)}
        />
        <input
          type="number"
          placeholder="Episódio"
          className="bg-zinc-900/50 border border-zinc-700 rounded-lg px-4 py-2 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={currentEpisode}
          onChange={(e) => setCurrentEpisode(e.target.value)}
        />
        <input
          type="url"
          placeholder="URL do episódio"
          className="bg-zinc-900/50 border border-zinc-700 rounded-lg px-4 py-2 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 md:col-span-2"
          value={currentUrl}
          onChange={(e) => setCurrentUrl(e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleAddOrUpdateEpisode}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all"
        >
          {editingEpisode ? (
            <>
              <PencilIcon className="w-5 h-5" />
              Atualizar Episódio
            </>
          ) : (
            <>
              <PlusIcon className="w-5 h-5" />
              Adicionar Episódio
            </>
          )}
        </button>
        {editingEpisode && (
          <button
            type="button"
            onClick={handleCancelEdit}
            className="bg-zinc-700 hover:bg-zinc-600 text-white px-4 py-2 rounded-lg font-medium transition-all"
          >
            Cancelar
          </button>
        )}
      </div>

      {episodeMessage && (
        <p className={`text-sm font-medium ${episodeMessage.includes("✅") ? "text-green-400" : "text-yellow-400"}`}>
          {episodeMessage}
        </p>
      )}

      {/* Episodes List */}
      {Object.keys(temporadasObj).length > 0 && (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {Object.entries(temporadasObj)
            .sort(([a], [b]) => {
              const numA = parseInt(a.replace("temporada_", ""))
              const numB = parseInt(b.replace("temporada_", ""))
              return numA - numB
            })
            .map(([season, episodes]: [string, any]) => (
              <div key={season} className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-700">
                <h4 className="font-semibold text-white mb-2 capitalize">
                  {season.replace("temporada_", "Temporada ")}
                </h4>
                <div className="space-y-2">
                  {Object.entries(episodes)
                    .sort(([a], [b]) => {
                      const numA = parseInt(a.replace("eps_", ""))
                      const numB = parseInt(b.replace("eps_", ""))
                      return numA - numB
                    })
                    .map(([episode, url]: [string, any]) => (
                      <div
                        key={episode}
                        className={`flex items-center justify-between bg-zinc-800/50 p-3 rounded-lg border transition-all ${
                          editingEpisode?.season === season && editingEpisode?.episode === episode
                            ? "border-blue-500 ring-2 ring-blue-500/20"
                            : "border-zinc-700/50"
                        }`}
                      >
                        <div className="min-w-0 flex-1 mr-4">
                          <p className="font-medium text-white capitalize">
                            {episode.replace("eps_", "Episódio ")}
                          </p>
                          <p className="text-xs text-zinc-400 truncate">{url}</p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleEditEpisode(season, episode, url)}
                            className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                            title="Editar episódio"
                          >
                            <PencilIcon className="w-5 h-5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveEpisode(season, episode)}
                            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                            title="Remover episódio"
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

export function MediaEditForm({ item, type, onClose, onSave }: MediaEditFormProps) {
  const [formData, setFormData] = useState(item)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage("")

    try {
      const response = await fetch("/api/admin/edit-media", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          data: formData,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Erro ao atualizar")
      }

      setMessage("✅ Atualizado com sucesso!")
      setTimeout(() => {
        onSave()
        onClose()
      }, 1500)
    } catch (error: any) {
      setMessage(`❌ Erro: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value })
  }

  const getTitle = () => {
    return formData.title || formData.name || formData.original_title || formData.original_name || "Sem título"
  }

  const getPosterUrl = () => {
    if (formData.poster_path) {
      return formData.poster_path.startsWith("http")
        ? formData.poster_path
        : `https://image.tmdb.org/t/p/w500${formData.poster_path}`
    }
    return "/placeholder.svg"
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 overflow-y-auto">
      <div className="min-h-screen px-4 py-8 flex items-start justify-center">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl shadow-2xl">
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-zinc-800">
            <div className="flex gap-4">
              <img src={getPosterUrl()} alt={getTitle()} className="w-20 h-30 object-cover rounded-lg" />
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">Editar {type === "filmes" ? "Filme" : type === "series" ? "Série" : "Anime"}</h2>
                <p className="text-zinc-400">{getTitle()}</p>
                <p className="text-zinc-500 text-sm">ID: {formData.id}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <XMarkIcon className="w-6 h-6 text-zinc-400" />
            </button>
          </div>

          {/* Message */}
          {message && (
            <div className={`mx-6 mt-4 p-4 rounded-xl ${message.includes("✅") ? "bg-green-500/10 border border-green-500/50 text-green-400" : "bg-red-500/10 border border-red-500/50 text-red-400"}`}>
              {message}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Título */}
              {type === "filmes" ? (
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Título</label>
                  <input
                    type="text"
                    value={formData.title || ""}
                    onChange={(e) => handleChange("title", e.target.value)}
                    className="w-full px-4 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Nome</label>
                  <input
                    type="text"
                    value={formData.name || ""}
                    onChange={(e) => handleChange("name", e.target.value)}
                    className="w-full px-4 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              )}

              {/* Título Original */}
              {type === "filmes" ? (
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Título Original</label>
                  <input
                    type="text"
                    value={formData.original_title || ""}
                    onChange={(e) => handleChange("original_title", e.target.value)}
                    className="w-full px-4 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Nome Original</label>
                  <input
                    type="text"
                    value={formData.original_name || ""}
                    onChange={(e) => handleChange("original_name", e.target.value)}
                    className="w-full px-4 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              )}

              {/* Data de Lançamento */}
              {type === "filmes" ? (
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Data de Lançamento</label>
                  <input
                    type="date"
                    value={formData.release_date || ""}
                    onChange={(e) => handleChange("release_date", e.target.value)}
                    className="w-full px-4 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Primeira Exibição</label>
                  <input
                    type="date"
                    value={formData.first_air_date || ""}
                    onChange={(e) => handleChange("first_air_date", e.target.value)}
                    className="w-full px-4 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              )}

              {/* Avaliação */}
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Avaliação</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.vote_average || 0}
                  onChange={(e) => handleChange("vote_average", parseFloat(e.target.value))}
                  className="w-full px-4 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* URL do Vídeo (apenas para filmes) */}
            {type === "filmes" && (
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">URL do Vídeo</label>
                <input
                  type="url"
                  value={formData.video || formData.URLvideo || ""}
                  onChange={(e) => {
                    handleChange("video", e.target.value)
                    handleChange("URLvideo", e.target.value)
                  }}
                  className="w-full px-4 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            )}

            {/* Sinopse */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Sinopse</label>
              <textarea
                value={formData.overview || ""}
                onChange={(e) => handleChange("overview", e.target.value)}
                rows={4}
                className="w-full px-4 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
              />
            </div>

            {/* Gerenciador de Episódios (para séries e animes) */}
            {(type === "series" || type === "animes") && (
              <EpisodeManagerEdit
                temporadas={formData}
                onChange={(newTemporadas) => setFormData({ ...formData, ...newTemporadas })}
              />
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-4 border-t border-zinc-800">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white rounded-xl font-medium transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-800 disabled:text-zinc-500 text-white rounded-xl font-medium transition-all"
              >
                {loading ? "Salvando..." : "Salvar Alterações"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
