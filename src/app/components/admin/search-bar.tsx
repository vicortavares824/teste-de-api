"use client"

import { MagnifyingGlassIcon } from "@heroicons/react/24/outline"

type MediaType = "filmes" | "series" | "animes"

interface SearchBarProps {
  searchQuery: string
  onSearchQueryChange: (query: string) => void
  onSearch: () => void
  loadingSearch: boolean
  activeTab: MediaType
}

export function SearchBar({ searchQuery, onSearchQueryChange, onSearch, loadingSearch, activeTab }: SearchBarProps) {
  return (
    <div className="bg-card border border-border rounded-lg shadow-sm p-6 mb-8">
      <div className="flex items-center gap-3 mb-4">
        <MagnifyingGlassIcon className="w-6 h-6 text-muted-foreground" />
        <h3 className="font-semibold text-lg text-foreground">Buscar no TMDB</h3>
      </div>
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder={`Digite o nome do ${
              activeTab === "filmes" ? "filme" : activeTab === "series" ? "série" : "anime"
            }...`}
            className="w-full bg-input border border-border rounded-md px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && onSearch()}
          />
        </div>
        <button
          type="button"
          onClick={onSearch}
          disabled={loadingSearch || !searchQuery.trim()}
          className={`px-8 py-3 rounded-md font-semibold flex items-center gap-2 transition-all ${
            loadingSearch || !searchQuery.trim()
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-primary text-primary-foreground hover:opacity-90"
          }`}
        >
          {loadingSearch ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current" />
              Buscando...
            </>
          ) : (
            <>
              <MagnifyingGlassIcon className="w-5 h-5" />
              Buscar
            </>
          )}
        </button>
      </div>
    </div>
  )
}
