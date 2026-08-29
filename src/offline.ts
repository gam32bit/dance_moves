// Per-move "make available offline" for bundled seed clips, using the Cache API
// directly (separate from the Workbox-managed caches).

const CACHE = 'clip-videos';

export function clipUrl(baseUrl: string, seedClip: string): string {
  return `${baseUrl}clips/${seedClip}`;
}

export async function isClipCached(url: string): Promise<boolean> {
  if (!('caches' in window)) return false;
  const cache = await caches.open(CACHE);
  return !!(await cache.match(url));
}

export async function cacheClip(url: string): Promise<void> {
  const cache = await caches.open(CACHE);
  await cache.add(url);
}

export async function uncacheClip(url: string): Promise<void> {
  const cache = await caches.open(CACHE);
  await cache.delete(url);
}
