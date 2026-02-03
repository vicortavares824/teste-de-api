import { NextRequest, NextResponse } from "next/server"
import { getDb } from '@/lib/mongodb'

/**
 * API de Migração - Atualiza URLs do proxy antigo para o novo Cloudflare Workers
 * 
 * GET /api/admin/migrate-proxy-urls - Mostra preview das alterações (dry-run)
 * POST /api/admin/migrate-proxy-urls - Executa a migração
 * 
 * Query params:
 * - type: "filmes" | "series" | "animes" | "all" (default: "all")
 * - dryRun: "true" | "false" (default: "true" para GET, "false" para POST)
 */

// URL do novo proxy Cloudflare Workers
const NEW_PROXY_URL = 'https://cdn-cinestream.appcinestream.workers.dev/proxy'

// Padrões de URLs antigas que devem ser substituídas
const OLD_PROXY_PATTERNS = [
  /https?:\/\/[^/]+\/api\/proxy\?/gi,  // Qualquer domínio com /api/proxy?
  /https?:\/\/cinestream-kappa\.vercel\.app\/api\/proxy\?/gi,
  /https?:\/\/teste-de-api-zeta\.vercel\.app\/api\/proxy\?/gi,
  /https?:\/\/localhost:\d+\/api\/proxy\?/gi,
]

function getCollectionsForType(type: string): string[] {
  switch (type) {
    case 'filmes':
      return ['filmes']
    case 'series':
      return ['series']
    case 'animes':
      return ['animes']
    case 'all':
      return ['filmes', 'series', 'animes']
    default:
      return []
  }
}

function replaceProxyUrls(value: any): { updated: boolean; newValue: any } {
  if (typeof value === 'string') {
    let newValue = value
    let updated = false
    
    for (const pattern of OLD_PROXY_PATTERNS) {
      if (pattern.test(newValue)) {
        newValue = newValue.replace(pattern, `${NEW_PROXY_URL}?`)
        updated = true
      }
      // Reset regex lastIndex
      pattern.lastIndex = 0
    }
    
    return { updated, newValue }
  }
  
  if (Array.isArray(value)) {
    let anyUpdated = false
    const newArray = value.map(item => {
      const result = replaceProxyUrls(item)
      if (result.updated) anyUpdated = true
      return result.newValue
    })
    return { updated: anyUpdated, newValue: newArray }
  }
  
  if (value && typeof value === 'object') {
    let anyUpdated = false
    const newObj: any = {}
    
    for (const [key, val] of Object.entries(value)) {
      // Pular _id do MongoDB
      if (key === '_id') {
        newObj[key] = val
        continue
      }
      
      const result = replaceProxyUrls(val)
      if (result.updated) anyUpdated = true
      newObj[key] = result.newValue
    }
    
    return { updated: anyUpdated, newValue: newObj }
  }
  
  return { updated: false, newValue: value }
}

// GET - Preview das alterações (dry-run)
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const type = searchParams.get('type') || 'all'
    
    const collections = getCollectionsForType(type)
    if (collections.length === 0) {
      return NextResponse.json({ error: 'Tipo inválido. Use: filmes, series, animes ou all' }, { status: 400 })
    }

    const db = await getDb()
    const preview: any = {
      type,
      newProxyUrl: NEW_PROXY_URL,
      collections: {},
      totalItemsToUpdate: 0,
      totalItemsScanned: 0,
    }

    for (const colName of collections) {
      const col = db.collection(colName)
      const items = await col.find({}).toArray()
      
      const itemsToUpdate: any[] = []
      
      for (const item of items) {
        preview.totalItemsScanned++
        const result = replaceProxyUrls(item)
        
        if (result.updated) {
          itemsToUpdate.push({
            id: item.id || item._id,
            title: item.title || item.name || 'Sem título',
            fieldsChanged: findChangedFields(item, result.newValue),
          })
          preview.totalItemsToUpdate++
        }
      }
      
      preview.collections[colName] = {
        total: items.length,
        toUpdate: itemsToUpdate.length,
        items: itemsToUpdate.slice(0, 10), // Mostrar apenas os primeiros 10
        hasMore: itemsToUpdate.length > 10,
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Preview da migração (nenhuma alteração feita)',
      ...preview,
    })

  } catch (error: any) {
    console.error('[Migrate] Erro no preview:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Executa a migração
export async function POST(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const type = searchParams.get('type') || 'all'
    const dryRun = searchParams.get('dryRun') === 'true'
    
    const collections = getCollectionsForType(type)
    if (collections.length === 0) {
      return NextResponse.json({ error: 'Tipo inválido. Use: filmes, series, animes ou all' }, { status: 400 })
    }

    const db = await getDb()
    const results: any = {
      type,
      dryRun,
      newProxyUrl: NEW_PROXY_URL,
      collections: {},
      totalUpdated: 0,
      totalScanned: 0,
      errors: [],
    }

    for (const colName of collections) {
      const col = db.collection(colName)
      const items = await col.find({}).toArray()
      
      let updated = 0
      let scanned = 0
      const errors: any[] = []
      
      for (const item of items) {
        scanned++
        results.totalScanned++
        
        const result = replaceProxyUrls(item)
        
        if (result.updated) {
          if (!dryRun) {
            try {
              // Remover _id do objeto de atualização
              const { _id, ...updateData } = result.newValue
              
              await col.updateOne(
                { _id: item._id },
                { $set: updateData }
              )
              updated++
              results.totalUpdated++
            } catch (e: any) {
              errors.push({
                id: item.id || item._id,
                error: e.message,
              })
              results.errors.push({
                collection: colName,
                id: item.id || item._id,
                error: e.message,
              })
            }
          } else {
            updated++
            results.totalUpdated++
          }
        }
      }
      
      results.collections[colName] = {
        total: items.length,
        scanned,
        updated,
        errors: errors.length,
      }
    }

    return NextResponse.json({
      success: true,
      message: dryRun 
        ? `[DRY-RUN] ${results.totalUpdated} itens seriam atualizados` 
        : `${results.totalUpdated} itens atualizados com sucesso!`,
      ...results,
    })

  } catch (error: any) {
    console.error('[Migrate] Erro na migração:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Helper para encontrar campos alterados
function findChangedFields(original: any, updated: any, prefix = ''): string[] {
  const changes: string[] = []
  
  for (const key of Object.keys(updated)) {
    if (key === '_id') continue
    
    const fullKey = prefix ? `${prefix}.${key}` : key
    const origVal = original[key]
    const newVal = updated[key]
    
    if (typeof newVal === 'string' && typeof origVal === 'string') {
      if (origVal !== newVal) {
        changes.push(fullKey)
      }
    } else if (typeof newVal === 'object' && newVal !== null) {
      if (typeof origVal === 'object' && origVal !== null) {
        changes.push(...findChangedFields(origVal, newVal, fullKey))
      }
    }
  }
  
  return changes
}
