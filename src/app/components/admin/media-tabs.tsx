"use client"

import { FilmIcon, TvIcon, SparklesIcon } from "@heroicons/react/24/outline"

type MediaType = "filmes" | "series" | "animes"

interface MediaTabsProps {
  activeTab: MediaType
  onTabChange: (tab: MediaType) => void
}

const getTabIcon = (tab: MediaType) => {
  switch (tab) {
    case "filmes":
      return <FilmIcon className="w-5 h-5" />
    case "series":
      return <TvIcon className="w-5 h-5" />
    case "animes":
      return <SparklesIcon className="w-5 h-5" />
  }
}

export function MediaTabs({ activeTab, onTabChange }: MediaTabsProps) {
  return (
    <div className="bg-card border border-border rounded-lg shadow-sm p-2 mb-8">
      <div className="flex gap-2">
        {(["filmes", "series", "animes"] as MediaType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-md font-semibold transition-all ${
              activeTab === tab
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:bg-muted/50"
            }`}
          >
            {getTabIcon(tab)}
            <span className="capitalize">{tab}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
