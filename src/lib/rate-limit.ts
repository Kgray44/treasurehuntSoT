type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

const buckets = new Map<string, RateLimitBucket>();

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * Small process-local guard for interactive endpoints. The durable authorization,
 * idempotency, and optimistic-concurrency checks remain authoritative; this guard
 * limits accidental bursts and single-process abuse without persisting secrets.
 */
export function consumeRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);
  const bucket = !existing || existing.resetAt <= now ? { count: 0, resetAt: now + options.windowMs } : existing;
  bucket.count += 1;
  buckets.set(key, bucket);

  if (buckets.size > 2_000) {
    for (const [candidate, value] of buckets) {
      if (value.resetAt <= now) buckets.delete(candidate);
    }
  }

  return {
    allowed: bucket.count <= options.limit,
    limit: options.limit,
    remaining: Math.max(0, options.limit - bucket.count),
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000)),
  };
}

export function rateLimitHeaders(result: RateLimitResult) {
  return {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "Retry-After": String(result.retryAfterSeconds),
  };
}
