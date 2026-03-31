import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../../lib/db.js";
import { deleteExpiredJobs } from "../../lib/cleaner.js";
import { createTestUser, createTestJob } from "../setup.js";

/** Helper: backdate a job's updatedAt to `daysAgo` days in the past. */
async function backdateJob(jobId: string, daysAgo: number): Promise<void> {
  const past = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  await prisma.job.update({
    where: { id: jobId },
    data: { updatedAt: past },
  });
}

describe("deleteExpiredJobs", () => {
  let userId: string;

  beforeEach(async () => {
    const user = await createTestUser();
    userId = user.id;
  });

  it("should delete completed jobs older than the TTL", async () => {
    const old = await createTestJob(userId, { status: "completed" });
    await backdateJob(old.id, 31);

    const fresh = await createTestJob(userId, { status: "completed" });
    // fresh keeps its default updatedAt (just created)

    const deleted = await deleteExpiredJobs(30);
    expect(deleted).toBe(1);

    // Old job is gone
    const oldRow = await prisma.job.findUnique({ where: { id: old.id } });
    expect(oldRow).toBeNull();

    // Fresh job still exists
    const freshRow = await prisma.job.findUnique({ where: { id: fresh.id } });
    expect(freshRow).not.toBeNull();
  });

  it("should delete failed jobs older than the TTL", async () => {
    const job = await createTestJob(userId, { status: "failed", errorMessage: "boom" });
    await backdateJob(job.id, 31);

    const deleted = await deleteExpiredJobs(30);
    expect(deleted).toBe(1);

    const row = await prisma.job.findUnique({ where: { id: job.id } });
    expect(row).toBeNull();
  });

  it("should delete cancelled jobs older than the TTL", async () => {
    const job = await createTestJob(userId, { status: "cancelled" });
    await backdateJob(job.id, 31);

    const deleted = await deleteExpiredJobs(30);
    expect(deleted).toBe(1);

    const row = await prisma.job.findUnique({ where: { id: job.id } });
    expect(row).toBeNull();
  });

  it("should NOT delete pending jobs regardless of age", async () => {
    const job = await createTestJob(userId, { status: "pending" });
    await backdateJob(job.id, 60);

    const deleted = await deleteExpiredJobs(30);
    expect(deleted).toBe(0);

    const row = await prisma.job.findUnique({ where: { id: job.id } });
    expect(row).not.toBeNull();
  });

  it("should NOT delete processing jobs regardless of age", async () => {
    const job = await createTestJob(userId, { status: "processing" });
    await backdateJob(job.id, 60);

    const deleted = await deleteExpiredJobs(30);
    expect(deleted).toBe(0);

    const row = await prisma.job.findUnique({ where: { id: job.id } });
    expect(row).not.toBeNull();
  });

  it("should NOT delete jobs within the TTL window", async () => {
    const job = await createTestJob(userId, { status: "completed" });
    await backdateJob(job.id, 29);

    const deleted = await deleteExpiredJobs(30);
    expect(deleted).toBe(0);

    const row = await prisma.job.findUnique({ where: { id: job.id } });
    expect(row).not.toBeNull();
  });

  it("should delete multiple expired jobs across statuses in one pass", async () => {
    const completed = await createTestJob(userId, { status: "completed" });
    const failed = await createTestJob(userId, { status: "failed", errorMessage: "err" });
    const cancelled = await createTestJob(userId, { status: "cancelled" });

    await backdateJob(completed.id, 45);
    await backdateJob(failed.id, 45);
    await backdateJob(cancelled.id, 45);

    const deleted = await deleteExpiredJobs(30);
    expect(deleted).toBe(3);
  });

  it("should return 0 when there are no expired jobs", async () => {
    await createTestJob(userId, { status: "completed" });
    await createTestJob(userId, { status: "pending" });

    const deleted = await deleteExpiredJobs(30);
    expect(deleted).toBe(0);
  });

  it("should respect a custom TTL value", async () => {
    const job = await createTestJob(userId, { status: "completed" });
    await backdateJob(job.id, 8);

    // With 30-day TTL the job survives
    expect(await deleteExpiredJobs(30)).toBe(0);

    // With 7-day TTL the job is deleted
    expect(await deleteExpiredJobs(7)).toBe(1);
  });
});
