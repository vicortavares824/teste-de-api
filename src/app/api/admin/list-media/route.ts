import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"

const getFilePath = (type: string) => {
  const basePath = process.cwd()
  switch (type) {
    case "filmes":
      return path.join(basePath, "filmes.json")
    case "series":
      return path.join(basePath, "series.json")
    case "animes":
      return path.join(basePath, "animes.json")
    default:
      throw new Error("Tipo inválido")
  }
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const type = searchParams.get("type")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const search = searchParams.get("search") || ""

    if (!type) {
      return NextResponse.json({ error: "Tipo é obrigatório" }, { status: 400 })
    }

    const filePath = getFilePath(type)
    const fileContent = await fs.readFile(filePath, "utf-8")
    const data = JSON.parse(fileContent)

    // Coletar todos os itens de todas as páginas
    let allItems: any[] = []
    for (const p of data.pages) {
      allItems = allItems.concat(p.results)
    }

    // Filtrar por busca se houver
    if (search) {
      allItems = allItems.filter((item: any) => {
        const title = item.title || item.name || item.original_title || item.original_name || ""
        return title.toLowerCase().includes(search.toLowerCase())
      })
    }

    // Ordenar por ID (mais recente primeiro)
    allItems.sort((a, b) => b.id - a.id)

    // Paginação
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedItems = allItems.slice(startIndex, endIndex)

    return NextResponse.json({
      items: paginatedItems,
      total: allItems.length,
      page,
      totalPages: Math.ceil(allItems.length / limit),
    })
  } catch (error: any) {
    console.error("Erro ao listar itens:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
