/**
 * Utility for Client-Side Rate Limiting
 * Protects application APIs, database writes, and auth routes against rapid spam, double clicks, and brute force.
 */

import { useState, useCallback } from 'react';

export interface RateLimitProfile {
  maxRequests: number; // Maximum allowed requests in the window
  windowMs: number;    // Window duration in milliseconds
}

export const RATE_LIMIT_PROFILES: Record<string, RateLimitProfile> = {
  // Database writes, creates, updates, deletes
  MUTATION: { maxRequests: 10, windowMs: 10000 }, // 10 requests per 10s
  // Sensitive auth actions (login, reset password)
  AUTH: { maxRequests: 5, windowMs: 60000 },      // 5 requests per 60s
  // Heavy operations like exports, bulk imports, reports
  HEAVY: { maxRequests: 4, windowMs: 15000 },     // 4 requests per 15s
  // General queries or reads
  DEFAULT: { maxRequests: 30, windowMs: 10000 },  // 30 requests per 10s
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
  retryAfterSec: number;
}

class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  /**
   * Clean up timestamps older than the window duration for a given key
   */
  private cleanup(key: string, windowMs: number): number[] {
    const now = Date.now();
    const timestamps = (this.requests.get(key) || []).filter(
      (ts) => now - ts < windowMs
    );
    this.requests.set(key, timestamps);
    return timestamps;
  }

  /**
   * Check if an action is currently allowed without consuming a token
   */
  public check(
    key: string,
    profile: RateLimitProfile = RATE_LIMIT_PROFILES.DEFAULT
  ): RateLimitResult {
    const now = Date.now();
    const timestamps = this.cleanup(key, profile.windowMs);
    const count = timestamps.length;
    const allowed = count < profile.maxRequests;
    const oldest = timestamps[0] || now;
    const resetInMs = Math.max(0, profile.windowMs - (now - oldest));
    const retryAfterSec = Math.ceil(resetInMs / 1000);

    return {
      allowed,
      remaining: Math.max(0, profile.maxRequests - count),
      resetInMs,
      retryAfterSec,
    };
  }

  /**
   * Attempt to consume a rate limit token for a key.
   * Returns result indicating whether request was allowed and updated stats.
   */
  public consume(
    key: string,
    profile: RateLimitProfile = RATE_LIMIT_PROFILES.DEFAULT
  ): RateLimitResult {
    const checkResult = this.check(key, profile);

    if (!checkResult.allowed) {
      return checkResult;
    }

    const now = Date.now();
    const timestamps = this.requests.get(key) || [];
    timestamps.push(now);
    this.requests.set(key, timestamps);

    return {
      allowed: true,
      remaining: Math.max(0, profile.maxRequests - timestamps.length),
      resetInMs: checkResult.resetInMs,
      retryAfterSec: checkResult.retryAfterSec,
    };
  }

  /**
   * Reset rate limit state for a key
   */
  public reset(key: string): void {
    this.requests.delete(key);
  }

  /**
   * Clear all rate limits
   */
  public clearAll(): void {
    this.requests.clear();
  }
}

export const rateLimiter = new RateLimiter();

/**
 * Higher Order Function wrapper that executes an async function only if rate limit is respected.
 * Throws a user-friendly error in Portuguese if rate limit is exceeded.
 */
export async function withRateLimit<T>(
  key: string,
  fn: () => Promise<T>,
  profile: RateLimitProfile = RATE_LIMIT_PROFILES.MUTATION,
  customErrorMessage?: string
): Promise<T> {
  const result = rateLimiter.consume(key, profile);

  if (!result.allowed) {
    const msg =
      customErrorMessage ||
      `Limite de requisições excedido. Aguarde ${result.retryAfterSec} segundo(s) antes de tentar novamente.`;
    throw new Error(msg);
  }

  return await fn();
}

export function useRateLimit(
  key: string,
  profile: RateLimitProfile = RATE_LIMIT_PROFILES.MUTATION
) {
  const [status, setStatus] = useState<RateLimitResult>(() =>
    rateLimiter.check(key, profile)
  );

  const execute = useCallback(
    async <T,>(fn: () => Promise<T>, customErrorMsg?: string): Promise<T> => {
      const consumed = rateLimiter.consume(key, profile);
      setStatus(consumed);

      if (!consumed.allowed) {
        const msg =
          customErrorMsg ||
          `Limite de requisições excedido. Aguarde ${consumed.retryAfterSec}s antes de tentar novamente.`;
        throw new Error(msg);
      }

      try {
        return await fn();
      } finally {
        setStatus(rateLimiter.check(key, profile));
      }
    },
    [key, profile]
  );

  const reset = useCallback(() => {
    rateLimiter.reset(key);
    setStatus(rateLimiter.check(key, profile));
  }, [key, profile]);

  return {
    isAllowed: status.allowed,
    remaining: status.remaining,
    retryAfterSec: status.retryAfterSec,
    execute,
    reset,
  };
}
