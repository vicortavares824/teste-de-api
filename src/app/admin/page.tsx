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
  txtUrl?: string | null
  videoStreamp?: string | null
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
  
  // Fila de importação sequencial
  const [importQueue, setImportQueue] = useState<any[]>([])
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0)
  const [isQueueMode, setIsQueueMode] = useState(false)

  // Migração de URLs
  const [showMigrateModal, setShowMigrateModal] = useState(false)
  const [migratePreview, setMigratePreview] = useState<any>(null)
  const [loadingMigrate, setLoadingMigrate] = useState(false)

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
  URLTxt: "",
  txtUrl: "",
  videoStreamp: "",
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
  URLTxt: "",
  txtUrl: "",
  videoStreamp: "",
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

  // Função helper para normalizar nomes (remove pontos, hifens, anos, qualidade, extensões)
  const normalizeName = (name: string): string => {
    return name
      .toLowerCase()
      .trim()
      // Remover extensões de arquivo
      .replace(/\.(mkv|mp4|avi|mov|wmv|flv|webm)$/i, '')
      // Remover informações de qualidade, ano e codec
      .replace(/\.(19|20)\d{2}\..*$/i, '') // Remove .2024.1080p.WEB-DL.DUAL etc
      .replace(/\.(1080p|720p|480p|4k|hd|web-dl|bluray|dvdrip|dual|nacional).*$/i, '')
      .replace(/\.5\.1.*$/i, '') // Remove .5.1.mkv
      // Remover anos entre parênteses
      .replace(/\s*\((19|20)\d{2}\)\s*/g, ' ')
      // Substituir pontos, hifens e underscores por espaços
      .replace(/[.\-_]/g, ' ')
      // Remover espaços extras
      .replace(/\s+/g, ' ')
      .trim()
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

      // Função helper para normalizar nomes (remove pontos, hifens, anos, qualidade, extensões)
      const normalizeName = (name: string): string => {
        return name
          .toLowerCase()
          .trim()
          // Remover extensões de arquivo
          .replace(/\.(mkv|mp4|avi|mov|wmv|flv|webm)$/i, '')
          // Remover informações de qualidade, ano e codec
          .replace(/\.(19|20)\d{2}\..*$/i, '') // Remove .2024.1080p.WEB-DL.DUAL etc
          .replace(/\.(1080p|720p|480p|4k|hd|web-dl|bluray|dvdrip|dual|nacional).*$/i, '')
          .replace(/\.5\.1.*$/i, '') // Remove .5.1.mkv
          // Remover anos entre parênteses
          .replace(/\s*\((19|20)\d{2}\)\s*/g, ' ')
          // Substituir pontos, hifens e underscores por espaços
          .replace(/[.\-_]/g, ' ')
          // Remover espaços extras
          .replace(/\s+/g, ' ')
          .trim()
      }

      // Função helper: busca paginada de títulos via /api/admin/list-media
      const fetchAllTitlesForType = async (typeName: string, maxPages = 10) => {
        const titles: string[] = []
        try {
          let page = 1
          while (page <= maxPages) {
            const listRes = await fetch(`/api/admin/list-media?type=${typeName}&page=${page}&limit=50&search=`)
            if (!listRes.ok) break
            const data = await listRes.json()
            const items = data.items || []
            items.forEach((it: any) => {
              const originalTitle = (it.title || it.name || it.original_title || it.original_name || '').trim()
              if (originalTitle) {
                const normalized = normalizeName(originalTitle)
                if (normalized) titles.push(normalized)
              }
            })
            // parar se não houver mais páginas
            if (!data.totalPages || page >= data.totalPages) break
            page += 1
          }
        } catch (e) {
          console.warn(`Erro ao buscar lista de ${typeName}:`, e)
        }
        return titles
      }

      // Coletar títulos de filmes, séries e animes (limitado a N páginas cada)
      const [filmesTitles, seriesTitles, animesTitles] = await Promise.all([
        fetchAllTitlesForType('filmes', 10),
        fetchAllTitlesForType('series', 10),
        fetchAllTitlesForType('animes', 10),
      ])

      const titulosExistentes = new Set<string>()
      filmesTitles.concat(seriesTitles, animesTitles).forEach((t) => titulosExistentes.add(t))

      // Filtrar arquivos StreamP2P removendo os que já existem (comparação normalizada)
      const arquivosNovos = (json.files || []).filter((file: any) => {
        const nomeArquivo = (file.name || '').trim()
        if (!nomeArquivo) return false
        
        const nomeNormalizado = normalizeName(nomeArquivo)
        if (!nomeNormalizado) return false
        
        return !titulosExistentes.has(nomeNormalizado)
      })

      setStreamp2pFiles(arquivosNovos)
      setShowFilesModal(true)

      if (arquivosNovos.length === 0) {
        const totalArquivos = (json.files || []).length
        if (totalArquivos > 0) {
          setMessage(`✅ Todos os ${totalArquivos} arquivo(s) já foram adicionados ao banco de dados!`)
        } else {
          setMessage('⚠️ Nenhum arquivo encontrado no StreamP2P')
        }
      } else {
        const existentes = (json.files || []).length - arquivosNovos.length
        if (existentes > 0) {
          setMessage(`📊 Mostrando ${arquivosNovos.length} arquivo(s) novo(s). ${existentes} já foi/foram adicionado(s).`)
        } else {
          setMessage(`📊 Mostrando ${arquivosNovos.length} arquivo(s) novo(s).`)
        }
      }
    } catch (e: any) {
      setMessage(`❌ Erro ao buscar arquivos StreamP2P: ${e.message}`)
    } finally {
      setLoadingFiles(false)
    }
  }

  const downloadStreamp2pJson = () => {
    try {
      const data = streamp2pFiles || []
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `streamp2p-files-${new Date().toISOString().slice(0,10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setMessage('Erro ao gerar download')
    }
  }

  const importStreamP2PFile = async (file: any) => {
    setMessage('🔄 Processando arquivo StreamP2P...')
    setShowFilesModal(false)
    setLoadingTMDB(true)
    
    try {
      // 1. Pegar o ID do arquivo
      const fileId = file.id || file.name || ''
      if (!fileId) {
        throw new Error('ID do arquivo não encontrado')
      }

      const fileName = file.name || fileId
      
      // 2. Montar a URL base
      const streamP2pUrl = `https://cinestreamtent.strp2p.live/#${fileId}`
      
      // 3. Normalizar o nome para busca no TMDB
      const normalizedName = normalizeName(fileName)
      const searchName = normalizedName || fileName // fallback para nome original se normalização falhar

      // 4. Buscar informações na TMDB usando o título normalizado
      setMessage(`🔍 Buscando "${searchName}" na TMDB...`)
      
      const searchResponse = await fetch(`/api/admin/search-tmdb?query=${encodeURIComponent(searchName)}&type=${activeTab === "filmes" ? "movie" : "tv"}`)
      
      if (!searchResponse.ok) {
        throw new Error('Erro ao buscar na TMDB')
      }

      const searchData = await searchResponse.json()
      
      if (!searchData.results || searchData.results.length === 0) {
        throw new Error(`Nenhum resultado encontrado para "${searchName}" na TMDB`)
      }

      // Pega o primeiro resultado
      const firstResult = searchData.results[0]
      setMessage(`📺 Carregando dados de "${firstResult.title || firstResult.name}" da TMDB...`)

      // 5. Buscar dados completos do TMDB
      const mediaType = activeTab === "filmes" ? "movie" : "tv"
      const tmdbResponse = await fetch(`/api/admin/fetch-tmdb?id=${firstResult.id}&type=${mediaType}`)

      if (!tmdbResponse.ok) {
        throw new Error('Erro ao carregar dados completos do TMDB')
      }

      const tmdbData = await tmdbResponse.json()

      // 6. Preencher o formulário com todos os dados TMDB e limpar campos de URL antigos
      setFormData({
        id: String(tmdbData.id),
        title: tmdbData.title || "",
        name: tmdbData.name || "",
        original_title: tmdbData.original_title || "",
        original_name: tmdbData.original_name || "",
        poster_path: tmdbData.poster_path || "",
        backdrop_path: tmdbData.backdrop_path || "",
        overview: tmdbData.overview || "",
        release_date: tmdbData.release_date || "",
        first_air_date: tmdbData.first_air_date || "",
        vote_average: String(tmdbData.vote_average || 0),
        vote_count: String(tmdbData.vote_count || 0),
        popularity: String(tmdbData.popularity || 0),
        genre_ids: (tmdbData.genre_ids || []).join(", "),
        original_language: tmdbData.original_language || "pt",
        adult: tmdbData.adult || false,
        video: fileName,
        // streamP2P URL into URLTxt, but clear other URL fields so old data doesn't persist
        URLTxt: streamP2pUrl,
        URLvideo: "",
        txtUrl: "",
        videoStreamp: "",
        temporadas: {},
      })

      setMessage(`✅ Arquivo "${fileName}" importado com sucesso! Todos os dados da TMDB foram carregados.`)
      setSearchQuery("")
    } catch (error: any) {
      setMessage(`❌ Erro ao processar arquivo: ${error.message}`)
      setShowFilesModal(true)
    } finally {
      setLoadingTMDB(false)
    }
  }

  const [showJson, setShowJson] = useState(false)

  // Função para carregar o próximo item da fila no formulário
  const loadNextFromQueue = async (index: number) => {
    if (index >= importQueue.length) {
      // Fim da fila
      setIsQueueMode(false)
      setImportQueue([])
      setCurrentQueueIndex(0)
      setMessage(`✅ Fila de importação concluída! Todos os ${importQueue.length} itens foram processados.`)
      return
    }

  // Resetar formulário antes de carregar o próximo para evitar dados anteriores
  resetForm()
  const file = importQueue[index]
  await importStreamP2PFile(file)
  setCurrentQueueIndex(index)
  }

  // Função para iniciar modo fila (importar todos sequencialmente)
  const importAllFiles = async () => {
    if (!streamp2pFiles || streamp2pFiles.length === 0) {
      setMessage('⚠️ Não há arquivos para importar')
      return
    }

    // Configurar a fila
    setImportQueue([...streamp2pFiles])
    setCurrentQueueIndex(0)
    setIsQueueMode(true)
    setShowFilesModal(false)

    // Carregar o primeiro item
    await importStreamP2PFile(streamp2pFiles[0])
  }

  // Função para pular item atual e ir para o próximo
  const skipCurrentAndNext = async () => {
    const nextIndex = currentQueueIndex + 1
    if (nextIndex >= importQueue.length) {
      setIsQueueMode(false)
      setImportQueue([])
      setCurrentQueueIndex(0)
      setMessage('✅ Fila de importação concluída!')
      resetForm()
      return
    }
    // Resetar formulário antes de carregar o próximo
    resetForm()
    setCurrentQueueIndex(nextIndex)
    await importStreamP2PFile(importQueue[nextIndex])
  }

  // Função para ir para o próximo após salvar
  const goToNextInQueue = async () => {
    const nextIndex = currentQueueIndex + 1
    if (nextIndex >= importQueue.length) {
      setIsQueueMode(false)
      setImportQueue([])
      setCurrentQueueIndex(0)
      setMessage('✅ Fila de importação concluída!')
      resetForm()
      return
    }
    // Resetar formulário antes de carregar o próximo
    resetForm()
    setCurrentQueueIndex(nextIndex)
    await importStreamP2PFile(importQueue[nextIndex])
  }

  // Função para cancelar a fila
  const cancelQueue = () => {
    setIsQueueMode(false)
    setImportQueue([])
    setCurrentQueueIndex(0)
    resetForm()
    setMessage('Fila de importação cancelada.')
  }

  // Funções de migração de URLs do proxy
  const fetchMigratePreview = async () => {
    setLoadingMigrate(true)
    setMigratePreview(null)
    try {
      const res = await fetch('/api/admin/migrate-proxy-urls?type=all')
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(err.error || 'Falha ao buscar preview')
      }
      const data = await res.json()
      setMigratePreview(data)
      setShowMigrateModal(true)
    } catch (e: any) {
      setMessage(`❌ Erro ao buscar preview de migração: ${e.message}`)
    } finally {
      setLoadingMigrate(false)
    }
  }

  const executeMigration = async () => {
    if (!confirm('⚠️ Tem certeza que deseja atualizar TODAS as URLs do proxy no banco de dados?\n\nEsta ação não pode ser desfeita!')) {
      return
    }
    
    setLoadingMigrate(true)
    try {
      const res = await fetch('/api/admin/migrate-proxy-urls?type=all', {
        method: 'POST',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(err.error || 'Falha na migração')
      }
      const data = await res.json()
      setMigratePreview(data)
      setMessage(`✅ Migração concluída! ${data.totalUpdated} itens atualizados.`)
    } catch (e: any) {
      setMessage(`❌ Erro na migração: ${e.message}`)
    } finally {
      setLoadingMigrate(false)
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
        
        // Se estiver no modo fila, avançar para o próximo item
        if (isQueueMode) {
          setTimeout(() => {
            goToNextInQueue()
          }, 500) // Pequeno delay para mostrar mensagem de sucesso
        } else {
          resetForm()
        }
      } else if (response.status === 409) {
        // 409 Conflict = Duplicata
        setMessage(`⚠️ ${result.message || "Este item já existe no banco de dados!"}`)
        // No modo fila, também avançar após duplicata (já foi salvo antes)
        if (isQueueMode) {
          setTimeout(() => {
            goToNextInQueue()
          }, 1000)
        }
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

              <button
                onClick={fetchMigratePreview}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-md"
                disabled={loadingMigrate}
              >
                {loadingMigrate ? '⏳ Verificando...' : '🔄 Migrar URLs Proxy'}
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

            {/* Queue status bar */}
            {isQueueMode && (
              <div className="mb-4 p-3 bg-blue-900/30 border border-blue-700 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-blue-400 font-medium">📋 Modo Fila</span>
                    <span className="text-zinc-300">
                      Item {currentQueueIndex + 1} de {importQueue.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={skipCurrentAndNext}
                      className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-white text-sm"
                    >
                      ⏭️ Pular
                    </button>
                    <button
                      onClick={cancelQueue}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-sm"
                    >
                      ❌ Cancelar Fila
                    </button>
                  </div>
                </div>
                <div className="mt-2 w-full bg-zinc-800 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${((currentQueueIndex + 1) / importQueue.length) * 100}%` }}
                  />
                </div>
              </div>
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
                isQueueMode={isQueueMode}
                onQueueNext={goToNextInQueue}
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
                      <button onClick={downloadStreamp2pJson} className="px-3 py-1 bg-green-600 rounded text-white" disabled={streamp2pFiles.length === 0}>⬇️ Download JSON</button>
                      <button 
                        onClick={importAllFiles} 
                        className="px-3 py-1 bg-blue-700 rounded text-white disabled:opacity-50"
                        disabled={streamp2pFiles.length === 0}
                      >
                        📋 Iniciar fila ({streamp2pFiles.length})
                      </button>
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
                              <button 
                                onClick={() => importStreamP2PFile(f)} 
                                className="px-2 py-1 bg-blue-600 rounded text-white"
                              >
                                Importar
                              </button>
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

        {/* Migrate Proxy URLs Modal */}
        {showMigrateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="w-11/12 md:w-3/4 lg:w-2/3 max-h-[90vh] overflow-auto bg-zinc-900 border border-zinc-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">🔄 Migrar URLs do Proxy</h3>
                <button 
                  onClick={() => setShowMigrateModal(false)} 
                  className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300"
                >
                  ✕ Fechar
                </button>
              </div>

              {migratePreview && (
                <div className="space-y-4">
                  {/* Info */}
                  <div className="p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
                    <p className="text-blue-300 font-medium mb-2">📍 Novo endereço do proxy:</p>
                    <code className="text-sm text-blue-200 bg-blue-900/50 px-2 py-1 rounded">
                      {migratePreview.newProxyUrl}
                    </code>
                  </div>

                  {/* Resumo */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 bg-zinc-800 rounded-lg text-center">
                      <p className="text-2xl font-bold text-white">{migratePreview.totalItemsScanned || 0}</p>
                      <p className="text-sm text-zinc-400">Itens escaneados</p>
                    </div>
                    <div className="p-3 bg-zinc-800 rounded-lg text-center">
                      <p className="text-2xl font-bold text-orange-400">{migratePreview.totalItemsToUpdate || migratePreview.totalUpdated || 0}</p>
                      <p className="text-sm text-zinc-400">Itens a atualizar</p>
                    </div>
                    {migratePreview.totalUpdated !== undefined && !migratePreview.totalItemsToUpdate && (
                      <div className="p-3 bg-green-900/50 rounded-lg text-center col-span-2">
                        <p className="text-2xl font-bold text-green-400">{migratePreview.totalUpdated}</p>
                        <p className="text-sm text-green-300">Itens atualizados!</p>
                      </div>
                    )}
                  </div>

                  {/* Detalhes por coleção */}
                  {migratePreview.collections && (
                    <div className="space-y-3">
                      <h4 className="font-semibold text-zinc-300">📂 Por coleção:</h4>
                      {Object.entries(migratePreview.collections).map(([colName, col]: [string, any]) => (
                        <div key={colName} className="p-3 bg-zinc-800/50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-white capitalize">{colName}</span>
                            <span className="text-sm text-zinc-400">
                              {col.toUpdate || col.updated || 0} de {col.total} itens
                            </span>
                          </div>
                          
                          {col.items && col.items.length > 0 && (
                            <div className="mt-2 max-h-40 overflow-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-zinc-500 text-left">
                                    <th className="pb-1">ID</th>
                                    <th className="pb-1">Título</th>
                                    <th className="pb-1">Campos alterados</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {col.items.map((item: any, idx: number) => (
                                    <tr key={idx} className="border-t border-zinc-700">
                                      <td className="py-1 text-zinc-400">{item.id}</td>
                                      <td className="py-1 text-zinc-300">{item.title}</td>
                                      <td className="py-1 text-orange-400 text-xs">
                                        {item.fieldsChanged?.join(', ') || '-'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {col.hasMore && (
                                <p className="text-xs text-zinc-500 mt-2">...e mais {col.toUpdate - 10} itens</p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Erros */}
                  {migratePreview.errors && migratePreview.errors.length > 0 && (
                    <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg">
                      <p className="text-red-400 font-medium mb-2">❌ Erros ({migratePreview.errors.length}):</p>
                      <ul className="text-sm text-red-300 list-disc list-inside">
                        {migratePreview.errors.slice(0, 5).map((err: any, idx: number) => (
                          <li key={idx}>{err.collection}/{err.id}: {err.error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Botões de ação */}
                  <div className="flex gap-3 pt-4 border-t border-zinc-700">
                    <button
                      onClick={fetchMigratePreview}
                      disabled={loadingMigrate}
                      className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-md disabled:opacity-50"
                    >
                      🔄 Atualizar Preview
                    </button>
                    
                    {(migratePreview.totalItemsToUpdate > 0 || migratePreview.message?.includes('Preview')) && (
                      <button
                        onClick={executeMigration}
                        disabled={loadingMigrate}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-md disabled:opacity-50 font-medium"
                      >
                        {loadingMigrate ? '⏳ Migrando...' : `⚡ Executar Migração (${migratePreview.totalItemsToUpdate || 0} itens)`}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {!migratePreview && loadingMigrate && (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
                  <span className="ml-3 text-zinc-400">Analisando banco de dados...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
