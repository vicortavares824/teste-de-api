import { NextRequest, NextResponse } from "next/server"
import { getDb } from '@/lib/mongodb'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const type = searchParams.get("type")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const search = searchParams.get("search") || ""
    const kind = searchParams.get("kind") || undefined // opcional: ajuda a escolher animes_series vs animes_filmes

    if (!type) {
      return NextResponse.json({ error: "Tipo é obrigatório" }, { status: 400 })
    }

    // Mapear type para coleção
    let collectionName = ''
    if (type === 'filmes') collectionName = 'filmes'
    else if (type === 'series') collectionName = 'series'
    else if (type === 'animes') {
      if (kind === 'series') collectionName = 'animes_series'
      else if (kind === 'filmes') collectionName = 'animes_filmes'
      else collectionName = 'animes_series' // default
    } else {
      return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
    }

    const db = await getDb()
    const col = db.collection(collectionName)

    // Construir filtro de busca simples (nome/title)
    const filter: any = {}
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { original_title: { $regex: search, $options: 'i' } },
        { original_name: { $regex: search, $options: 'i' } },
      ]
    }

    const total = await col.countDocuments(filter)
    const items = await col
      .find(filter)
      .sort({ id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray()

    return NextResponse.json({
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error: any) {
    console.error("Erro ao listar itens:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
