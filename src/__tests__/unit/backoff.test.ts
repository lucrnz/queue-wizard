import { describe, it, expect, vi, afterEach } from "vitest";
import { calculateBackoffMs, nextRunDate } from "../../lib/backoff.js";
import type { BackoffConfig } from "../../lib/backoff.js";

const defaultConfig: BackoffConfig = {
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  jitterMs: 500,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("calculateBackoffMs", () => {
  it("should return baseDelayMs + jitter for attempt 0", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const delay = calculateBackoffMs(0, defaultConfig);
    // base * 2^0 = 1000, jitter = 0
    expect(delay).toBe(1000);
  });

  it("should double the delay for each subsequent attempt", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(calculateBackoffMs(0, defaultConfig)).toBe(1000); // 1000 * 2^0
    expect(calculateBackoffMs(1, defaultConfig)).toBe(2000); // 1000 * 2^1
    expect(calculateBackoffMs(2, defaultConfig)).toBe(4000); // 1000 * 2^2
    expect(calculateBackoffMs(3, defaultConfig)).toBe(8000); // 1000 * 2^3
  });

  it("should clamp at maxDelayMs", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    // 1000 * 2^5 = 32000, clamped to 30000
    expect(calculateBackoffMs(5, defaultConfig)).toBe(30000);
    // Very large attempt
    expect(calculateBackoffMs(20, defaultConfig)).toBe(30000);
  });

  it("should add jitter up to jitterMs", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const delay = calculateBackoffMs(0, defaultConfig);
    // base * 2^0 = 1000, jitter = floor(0.5 * 500) = 250
    expect(delay).toBe(1250);
  });

  it("should add maximum jitter when random returns just under 1", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const delay = calculateBackoffMs(0, defaultConfig);
    // base * 2^0 = 1000, jitter = floor(0.999 * 500) = 499
    expect(delay).toBe(1499);
  });

  it("should work with zero jitter", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.75);
    const cfg: BackoffConfig = { baseDelayMs: 1000, maxDelayMs: 30000, jitterMs: 0 };
    const delay = calculateBackoffMs(2, cfg);
    // 1000 * 2^2 = 4000, jitter = floor(0.75 * 0) = 0
    expect(delay).toBe(4000);
  });

  it("should handle custom config values", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const cfg: BackoffConfig = { baseDelayMs: 500, maxDelayMs: 5000, jitterMs: 100 };
    expect(calculateBackoffMs(0, cfg)).toBe(500); // 500 * 2^0
    expect(calculateBackoffMs(1, cfg)).toBe(1000); // 500 * 2^1
    expect(calculateBackoffMs(4, cfg)).toBe(5000); // 500 * 2^4 = 8000, clamped to 5000
  });
});

describe("nextRunDate", () => {
  it("should return a date delayMs in the future from now", () => {
    const now = new Date("2026-01-15T12:00:00.000Z");
    const result = nextRunDate(5000, now);
    expect(result.getTime()).toBe(now.getTime() + 5000);
  });

  it("should return a date delayMs in the future with zero delay", () => {
    const now = new Date("2026-01-15T12:00:00.000Z");
    const result = nextRunDate(0, now);
    expect(result.getTime()).toBe(now.getTime());
  });

  it("should default to current time when now is omitted", () => {
    const before = Date.now();
    const result = nextRunDate(1000);
    const after = Date.now();
    expect(result.getTime()).toBeGreaterThanOrEqual(before + 1000);
    expect(result.getTime()).toBeLessThanOrEqual(after + 1000);
  });
});
