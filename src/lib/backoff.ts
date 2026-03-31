export interface BackoffConfig {
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly jitterMs: number;
}

/**
 * Compute an exponential-backoff delay with random jitter.
 *
 * Formula: min(baseDelayMs * 2^attempt, maxDelayMs) + random(0, jitterMs)
 *
 * @param attempt  Zero-based attempt index (0 → first backoff after the first failure).
 * @param cfg      Backoff tunables – base, max, and jitter in milliseconds.
 * @returns        Delay in milliseconds before the next retry.
 */
export function calculateBackoffMs(attempt: number, cfg: BackoffConfig): number {
  const exponential = cfg.baseDelayMs * Math.pow(2, attempt);
  const clamped = Math.min(exponential, cfg.maxDelayMs);
  const jitter = Math.floor(Math.random() * cfg.jitterMs);
  return clamped + jitter;
}

/**
 * Return a `Date` that is `delayMs` milliseconds in the future.
 */
export function nextRunDate(delayMs: number, now: Date = new Date()): Date {
  return new Date(now.getTime() + delayMs);
}
