"use client"

import { useState, useEffect } from "react"
import { MagnifyingGlassIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline"

interface MediaItem {
  id: number
  title?: string
  name?: string
  original_title?: string
  original_name?: string
  poster_path?: string
  backdrop_path?: string
  release_date?: string
  first_air_date?: string
  overview?: string
  vote_average?: number
  [key: string]: any
}

interface MediaListProps {
  type: "filmes" | "series" | "animes"
  onEdit: (item: MediaItem) => void
}

export function MediaList({ type, onEdit }: MediaListProps) {
  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchItems = async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/admin/list-media?type=${type}&page=${page}&limit=20&search=${encodeURIComponent(search)}`,
      )
      if (!response.ok) throw new Error("Erro ao carregar itens")

      const data = await response.json()
      setItems(data.items)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (error) {
      console.error("Erro:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
  }, [type, page])

  const handleSearch = () => {
    setPage(1)
    fetchItems()
  }

  const handleDelete = async (item: MediaItem) => {
    if (!confirm(`Tem certeza que deseja deletar "${item.title || item.name}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/edit-media?type=${type}&id=${item.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error)
      }

      alert("Item deletado com sucesso!")
      fetchItems()
    } catch (error: any) {
      alert(`Erro ao deletar: ${error.message}`)
    }
  }

  const getTitle = (item: MediaItem) => {
    return item.title || item.name || item.original_title || item.original_name || "Sem título"
  }

  const getPosterUrl = (item: MediaItem) => {
    if (item.poster_path) {
      return item.poster_path.startsWith("http")
        ? item.poster_path
        : `https://image.tmdb.org/t/p/w200${item.poster_path}`
    }
    return "/placeholder.svg"
  }

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Buscar por título..."
            className="w-full px-4 py-3 pl-11 bg-zinc-900/50 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <MagnifyingGlassIcon className="w-5 h-5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-800 disabled:text-zinc-500 text-white rounded-xl font-medium transition-all"
        >
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </div>

      {/* Results Count */}
      <div className="text-zinc-400">
        {total} {type === "filmes" ? "filmes" : type === "series" ? "séries" : "animes"} encontrados
      </div>

      {/* Items Grid */}
      {loading ? (
        <div className="text-center py-12 text-zinc-500">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">Nenhum item encontrado</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-zinc-900/50 border border-zinc-800 rounded-lg overflow-hidden hover:border-zinc-700 transition-all group"
            >
              <div className="relative aspect-[2/3] bg-zinc-800">
                <img
                  src={getPosterUrl(item)}
                  alt={getTitle(item)}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = "/placeholder.svg"
                  }}
                />
                <div className="absolute top-1.5 right-1.5 bg-black/80 px-1.5 py-0.5 rounded text-[10px] text-yellow-400 font-medium">
                  ⭐ {item.vote_average?.toFixed(1) || "N/A"}
                </div>
                {/* Overlay com botões ao passar o mouse */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                  <button
                    onClick={() => onEdit(item)}
                    className="flex items-center justify-center gap-1 px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-all"
                    title="Editar"
                  >
                    <PencilIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(item)}
                    className="flex items-center justify-center gap-1 px-2 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium transition-all"
                    title="Deletar"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="p-2">
                <h3 className="font-medium text-white text-xs line-clamp-2 leading-tight" title={getTitle(item)}>
                  {getTitle(item)}
                </h3>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="px-4 py-2 bg-zinc-900/50 hover:bg-zinc-800/50 disabled:opacity-50 disabled:cursor-not-allowed border border-zinc-800 rounded-lg text-zinc-400 transition-all"
          >
            Anterior
          </button>
          <span className="px-4 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg text-zinc-400">
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || loading}
            className="px-4 py-2 bg-zinc-900/50 hover:bg-zinc-800/50 disabled:opacity-50 disabled:cursor-not-allowed border border-zinc-800 rounded-lg text-zinc-400 transition-all"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  )
}
