interface CacheEntry {
  data: string;
  expiresAt: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// Persist maps on globalThis so Next.js hot reloads/server instances don't wipe them immediately
const globalCache = globalThis as unknown as {
  __rocketAiCache?: Map<string, CacheEntry>;
  __rocketRateLimit?: Map<string, RateLimitEntry>;
};

if (!globalCache.__rocketAiCache) {
  globalCache.__rocketAiCache = new Map<string, CacheEntry>();
}
if (!globalCache.__rocketRateLimit) {
  globalCache.__rocketRateLimit = new Map<string, RateLimitEntry>();
}

const aiCache = globalCache.__rocketAiCache;
const rateLimitMap = globalCache.__rocketRateLimit;

/**
 * Get cached AI text if not expired
 */
export function getAiCache(key: string): string | null {
  const entry = aiCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    aiCache.delete(key);
    return null;
  }
  return entry.data;
}

/**
 * Set AI cache text with TTL in seconds (default 180s = 3 minutes)
 */
export function setAiCache(key: string, data: string, ttlSeconds = 180): void {
  aiCache.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

/**
 * Check simple in-memory rate limit
 * Returns allowed: true/false and remaining requests in the window
 */
export function checkRateLimit(
  key: string,
  maxRequests = 12,
  windowMs = 60 * 1000
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  entry.count += 1;
  return { allowed: true, remaining: maxRequests - entry.count };
}
