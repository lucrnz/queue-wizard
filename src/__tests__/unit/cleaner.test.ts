import { describe, it, expect } from "vitest";
import { ttlCutoffDate } from "../../lib/cleaner.js";

describe("ttlCutoffDate", () => {
  it("should return a date ttlDays in the past", () => {
    const now = new Date("2026-06-15T12:00:00.000Z");
    const cutoff = ttlCutoffDate(30, now);

    const expectedMs = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    expect(cutoff.getTime()).toBe(expectedMs);
    expect(cutoff.toISOString()).toBe("2026-05-16T12:00:00.000Z");
  });

  it("should return the same date when ttlDays is 0", () => {
    const now = new Date("2026-06-15T12:00:00.000Z");
    const cutoff = ttlCutoffDate(0, now);
    expect(cutoff.getTime()).toBe(now.getTime());
  });

  it("should handle ttlDays of 1", () => {
    const now = new Date("2026-03-02T00:00:00.000Z");
    const cutoff = ttlCutoffDate(1, now);
    expect(cutoff.toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });

  it("should handle large ttlDays", () => {
    const now = new Date("2026-12-31T23:59:59.000Z");
    const cutoff = ttlCutoffDate(365, now);
    // 365 days before 2026-12-31 → 2025-12-31
    expect(cutoff.toISOString()).toBe("2025-12-31T23:59:59.000Z");
  });

  it("should default to current time when now is omitted", () => {
    const before = Date.now();
    const cutoff = ttlCutoffDate(7);
    const after = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    expect(cutoff.getTime()).toBeGreaterThanOrEqual(before - sevenDaysMs);
    expect(cutoff.getTime()).toBeLessThanOrEqual(after - sevenDaysMs);
  });
});
