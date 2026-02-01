import { MongoClient } from 'mongodb'

declare global {
  // eslint-disable-next-line no-var
  var __mongoClientPromise: Promise<MongoClient> | undefined
}

const uri = process.env.MONGODB_URI
const dbName = process.env.MONGODB_DB || 'CineStreamApp'

if (!uri) {
  console.warn('MONGODB_URI não configurado — operações Mongo serão ignoradas.')
}

let cachedClient: Promise<MongoClient> | undefined

export function getMongoClient(): Promise<MongoClient> {
  if (!uri) throw new Error('MONGODB_URI não configurado')
  if (!cachedClient) {
    const client = new MongoClient(uri)
    cachedClient = client.connect()
    // @ts-ignore
    global.__mongoClientPromise = cachedClient
  }
  return cachedClient!
}

export async function getDb() {
  const client = await getMongoClient()
  return client.db(dbName)
}
