import "dotenv/config";

export const config = {
  port: parseInt(process.env["PORT"] || "3000", 10),
  jwtSecret: process.env["JWT_SECRET"] || "default-secret-change-me",
  jwtExpiresIn: "24h" as const,
  logLevel: process.env["LOG_LEVEL"] || "info",
  backoff: {
    baseDelayMs: parseInt(process.env["BACKOFF_BASE_MS"] || "1000", 10),
    maxDelayMs: parseInt(process.env["BACKOFF_MAX_MS"] || "30000", 10),
    jitterMs: parseInt(process.env["BACKOFF_JITTER_MS"] || "500", 10),
  },
  cleaner: {
    ttlDays: parseInt(process.env["JOB_TTL_DAYS"] || "30", 10),
    intervalMs: parseInt(process.env["CLEANER_INTERVAL_MS"] || "86400000", 10), // 24 h
  },
} as const;
