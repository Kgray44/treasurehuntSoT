import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { CommunityError } from "./domain";

export type CommunityRateLimitKey = {
  scope: string;
  accountId?: string;
  network?: string;
  subject?: string;
  action?: string;
};
export type CommunityRateLimitDecision = { allowed: boolean; remaining: number; retryAfterSeconds: number };

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function communityRateLimitKeyHash(key: CommunityRateLimitKey) {
  // The database stores only this hash. Network strings, account identifiers,
  // email-like values, sessions, and agents are never persisted as dimensions.
  return digest(
    JSON.stringify({
      scope: key.scope,
      account: key.accountId ? digest(key.accountId) : null,
      network: key.network ? digest(key.network) : null,
      subject: key.subject ? digest(key.subject) : null,
      action: key.action ? digest(key.action) : null,
    }),
  );
}
function windowEnd(now: Date, windowMs: number) {
  return new Date(Math.floor(now.getTime() / windowMs + 1) * windowMs);
}

export class DatabaseCommunityRateLimiter {
  constructor(private readonly now = () => new Date()) {}

  async consume(key: CommunityRateLimitKey, limit: number, windowMs: number): Promise<CommunityRateLimitDecision> {
    if (!key.scope || limit < 1 || windowMs < 1)
      throw new CommunityError("COMMUNITY_RATE_LIMIT_CONFIG_INVALID", "Rate-limit configuration is invalid.");
    const now = this.now();
    const keyHash = communityRateLimitKeyHash(key);
    const nextWindow = windowEnd(now, windowMs);
    try {
      return await db.$transaction(async (tx) => {
        const current = await tx.communityRateLimitBucket.findUnique({ where: { keyHash } });
        if (!current || current.windowEndsAt <= now) {
          const bucket = current
            ? await tx.communityRateLimitBucket.update({
                where: { keyHash },
                data: { scope: key.scope, count: 1, windowEndsAt: nextWindow },
              })
            : await tx.communityRateLimitBucket.create({
                data: { keyHash, scope: key.scope, count: 1, windowEndsAt: nextWindow },
              });
          return { allowed: true, remaining: Math.max(0, limit - bucket.count), retryAfterSeconds: 0 };
        }
        const consumed = await tx.communityRateLimitBucket.updateMany({
          where: { id: current.id, count: { lt: limit }, windowEndsAt: { gt: now } },
          data: { count: { increment: 1 } },
        });
        if (consumed.count)
          return { allowed: true, remaining: Math.max(0, limit - current.count - 1), retryAfterSeconds: 0 };
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.max(1, Math.ceil((current.windowEndsAt.getTime() - now.getTime()) / 1000)),
        };
      });
    } catch {
      // High-risk caller flows are fail-closed rather than silently using an
      // unbounded process-local fallback.
      throw new CommunityError("COMMUNITY_RATE_LIMIT_UNAVAILABLE", "Rate limiting is temporarily unavailable.");
    }
  }

  async cleanup(retainBefore = this.now()) {
    return db.communityRateLimitBucket.deleteMany({ where: { windowEndsAt: { lt: retainBefore } } });
  }

  async health() {
    try {
      await db.communityRateLimitBucket.count({ take: 1 });
      return { state: "HEALTHY" as const, provider: "database" as const };
    } catch {
      return { state: "UNAVAILABLE" as const, provider: "database" as const };
    }
  }
}

/** Development-only explicit adapter. It is never selected implicitly by a
 * production request path. */
export class LocalCommunityRateLimiter {
  private readonly buckets = new Map<string, { count: number; windowEndsAt: Date }>();
  constructor(private readonly now = () => new Date()) {}
  consume(key: CommunityRateLimitKey, limit: number, windowMs: number): CommunityRateLimitDecision {
    const now = this.now();
    const keyHash = communityRateLimitKeyHash(key);
    const current = this.buckets.get(keyHash);
    const bucket =
      !current || current.windowEndsAt <= now ? { count: 0, windowEndsAt: windowEnd(now, windowMs) } : current;
    if (bucket.count >= limit)
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.windowEndsAt.getTime() - now.getTime()) / 1000)),
      };
    bucket.count += 1;
    this.buckets.set(keyHash, bucket);
    return { allowed: true, remaining: limit - bucket.count, retryAfterSeconds: 0 };
  }
}

const localCommunityRateLimiter = new LocalCommunityRateLimiter();

/** The configured provider is selected at the request boundary. Database mode
 * is fail-closed: an unavailable shared store never silently becomes a
 * process-local bypass. */
export async function consumeConfiguredCommunityRateLimit(
  key: CommunityRateLimitKey,
  limit: number,
  windowMs: number,
): Promise<CommunityRateLimitDecision> {
  if (process.env.COMMUNITY_RATE_LIMIT_PROVIDER === "database")
    return new DatabaseCommunityRateLimiter().consume(key, limit, windowMs);
  return localCommunityRateLimiter.consume(key, limit, windowMs);
}
