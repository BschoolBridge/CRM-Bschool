import { Redis } from "ioredis";
import { config } from "../config/env";
import { logger } from "./logger";

interface CacheStore {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  increment(key: string, ttlSeconds: number): Promise<number>;
}

class MemoryStore implements CacheStore {
  private readonly entries = new Map<string, { value: unknown; expiresAt: number }>();

  async get<T>(key: string): Promise<T | undefined> {
    const hit = this.entries.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return structuredClone(hit.value) as T;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (this.entries.size > 10_000) this.sweep();
    this.entries.set(key, { value: structuredClone(value), expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const current = (await this.get<number>(key)) ?? 0;
    const hit = this.entries.get(key);
    const next = current + 1;
    this.entries.set(key, { value: next, expiresAt: hit?.expiresAt ?? Date.now() + ttlSeconds * 1000 });
    return next;
  }

  private sweep() {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
  }
}

class RedisStore implements CacheStore {
  constructor(private readonly client: Redis) {}

  async get<T>(key: string): Promise<T | undefined> {
    const raw = await this.client.get(key);
    return raw === null ? undefined : (JSON.parse(raw) as T);
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), "EX", Math.max(1, ttlSeconds));
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const n = await this.client.incr(key);
    if (n === 1) await this.client.expire(key, ttlSeconds);
    return n;
  }
}

export const redis = config.redisUrl ? new Redis(config.redisUrl, { lazyConnect: false, maxRetriesPerRequest: 2 }) : null;
const store: CacheStore = redis ? new RedisStore(redis) : new MemoryStore();

/**
 * Cache failures must never break a request — callers fall back to computing the value.
 */
export const cache = {
  async get<T>(key: string): Promise<T | undefined> {
    try {
      return await store.get<T>(key);
    } catch (err) {
      logger.warn({ err, key }, "cache read failed");
      return undefined;
    }
  },
  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return;
    try {
      await store.set(key, value, ttlSeconds);
    } catch (err) {
      logger.warn({ err, key }, "cache write failed");
    }
  },
  async delete(key: string): Promise<void> {
    try {
      await store.delete(key);
    } catch (err) {
      logger.warn({ err, key }, "cache delete failed");
    }
  },
  async increment(key: string, ttlSeconds: number): Promise<number> {
    try {
      return await store.increment(key, ttlSeconds);
    } catch (err) {
      logger.warn({ err, key }, "cache increment failed");
      return 0;
    }
  },
  async remember<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
    if (ttlSeconds > 0) {
      const hit = await this.get<T>(key);
      if (hit !== undefined) return hit;
    }
    const value = await compute();
    await this.set(key, value, ttlSeconds);
    return value;
  },
};
