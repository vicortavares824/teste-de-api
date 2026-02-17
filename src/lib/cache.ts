type InMemoryEntry = { value: any; expiresAt: number };

const inMemoryStore = new Map<string, InMemoryEntry>();

export async function getCache(key: string): Promise<any | null> {
  // Cloudflare Workers/Pages: use caches.default when available
  try {
    // @ts-ignore
    if (typeof caches !== 'undefined' && (caches as any).default) {
      const cache = (caches as any).default;
      const req = new Request(`https://edge.cache/${encodeURIComponent(key)}`);
      const res: Response | undefined = await cache.match(req);
      if (!res) return null;
      const text = await res.text().catch(() => null);
      if (!text) return null;
      return JSON.parse(text);
    }
  } catch (e) {
    // fall through to in-memory fallback
  }

  // In-memory fallback
  const entry = inMemoryStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    inMemoryStore.delete(key);
    return null;
  }
  return entry.value;
}

export async function setCache(key: string, value: any, ttlSeconds = 3600): Promise<void> {
  try {
    // @ts-ignore
    if (typeof caches !== 'undefined' && (caches as any).default) {
      const cache = (caches as any).default;
      const req = new Request(`https://edge.cache/${encodeURIComponent(key)}`);
      const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': `max-age=${ttlSeconds}` });
      const res = new Response(JSON.stringify(value), { headers });
      await cache.put(req, res.clone()).catch(() => null);
      return;
    }
  } catch (e) {
    // fall through to in-memory fallback
  }

  // In-memory fallback
  inMemoryStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export async function delCache(key: string): Promise<void> {
  try {
    // @ts-ignore
    if (typeof caches !== 'undefined' && (caches as any).default) {
      const cache = (caches as any).default;
      const req = new Request(`https://edge.cache/${encodeURIComponent(key)}`);
      await cache.delete(req).catch(() => null);
      return;
    }
  } catch (e) {
    // fall through
  }
  inMemoryStore.delete(key);
}
