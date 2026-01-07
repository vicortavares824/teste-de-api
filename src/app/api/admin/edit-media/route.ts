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

// GET - Buscar item por ID
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const type = searchParams.get("type")
    const id = searchParams.get("id")

    if (!type || !id) {
      return NextResponse.json({ error: "Tipo e ID são obrigatórios" }, { status: 400 })
    }

    const filePath = getFilePath(type)
    const fileContent = await fs.readFile(filePath, "utf-8")
    const data = JSON.parse(fileContent)

    // Buscar o item em todas as páginas
    let foundItem = null
    for (const page of data.pages) {
      const item = page.results.find((item: any) => String(item.id) === String(id))
      if (item) {
        foundItem = item
        break
      }
    }

    if (!foundItem) {
      return NextResponse.json({ error: "Item não encontrado" }, { status: 404 })
    }

    return NextResponse.json(foundItem)
  } catch (error: any) {
    console.error("Erro ao buscar item:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Atualizar item
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, data: updatedData } = body

    if (!type || !updatedData || !updatedData.id) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
    }

    const filePath = getFilePath(type)
    const fileContent = await fs.readFile(filePath, "utf-8")
    const data = JSON.parse(fileContent)

    // Encontrar e atualizar o item
    let updated = false
    for (const page of data.pages) {
      const itemIndex = page.results.findIndex((item: any) => String(item.id) === String(updatedData.id))
      if (itemIndex !== -1) {
        // Manter a estrutura correta dependendo do tipo
        if (type === "filmes") {
          page.results[itemIndex] = {
            ...page.results[itemIndex],
            ...updatedData,
            id: Number(updatedData.id),
            vote_average: Number(updatedData.vote_average),
            vote_count: Number(updatedData.vote_count),
            popularity: Number(updatedData.popularity),
            adult: Boolean(updatedData.adult),
          }
        } else {
          // Para séries e animes
          page.results[itemIndex] = {
            ...page.results[itemIndex],
            ...updatedData,
            id: Number(updatedData.id),
          }
        }
        updated = true
        break
      }
    }

    if (!updated) {
      return NextResponse.json({ error: "Item não encontrado" }, { status: 404 })
    }

    // Salvar o arquivo
    await fs.writeFile(filePath, JSON.stringify(data, null, 4))

    return NextResponse.json({ message: "Item atualizado com sucesso!" })
  } catch (error: any) {
    console.error("Erro ao atualizar item:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Deletar item
export async function DELETE(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const type = searchParams.get("type")
    const id = searchParams.get("id")

    if (!type || !id) {
      return NextResponse.json({ error: "Tipo e ID são obrigatórios" }, { status: 400 })
    }

    const filePath = getFilePath(type)
    const fileContent = await fs.readFile(filePath, "utf-8")
    const data = JSON.parse(fileContent)

    // Encontrar e remover o item
    let deleted = false
    for (const page of data.pages) {
      const itemIndex = page.results.findIndex((item: any) => String(item.id) === String(id))
      if (itemIndex !== -1) {
        page.results.splice(itemIndex, 1)
        page.totalResults = Math.max(0, page.totalResults - 1)
        deleted = true
        break
      }
    }

    if (!deleted) {
      return NextResponse.json({ error: "Item não encontrado" }, { status: 404 })
    }

    // Salvar o arquivo
    await fs.writeFile(filePath, JSON.stringify(data, null, 4))

    return NextResponse.json({ message: "Item deletado com sucesso!" })
  } catch (error: any) {
    console.error("Erro ao deletar item:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
