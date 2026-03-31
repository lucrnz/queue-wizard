import { config } from "./config.js";
import { prisma } from "./db.js";
import { createChildLogger } from "./logger.js";

const cleanerLogger = createChildLogger({ scope: "cleaner" });

let timer: NodeJS.Timeout | null = null;

/**
 * Compute the cutoff `Date` — jobs with `updatedAt` before this are expired.
 * Extracted as a pure helper so tests can verify the arithmetic.
 */
export function ttlCutoffDate(ttlDays: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - ttlDays * 24 * 60 * 60 * 1000);
}

/**
 * Delete all completed / failed / cancelled jobs whose `updatedAt`
 * is older than the configured TTL.  Returns the number of rows removed.
 */
export async function deleteExpiredJobs(ttlDays: number = config.cleaner.ttlDays): Promise<number> {
  const cutoff = ttlCutoffDate(ttlDays);

  const result = await prisma.job.deleteMany({
    where: {
      status: { in: ["completed", "failed", "cancelled"] },
      updatedAt: { lt: cutoff },
    },
  });

  if (result.count > 0) {
    cleanerLogger.info(
      { deletedCount: result.count, ttlDays, cutoff: cutoff.toISOString() },
      "cleaner.expired_jobs_deleted"
    );
  } else {
    cleanerLogger.debug({ ttlDays, cutoff: cutoff.toISOString() }, "cleaner.no_expired_jobs");
  }

  return result.count;
}

/**
 * Start the periodic cleaner.  Runs an initial pass immediately, then
 * repeats on the configured interval (default 24 h).  Safe to call
 * multiple times — subsequent calls are no-ops.
 */
export function startCleaner(): void {
  if (timer) {
    return;
  }

  const { ttlDays, intervalMs } = config.cleaner;

  cleanerLogger.info({ ttlDays, intervalMs }, "cleaner.started");

  // Fire-and-forget initial run
  void deleteExpiredJobs(ttlDays);

  timer = setInterval(() => {
    void deleteExpiredJobs(ttlDays);
  }, intervalMs);
}

/**
 * Stop the periodic cleaner.
 */
export function stopCleaner(): void {
  if (!timer) {
    return;
  }

  clearInterval(timer);
  timer = null;
  cleanerLogger.info("cleaner.stopped");
}
