// Simpele in-memory cache met TTL, om de gratis Finnhub rate limit te ontzien.
const store = new Map();

export async function cached(key, ttlMs, fn) {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) {
    return hit.value;
  }
  const value = await fn();
  store.set(key, { value, expires: now + ttlMs });
  return value;
}
