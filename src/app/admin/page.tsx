"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from 'next/navigation'
import { SearchBar } from "../components/admin/search-bar"
import { MediaTabs } from "../components/admin/media-tabs"
import { SearchResults } from "../components/admin/search-results"
import { MediaForm } from "../components/admin/media-form"
import { FeedbackMessage } from "../components/admin/feedback-message"
import { MediaList } from "../components/admin/media-list"
import { MediaEditForm } from "../components/admin/media-edit-form"
import { ArrowRightOnRectangleIcon, PlusIcon, PencilSquareIcon } from '@heroicons/react/24/outline'

type MediaType = "filmes" | "series" | "animes"
type ViewMode = "add" | "edit"

interface SearchResult {
  id: number
  title: string
  original_title: string
  release_date: string
  poster_path: string
  overview: string
  vote_average: number
}

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

export default function AdminPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<MediaType>("filmes")
  const [viewMode, setViewMode] = useState<ViewMode>("edit")
  const [loading, setLoading] = useState(false)
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [loadingTMDB, setLoadingTMDB] = useState(false)
  const [message, setMessage] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/admin/login')
    router.refresh()
  }

  const [formData, setFormData] = useState<FormData>({
    id: "",
    title: "",
    name: "",
    original_title: "",
    original_name: "",
    video: "",
    URLvideo: "",
    poster_path: "",
    backdrop_path: "",
    overview: "",
    release_date: "",
    first_air_date: "",
    vote_average: "0",
    vote_count: "0",
    popularity: "0",
    genre_ids: "",
    original_language: "pt",
    adult: false,
    temporadas: {},
  })

  const resetForm = () => {
    setFormData({
      id: "",
      title: "",
      name: "",
      original_title: "",
      original_name: "",
      video: "",
      URLvideo: "",
      poster_path: "",
      backdrop_path: "",
      overview: "",
      release_date: "",
      first_air_date: "",
      vote_average: "0",
      vote_count: "0",
      popularity: "0",
      genre_ids: "",
      original_language: "pt",
      adult: false,
      temporadas: {},
    })
  }

  const switchTab = (tab: MediaType) => {
    setActiveTab(tab)
    resetForm()
    setSearchResults([])
    setShowResults(false)
    setEditingItem(null)
  }

  const handleEdit = (item: any) => {
    setEditingItem(item)
  }

  const handleCloseEdit = () => {
    setEditingItem(null)
  }

  const handleSaveEdit = () => {
    setMessage("✅ Item atualizado com sucesso!")
    setEditingItem(null)
  }

  const searchByTitle = async () => {
    if (!searchQuery.trim()) {
      setMessage("⚠️ Digite um título para pesquisar")
      return
    }

    setLoadingSearch(true)
    setMessage("")
    setSearchResults([])

    try {
      const mediaType = activeTab === "filmes" ? "movie" : "tv"
      const response = await fetch(`/api/admin/search-tmdb?query=${encodeURIComponent(searchQuery)}&type=${mediaType}`)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erro ao buscar")
      }

      const data = await response.json()
      setSearchResults(data.results)
      setShowResults(true)

      if (data.results.length === 0) {
        setMessage("⚠️ Nenhum resultado encontrado. Tente outro termo.")
      }
    } catch (error: any) {
      setMessage(`❌ Erro ao pesquisar: ${error.message}`)
    } finally {
      setLoadingSearch(false)
    }
  }

  const selectResult = async (result: SearchResult) => {
    setShowResults(false)
    setLoadingTMDB(true)
    setMessage("")

    try {
      const mediaType = activeTab === "filmes" ? "movie" : "tv"
      const response = await fetch(`/api/admin/fetch-tmdb?id=${result.id}&type=${mediaType}`)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erro ao buscar dados")
      }

      const data = await response.json()

      setFormData({
        ...formData,
        id: String(data.id),
        title: data.title || formData.title,
        name: data.name || formData.name,
        original_title: data.original_title || formData.original_title,
        original_name: data.original_name || formData.original_name,
        poster_path: data.poster_path,
        backdrop_path: data.backdrop_path,
        overview: data.overview,
        release_date: data.release_date || formData.release_date,
        first_air_date: data.first_air_date || formData.first_air_date,
        vote_average: String(data.vote_average),
        vote_count: String(data.vote_count),
        popularity: String(data.popularity),
        genre_ids: data.genre_ids.join(", "),
        original_language: data.original_language,
        adult: data.adult,
      })

      setMessage("✅ Dados carregados! Agora adicione a URL do vídeo.")
      setSearchQuery("")
    } catch (error: any) {
      setMessage(`❌ Erro: ${error.message}`)
    } finally {
      setLoadingTMDB(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage("")

    try {
      const response = await fetch("/api/admin/add-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: activeTab,
          data: formData,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        setMessage(
          `✅ ${activeTab === "filmes" ? "Filme" : activeTab === "series" ? "Série" : "Anime"} adicionado com sucesso!`,
        )
        resetForm()
      } else if (response.status === 409) {
        // 409 Conflict = Duplicata
        setMessage(`⚠️ ${result.message || "Este item já existe no banco de dados!"}`)
      } else {
        setMessage(`❌ Erro: ${result.error || result.message}`)
      }
    } catch (error) {
      setMessage(`❌ Erro ao enviar: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {/* Header com Botão de Logout */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-2">CineStream Admin</h1>
            <p className="text-muted-foreground text-lg">Gerencie seu catálogo de filmes, séries e animes</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700 hover:border-red-500/50 rounded-xl text-zinc-400 hover:text-red-400 transition-all"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
            <span className="hidden md:inline">Sair</span>
          </button>
        </div>

        {/* View Mode Toggle */}
        <div className="mb-6 flex gap-2 p-1 bg-zinc-900/50 border border-zinc-800 rounded-xl w-fit">
          <button
            onClick={() => setViewMode("edit")}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all ${
              viewMode === "edit"
                ? "bg-blue-600 text-white shadow-lg"
                : "text-zinc-400 hover:text-zinc-300"
            }`}
          >
            <PencilSquareIcon className="w-5 h-5" />
            Editar/Deletar
          </button>
          <button
            onClick={() => setViewMode("add")}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all ${
              viewMode === "add"
                ? "bg-blue-600 text-white shadow-lg"
                : "text-zinc-400 hover:text-zinc-300"
            }`}
          >
            <PlusIcon className="w-5 h-5" />
            Adicionar Novo
          </button>
        </div>

        {/* Tabs */}
        <MediaTabs activeTab={activeTab} onTabChange={switchTab} />

        {/* Feedback Message */}
        {message && <FeedbackMessage message={message} />}

        {/* View Mode Content */}
        {viewMode === "edit" ? (
          <MediaList type={activeTab} onEdit={handleEdit} />
        ) : (
          <>
            {/* Search Section */}
            <SearchBar
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              onSearch={searchByTitle}
              loadingSearch={loadingSearch}
              activeTab={activeTab}
            />

            {/* Search Results */}
            {showResults && searchResults.length > 0 && (
              <SearchResults results={searchResults} onSelectResult={selectResult} loadingTMDB={loadingTMDB} />
            )}

            {/* Form */}
            {formData.id && (
              <MediaForm
                formData={formData}
                onFormDataChange={setFormData}
                onSubmit={handleSubmit}
                activeTab={activeTab}
                loading={loading}
                loadingTMDB={loadingTMDB}
              />
            )}
          </>
        )}

        {/* Edit Modal */}
        {editingItem && (
          <MediaEditForm
            item={editingItem}
            type={activeTab}
            onClose={handleCloseEdit}
            onSave={handleSaveEdit}
          />
        )}
      </div>
    </div>
  )
}
