import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'

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

    // Tentar usar MongoDB se disponível
    try {
      const db = await getDb()
      const collections = getCollectionsForType(type!)
      const filter = buildIdFilter(id)
      for (const colName of collections) {
        const col = db.collection(colName)
        const item = await col.findOne(filter)
        if (item) return NextResponse.json(item)
      }
      return NextResponse.json({ error: "Item não encontrado" }, { status: 404 })
    } catch (e) {
      // Fallback para arquivos locais
      const filePath = getFilePath(type!)
      const fileContent = await fs.readFile(filePath, "utf-8")
      const data = JSON.parse(fileContent)

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
    }
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

    if (!type || !updatedData || (!updatedData.id && !updatedData._id && !updatedData.tmdb)) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
    }

    // Tentar atualizar via MongoDB
    try {
      const db = await getDb()
      const collections = getCollectionsForType(type)
      const filter = buildIdFilter(updatedData.id ?? updatedData._id ?? updatedData.tmdb)

      for (const colName of collections) {
        const col = db.collection(colName)
        const existing = await col.findOne(filter)
        if (existing) {
          // Se vier URLTxt, limpar campos de vídeo armazenados (comportamento antigo preservado)
          if (updatedData.URLTxt) {
            updatedData.video = ""
            updatedData.URLvideo = ""
          }

          // normalizar tipos numéricos se existirem
          if (updatedData.vote_average !== undefined) updatedData.vote_average = Number(updatedData.vote_average)
          if (updatedData.vote_count !== undefined) updatedData.vote_count = Number(updatedData.vote_count)
          if (updatedData.popularity !== undefined) updatedData.popularity = Number(updatedData.popularity)
          if (updatedData.id !== undefined) updatedData.id = Number(updatedData.id)

          updatedData.updatedAt = new Date()

          await col.updateOne(filter, { $set: updatedData })
          const saved = await col.findOne(filter)
          return NextResponse.json({ message: "Item atualizado com sucesso!", item: saved })
        }
      }

      // se não encontrou, inserir no primeiro mapeado
      const targetCol = db.collection(collections[0])
      if (updatedData.id !== undefined) updatedData.id = Number(updatedData.id)
      updatedData.createdAt = new Date()
      await targetCol.insertOne(updatedData)
      return NextResponse.json({ message: "Item criado (não existia) e atualizado com sucesso!", item: updatedData })
    } catch (e) {
      // fallback para arquivos locais
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
            const newItem = {
              ...page.results[itemIndex],
              ...updatedData,
              id: Number(updatedData.id),
              vote_average: Number(updatedData.vote_average),
              vote_count: Number(updatedData.vote_count),
              popularity: Number(updatedData.popularity),
              adult: Boolean(updatedData.adult),
            }

            // Se tiver URLTxt, limpa os campos de vídeo originais
            if (updatedData.URLTxt) {
              newItem.video = ""
              newItem.URLvideo = ""
            }

            page.results[itemIndex] = newItem
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
    }
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

    // Tentar MongoDB primeiro
    try {
      const db = await getDb()
      const collections = getCollectionsForType(type!)
      const filter = buildIdFilter(id)
      for (const colName of collections) {
        const col = db.collection(colName)
        const res = await col.deleteOne(filter)
        if (res.deletedCount && res.deletedCount > 0) {
          return NextResponse.json({ message: "Item deletado com sucesso!" })
        }
      }
      return NextResponse.json({ error: "Item não encontrado" }, { status: 404 })
    } catch (e) {
      // fallback para arquivos locais
      const filePath = getFilePath(type!)
      const fileContent = await fs.readFile(filePath, "utf-8")
      const data = JSON.parse(fileContent)

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
    }
  } catch (error: any) {
    console.error("Erro ao deletar item:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/* helpers para suporte a Mongo */

function getCollectionsForType(type: string) {
  switch (type) {
    case "filmes":
      return ["filmes"]
    case "series":
      return ["series"]
    case "animes":
      return ["animes_series", "animes_filmes", "animes"]
    default:
      return ["filmes", "series", "animes_series", "animes_filmes", "animes"]
  }
}

function buildIdFilter(id: any) {
  if (!id) return {}
  const s = String(id)
  const filters: any[] = []
  if (/^\d+$/.test(s)) {
    filters.push({ id: Number(s) })
    filters.push({ tmdb: s })
  } else {
    filters.push({ tmdb: s })
  }
  try {
    if (/^[a-fA-F0-9]{24}$/.test(s)) {
      filters.push({ _id: new ObjectId(s) })
    }
  } catch (e) {}
  return { $or: filters }
}
