"use client"

import { FilmIcon, CalendarIcon, StarIcon, PlayIcon } from "@heroicons/react/24/outline"

interface SearchResult {
  id: number
  title: string
  original_title: string
  release_date: string
  poster_path: string
  overview: string
  vote_average: number
}

interface SearchResultsProps {
  results: SearchResult[]
  onSelectResult: (result: SearchResult) => void
  loadingTMDB: boolean
}

export function SearchResults({ results, onSelectResult, loadingTMDB }: SearchResultsProps) {
  return (
    <div className="bg-card border border-border rounded-lg shadow-sm p-6 mb-8 max-h-[600px] overflow-y-auto">
      <h3 className="font-semibold text-lg text-foreground mb-4 flex items-center gap-2">
        <PlayIcon className="w-6 h-6" />
        Resultados ({results.length})
      </h3>
      <div className="grid gap-3">
        {results.map((result) => (
          <button
            key={result.id}
            type="button"
            onClick={() => onSelectResult(result)}
            disabled={loadingTMDB}
            className="flex gap-4 p-4 bg-muted/50 hover:bg-muted rounded-md border border-border hover:border-primary/50 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {result.poster_path ? (
              <img
                src={`https://image.tmdb.org/t/p/w92${result.poster_path}`}
                alt={result.title}
                className="w-20 h-28 object-cover rounded-md shadow"
              />
            ) : (
              <div className="w-20 h-28 bg-muted rounded-md flex items-center justify-center">
                <FilmIcon className="w-10 h-10 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                {result.title}
              </h4>
              {result.original_title !== result.title && (
                <p className="text-sm text-muted-foreground truncate">{result.original_title}</p>
              )}
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CalendarIcon className="w-4 h-4" />
                  {result.release_date ? new Date(result.release_date).getFullYear() : "N/A"}
                </span>
                <span className="flex items-center gap-1">
                  <StarIcon className="w-4 h-4" />
                  {result.vote_average.toFixed(1)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                {result.overview || "Sem sinopse disponível"}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
