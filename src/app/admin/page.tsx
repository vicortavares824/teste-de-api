"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from 'next/navigation'
import { SearchBar } from "../components/admin/search-bar"
import { MediaTabs } from "../components/admin/media-tabs"
import { SearchResults } from "../components/admin/search-results"
import { MediaForm } from "../components/admin/media-form"

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
  URLTxt?: string | null
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

  // StreamP2P files modal
  const [streamp2pFiles, setStreamp2pFiles] = useState<any[]>([])
  const [showFilesModal, setShowFilesModal] = useState(false)
  const [loadingFiles, setLoadingFiles] = useState(false)

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
  URLTxt: null,
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
  URLTxt: data.URLTxt || formData.URLTxt,
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

  const fetchStreamP2PFiles = async () => {
    setLoadingFiles(true)
    setMessage("")
    try {
      const res = await fetch('/api/admin/streamp2p/list-files')
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(err.error || 'Falha ao buscar arquivos')
      }
      const json = await res.json()
      setStreamp2pFiles(json.files || [])
      setShowFilesModal(true)
      if ((json.files || []).length === 0) setMessage('⚠️ Nenhum arquivo encontrado no StreamP2P')
    } catch (e: any) {
      setMessage(`❌ Erro ao buscar arquivos StreamP2P: ${e.message}`)
    } finally {
      setLoadingFiles(false)
    }
  }

  const importStreamP2PFile = (file: any) => {
    // Preencher campo de vídeo com a url disponível (url, path ou name)
    const candidate = file.url || file.path || file.name || ''
    setFormData({ ...formData, video: candidate, URLvideo: candidate, URLTxt: candidate })
    setShowFilesModal(false)
    setMessage('✅ Arquivo importado para o formulário')
  }

  const [showJson, setShowJson] = useState(false)

  const importAllFiles = () => {
    if (!streamp2pFiles || streamp2pFiles.length === 0) {
      setMessage('⚠️ Não há arquivos para importar')
      return
    }
    // Preencher com o primeiro arquivo como atalho; podemos ajustar para múltiplos se desejar
    const first = streamp2pFiles[0]
    const candidate = first.url || first.path || first.name || ''
    setFormData({ ...formData, video: candidate, URLvideo: candidate, URLTxt: candidate })
    setShowFilesModal(false)
    setMessage(`✅ Importado 1 de ${streamp2pFiles.length} arquivos (atalho).`) 
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
           
              <button
                onClick={fetchStreamP2PFiles}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-md"
                disabled={loadingFiles}
              >
                {loadingFiles ? 'Buscando...' : 'Buscar arquivos StreamP2P'}
              </button>
            
        </div>

        {/* Tabs */}
        <MediaTabs activeTab={activeTab} onTabChange={switchTab} />

       

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

            {/* StreamP2P files modal */}
            {showFilesModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                <div className="w-11/12 md:w-3/4 lg:w-2/3 bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Arquivos StreamP2P</h3>
                    <div className="flex items-center gap-2">
                      <button onClick={fetchStreamP2PFiles} className="px-3 py-1 bg-zinc-800 rounded">Recarregar</button>
                      <button onClick={() => setShowJson(s => !s)} className="px-3 py-1 bg-zinc-800 rounded">{showJson ? 'Esconder JSON' : 'Mostrar JSON'}</button>
                      <button onClick={importAllFiles} className="px-3 py-1 bg-blue-700 rounded text-white">Importar todos</button>
                      <button onClick={() => setShowFilesModal(false)} className="px-3 py-1 bg-zinc-800 rounded">Fechar</button>
                    </div>
                  </div>

                  <div className="max-h-96 overflow-auto">
                    <table className="w-full table-auto text-left">
                      <thead>
                        <tr className="text-sm text-zinc-400">
                          <th className="p-2">Nome</th>
                          <th className="p-2">URL / Path</th>
                          <th className="p-2">Criado Em</th>
                          <th className="p-2">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {streamp2pFiles.map((f, idx) => (
                          <tr key={idx} className="border-t border-zinc-800">
                            <td className="p-2 align-top text-sm">{f.name || f.path || f.url}</td>
                            <td className="p-2 align-top text-sm break-all">{f.url || f.path || f.name}</td>
                            <td className="p-2 align-top text-sm">{f.createdAt || f.created_at || '-'}</td>
                            <td className="p-2 align-top text-sm">
                              <button onClick={() => importStreamP2PFile(f)} className="px-2 py-1 bg-blue-600 rounded text-white">Importar</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {showJson && (
                    <div className="mt-3 p-3 bg-zinc-900 border border-zinc-800 rounded text-sm max-h-80 overflow-auto">
                      <pre className="whitespace-pre-wrap">{JSON.stringify(streamp2pFiles, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </div>
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
