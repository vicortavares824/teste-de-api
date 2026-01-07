"use client"

import { TvIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline"

interface EpisodeManagerProps {
  temporadas: { [key: string]: { [key: string]: string } }
  currentSeason: string
  onSeasonChange: (season: string) => void
  currentEpisode: string
  onEpisodeChange: (episode: string) => void
  currentEpisodeUrl: string
  onEpisodeUrlChange: (url: string) => void
  onAddEpisode: () => void
  onRemoveEpisode: (season: string, episode: string) => void
  message?: string
}

export function EpisodeManager({
  temporadas,
  currentSeason,
  onSeasonChange,
  currentEpisode,
  onEpisodeChange,
  currentEpisodeUrl,
  onEpisodeUrlChange,
  onAddEpisode,
  onRemoveEpisode,
  message,
}: EpisodeManagerProps) {
  return (
    <div className="bg-muted/50 rounded-md p-6 border border-border space-y-4">
      <h3 className="flex items-center gap-2 font-bold text-lg text-foreground">
        <TvIcon className="w-6 h-6" />
        Temporadas e Episódios *
      </h3>

      {/* Episode Input */}
      <div className="grid md:grid-cols-4 gap-3">
        <input
          type="number"
          placeholder="Temporada"
          className="bg-input border border-border rounded-md px-4 py-2 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          value={currentSeason}
          onChange={(e) => onSeasonChange(e.target.value)}
        />
        <input
          type="number"
          placeholder="Episódio"
          className="bg-input border border-border rounded-md px-4 py-2 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          value={currentEpisode}
          onChange={(e) => onEpisodeChange(e.target.value)}
        />
        <input
          type="url"
          placeholder="URL do episódio"
          className="bg-input border border-border rounded-md px-4 py-2 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring md:col-span-2"
          value={currentEpisodeUrl}
          onChange={(e) => onEpisodeUrlChange(e.target.value)}
        />
      </div>

      <button
        type="button"
        onClick={onAddEpisode}
        className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-semibold flex items-center gap-2 hover:opacity-90 transition-all"
      >
        <PlusIcon className="w-5 h-5" />
        Adicionar Episódio
      </button>

      {message && (
        <p
          className={`text-sm font-medium ${
            message.includes("✅") ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400"
          }`}
        >
          {message}
        </p>
      )}

      {/* Episodes List */}
      {Object.keys(temporadas).length > 0 && (
        <div className="space-y-3">
          {Object.entries(temporadas).map(([season, episodes]) => (
            <div key={season} className="bg-background rounded-md p-4 border border-border">
              <h4 className="font-semibold text-foreground mb-2 capitalize">{season.replace("_", " ")}</h4>
              <div className="space-y-2">
                {Object.entries(episodes).map(([episode, url]) => (
                  <div
                    key={episode}
                    className="flex items-center justify-between bg-muted/30 p-3 rounded-md border border-border/50"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground capitalize">{episode.replace("eps_", "Ep ")}</p>
                      <p className="text-xs text-muted-foreground truncate">{url}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveEpisode(season, episode)}
                      className="ml-4 p-2 text-destructive hover:bg-destructive/10 rounded-md transition-all flex-shrink-0"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
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
