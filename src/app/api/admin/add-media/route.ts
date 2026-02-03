import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export const runtime = 'nodejs';

// Nota: salvamento no GitHub removido — agora apenas MongoDB (upsert)

export async function POST(request: NextRequest) {
  console.log('[api/admin/add-media] POST handler called')

  // Diagnóstico rápido: garantir que a variável de ambiente do Mongo esteja definida
  if (!process.env.MONGODB_URI) {
    console.error('[api/admin/add-media] MONGODB_URI não configurado no ambiente')
    return NextResponse.json({ error: 'MONGODB_URI não configurado no ambiente. Verifique as env vars no Vercel.' }, { status: 500 })
  }

  try {
    const { type, data } = await request.json();

    if (!type || !['filmes', 'series', 'animes'].includes(type)) {
      return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
    }

  // Conectar ao Mongo e obter coleção alvo
  const db = await getDb();

    // 3. Preparar o novo item
    const newItem: any = {
      adult: false,
      backdrop_path: data.backdrop_path || '',
      backdrop_url: data.backdrop_path
        ? `https://image.tmdb.org/t/p/w1280${data.backdrop_path}`
        : '',
      genre_ids: data.genre_ids
        ? (typeof data.genre_ids === 'string' 
            ? data.genre_ids.split(',').map((id: string) => parseInt(id.trim()))
            : data.genre_ids)
        : [],
      id: parseInt(data.id),
      original_language: data.original_language || 'pt',
      overview: data.overview,
      popularity: parseFloat(data.popularity) || 0,
      poster_path: data.poster_path || '',
      poster_url: data.poster_path
        ? `https://image.tmdb.org/t/p/w500${data.poster_path}`
        : '',
      vote_average: parseFloat(data.vote_average) || 0,
      vote_count: parseInt(data.vote_count) || 0,
    };

  // Adicionar campos específicos por tipo
  if (type === 'filmes') {
      newItem.original_title = data.original_title || data.title;
      newItem.release_date = data.release_date || '';
      newItem.title = data.title;
      newItem.tmdb = String(data.id);
      
      // Para filmes, URLvideo é o campo principal (URL real do vídeo)
      // video é apenas o nome/título do arquivo
      newItem.video = data.URLvideo || data.video || '';
      newItem.URLvideo = data.URLvideo || data.video || '';
    } else {
      // Séries e Animes
      newItem.original_name = data.original_name || data.name;
      newItem.first_air_date = data.first_air_date || '';
      newItem.name = data.name;
      newItem.video = null;

      // Normalizar temporadas -> seasons: [{ number, episodes: [{ number, url }] }]
      // Aceita duas formas de entrada comuns: "temporadas" (obj) ou "seasons" (array)
      const seasons: any[] = [];

      if (Array.isArray(data.seasons) && data.seasons.length > 0) {
        for (const s of data.seasons) {
          const episodes = (s.episodes || []).map((ep: any) => ({ number: ep.number ?? ep.episode_number ?? 1, url: ep.url || ep.file || '' }));
          seasons.push({ number: s.number ?? s.season_number ?? 1, episodes });
        }
      } else if (data.temporadas && typeof data.temporadas === 'object') {
        // Ex: temporadas: { '1': { '1': 'url', '2': 'url' }, '2': { ... } }
        for (const key of Object.keys(data.temporadas)) {
          const seasonNumber = parseInt(key, 10);
          const epsObj = data.temporadas[key] || {};
          const episodes: any[] = [];
          for (const eKey of Object.keys(epsObj)) {
            const epNumber = parseInt(eKey, 10);
            episodes.push({ number: epNumber, url: epsObj[eKey] });
          }
          // ordenar por number
          episodes.sort((a, b) => a.number - b.number);
          seasons.push({ number: seasonNumber, episodes });
        }
        seasons.sort((a, b) => a.number - b.number);
      }

      if (seasons.length > 0) {
        newItem.seasons = seasons;
      }
    }

    // Escolher coleção com base no tipo e na presença de seasons
    let collectionName = 'filmes';
    if (type === 'filmes') collectionName = 'filmes';
    else if (type === 'series') collectionName = 'series';
    else if (type === 'animes') {
      if (newItem.seasons && Array.isArray(newItem.seasons) && newItem.seasons.length > 0) {
        collectionName = 'animes_series';
      } else {
        collectionName = 'animes_filmes';
      }
    }

    const col = db.collection(collectionName);

    // Verificar duplicata no Mongo
    const existing = await col.findOne({ id: newItem.id });
    if (existing) {
      const itemName = type === 'filmes' ? data.title : data.name;
      return NextResponse.json(
        {
          error: 'Duplicata',
          message: `${type === 'filmes' ? 'Filme' : type === 'series' ? 'Série' : 'Anime'} "${itemName}" já existe no banco de dados!`,
          tmdb_id: newItem.id,
        },
        { status: 409 }
      );
    }

    // Upsert com informação de retorno
    const filter = { id: newItem.id }
    const docToSave = { ...newItem, tmdb: newItem.tmdb || String(newItem.id) }
    const upsertRes = await col.updateOne(filter, { $set: docToSave }, { upsert: true })

    const resultInfo: any = { collection: collectionName }
    if (upsertRes.upsertedId) {
      resultInfo.action = 'created'
      resultInfo.upsertedId = upsertRes.upsertedId
    } else {
      resultInfo.action = 'updated'
    }

    return NextResponse.json({
      success: true,
      message: `${type === 'filmes' ? 'Filme' : type === 'series' ? 'Série' : 'Anime'} adicionado/atualizado com sucesso!`,
      item: newItem,
      savedToMongo: true,
      result: resultInfo,
    });
  } catch (error: any) {
    console.error('Erro ao adicionar mídia:', error);
    return NextResponse.json(
      { error: error.message || 'Erro desconhecido' },
      { status: 500 }
    );
  }
}

// Suporte para GET: informar que apenas POST é permitido
export async function GET(request: NextRequest) {
  return NextResponse.json({ message: 'Use POST /api/admin/add-media com body { type, data } para adicionar mídia' });
}

// Suporte para OPTIONS (CORS preflight)
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
