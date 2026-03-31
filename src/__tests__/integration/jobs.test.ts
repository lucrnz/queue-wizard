import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../index.js";
import { prisma } from "../../lib/db.js";
import { generateToken } from "../../lib/jwt.js";
import { createTestUser, createTestJob } from "../setup.js";

describe("POST /jobs", () => {
  let token: string;
  let userId: string;

  beforeEach(async () => {
    const user = await createTestUser();
    userId = user.id;
    token = generateToken(userId);
  });

  it("should create a job with minimal data", async () => {
    const response = await request(app).post("/jobs").set("Authorization", `Bearer ${token}`).send({
      method: "GET",
      url: "https://api.example.com/data",
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.job.method).toBe("GET");
    expect(response.body.data.job.url).toBe("https://api.example.com/data");
    expect(response.body.data.job.status).toBe("pending");
    expect(response.body.data.job.priority).toBe(0);
    expect(response.body.data.job.userId).toBe(userId);
  });

  it("should create a job with full data", async () => {
    const response = await request(app).post("/jobs").set("Authorization", `Bearer ${token}`).send({
      method: "POST",
      url: "https://api.example.com/create",
      priority: 5,
      headers: '{"Content-Type": "application/json"}',
      body: '{"name": "test"}',
    });

    expect(response.status).toBe(201);
    expect(response.body.data.job.method).toBe("POST");
    expect(response.body.data.job.priority).toBe(5);
    expect(response.body.data.job.headers).toBe('{"Content-Type": "application/json"}');
    expect(response.body.data.job.body).toBe('{"name": "test"}');
  });

  it("should reject without auth", async () => {
    const response = await request(app).post("/jobs").send({
      method: "GET",
      url: "https://api.example.com/data",
    });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("should reject with invalid token", async () => {
    const response = await request(app)
      .post("/jobs")
      .set("Authorization", "Bearer invalid-token")
      .send({
        method: "GET",
        url: "https://api.example.com/data",
      });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("should reject invalid HTTP method", async () => {
    const response = await request(app).post("/jobs").set("Authorization", `Bearer ${token}`).send({
      method: "INVALID",
      url: "https://api.example.com/data",
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should reject invalid URL", async () => {
    const response = await request(app).post("/jobs").set("Authorization", `Bearer ${token}`).send({
      method: "GET",
      url: "not-a-url",
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});

describe("GET /jobs", () => {
  let token: string;
  let userId: string;

  beforeEach(async () => {
    const user = await createTestUser();
    userId = user.id;
    token = generateToken(userId);
  });

  it("should return empty list when no jobs", async () => {
    const response = await request(app).get("/jobs").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.jobs).toEqual([]);
    expect(response.body.data.count).toBe(0);
  });

  it("should return user's jobs", async () => {
    await createTestJob(userId, { url: "https://example.com/1" });
    await createTestJob(userId, { url: "https://example.com/2" });

    const response = await request(app).get("/jobs").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.jobs).toHaveLength(2);
    expect(response.body.data.count).toBe(2);
  });

  it("should filter by status", async () => {
    await createTestJob(userId, { status: "pending" });
    await createTestJob(userId, { status: "completed" });
    await createTestJob(userId, { status: "pending" });

    const response = await request(app)
      .get("/jobs?status=pending")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.jobs).toHaveLength(2);
    expect(response.body.data.jobs.every((j: { status: string }) => j.status === "pending")).toBe(
      true
    );
  });

  it("should not return other user's jobs", async () => {
    // Create another user with jobs
    const otherUser = await createTestUser({ email: "other@example.com" });
    await createTestJob(otherUser.id);

    // Create jobs for our user
    await createTestJob(userId);

    const response = await request(app).get("/jobs").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.jobs).toHaveLength(1);
    expect(response.body.data.jobs[0].userId).toBe(userId);
  });

  it("should reject without auth", async () => {
    const response = await request(app).get("/jobs");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });
});

describe("GET /jobs/:id", () => {
  let token: string;
  let userId: string;

  beforeEach(async () => {
    const user = await createTestUser();
    userId = user.id;
    token = generateToken(userId);
  });

  it("should return a specific job", async () => {
    const job = await createTestJob(userId, { url: "https://example.com/test" });

    const response = await request(app)
      .get(`/jobs/${job.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.job.id).toBe(job.id);
    expect(response.body.data.job.url).toBe("https://example.com/test");
  });

  it("should return 404 for non-existent job", async () => {
    const response = await request(app)
      .get("/jobs/123e4567-e89b-12d3-a456-426614174000")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe("Job not found");
  });

  it("should return 404 for another user's job", async () => {
    // Create another user's job
    const otherUser = await createTestUser({ email: "other@example.com" });
    const otherJob = await createTestJob(otherUser.id);

    const response = await request(app)
      .get(`/jobs/${otherJob.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe("Job not found");
  });

  it("should reject invalid UUID", async () => {
    const response = await request(app)
      .get("/jobs/not-a-uuid")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should reject without auth", async () => {
    const job = await createTestJob(userId);

    const response = await request(app).get(`/jobs/${job.id}`);

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });
});

describe("DELETE /jobs/:id", () => {
  let token: string;
  let userId: string;

  beforeEach(async () => {
    const user = await createTestUser();
    userId = user.id;
    token = generateToken(userId);
  });

  it("should cancel a pending job", async () => {
    const job = await createTestJob(userId, { status: "pending" });

    const response = await request(app)
      .delete(`/jobs/${job.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.job.id).toBe(job.id);
    expect(response.body.data.job.status).toBe("cancelled");

    // Verify the job still exists in the database with cancelled status
    const dbJob = await prisma.job.findUnique({ where: { id: job.id } });
    expect(dbJob).not.toBeNull();
    expect(dbJob!.status).toBe("cancelled");
  });

  it("should permanently delete a completed job", async () => {
    const job = await createTestJob(userId, { status: "completed" });

    const response = await request(app)
      .delete(`/jobs/${job.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.message).toBe("Job permanently deleted");

    // Verify the job no longer exists in the database
    const dbJob = await prisma.job.findUnique({ where: { id: job.id } });
    expect(dbJob).toBeNull();
  });

  it("should permanently delete a failed job", async () => {
    const job = await createTestJob(userId, { status: "failed" });

    const response = await request(app)
      .delete(`/jobs/${job.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.message).toBe("Job permanently deleted");

    // Verify the job no longer exists in the database
    const dbJob = await prisma.job.findUnique({ where: { id: job.id } });
    expect(dbJob).toBeNull();
  });

  it("should return 409 for a processing job", async () => {
    const job = await createTestJob(userId, { status: "processing" });

    const response = await request(app)
      .delete(`/jobs/${job.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe("Cannot delete a job that is currently processing");
  });

  it("should return 409 for an already cancelled job", async () => {
    const job = await createTestJob(userId, { status: "cancelled" });

    const response = await request(app)
      .delete(`/jobs/${job.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe("Job is already cancelled");
  });

  it("should return 404 for non-existent job", async () => {
    const response = await request(app)
      .delete("/jobs/123e4567-e89b-12d3-a456-426614174000")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe("Job not found");
  });

  it("should return 404 for another user's job", async () => {
    const otherUser = await createTestUser({ email: "other@example.com" });
    const otherJob = await createTestJob(otherUser.id, { status: "pending" });

    const response = await request(app)
      .delete(`/jobs/${otherJob.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe("Job not found");
  });

  it("should reject invalid UUID", async () => {
    const response = await request(app)
      .delete("/jobs/not-a-uuid")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should reject without auth", async () => {
    const job = await createTestJob(userId, { status: "pending" });

    const response = await request(app).delete(`/jobs/${job.id}`);

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });
});

describe("POST /jobs/:id/retry", () => {
  let token: string;
  let userId: string;

  beforeEach(async () => {
    const user = await createTestUser();
    userId = user.id;
    token = generateToken(userId);
  });

  it("should retry a failed job", async () => {
    const job = await createTestJob(userId, {
      status: "failed",
      attempts: 4,
      errorMessage: "Request failed with status 500",
    });

    const response = await request(app)
      .post(`/jobs/${job.id}/retry`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.job.id).toBe(job.id);
    expect(response.body.data.job.status).toBe("pending");
    expect(response.body.data.job.attempts).toBe(0);
    expect(response.body.data.job.retries).toBe(1);
    expect(response.body.data.job.errorMessage).toBeNull();
    expect(response.body.data.job.result).toBeNull();
  });

  it("should verify the database state after retry", async () => {
    const job = await createTestJob(userId, {
      status: "failed",
      attempts: 4,
      errorMessage: "Connection timeout",
    });

    await request(app).post(`/jobs/${job.id}/retry`).set("Authorization", `Bearer ${token}`);

    const dbJob = await prisma.job.findUnique({ where: { id: job.id } });
    expect(dbJob).not.toBeNull();
    expect(dbJob!.status).toBe("pending");
    expect(dbJob!.attempts).toBe(0);
    expect(dbJob!.retries).toBe(1);
    expect(dbJob!.errorMessage).toBeNull();
    expect(dbJob!.result).toBeNull();
  });

  it("should increment retries counter on each retry", async () => {
    const job = await createTestJob(userId, {
      status: "failed",
      attempts: 4,
      retries: 0,
      errorMessage: "Server error",
    });

    // First retry
    await request(app).post(`/jobs/${job.id}/retry`).set("Authorization", `Bearer ${token}`);

    // Simulate the job failing again
    await prisma.job.update({
      where: { id: job.id },
      data: { status: "failed", attempts: 4, errorMessage: "Server error again" },
    });

    // Second retry
    const response = await request(app)
      .post(`/jobs/${job.id}/retry`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.job.retries).toBe(2);
    expect(response.body.data.job.attempts).toBe(0);
    expect(response.body.data.job.status).toBe("pending");
  });

  it("should return 409 for a pending job", async () => {
    const job = await createTestJob(userId, { status: "pending" });

    const response = await request(app)
      .post(`/jobs/${job.id}/retry`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe("Job is already pending");
  });

  it("should return 409 for a processing job", async () => {
    const job = await createTestJob(userId, { status: "processing" });

    const response = await request(app)
      .post(`/jobs/${job.id}/retry`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe("Cannot retry a job that is currently processing");
  });

  it("should return 409 for a completed job", async () => {
    const job = await createTestJob(userId, { status: "completed" });

    const response = await request(app)
      .post(`/jobs/${job.id}/retry`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe("Cannot retry a completed job");
  });

  it("should return 409 for a cancelled job", async () => {
    const job = await createTestJob(userId, { status: "cancelled" });

    const response = await request(app)
      .post(`/jobs/${job.id}/retry`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe("Cannot retry a cancelled job");
  });

  it("should return 404 for non-existent job", async () => {
    const response = await request(app)
      .post("/jobs/123e4567-e89b-12d3-a456-426614174000/retry")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe("Job not found");
  });

  it("should return 404 for another user's job", async () => {
    const otherUser = await createTestUser({ email: "other@example.com" });
    const otherJob = await createTestJob(otherUser.id, {
      status: "failed",
      errorMessage: "Some error",
    });

    const response = await request(app)
      .post(`/jobs/${otherJob.id}/retry`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe("Job not found");
  });

  it("should reject invalid UUID", async () => {
    const response = await request(app)
      .post("/jobs/not-a-uuid/retry")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should reject without auth", async () => {
    const job = await createTestJob(userId, {
      status: "failed",
      errorMessage: "Some error",
    });

    const response = await request(app).post(`/jobs/${job.id}/retry`);

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("should clear nextRunAt on retry so the job is immediately eligible for processing", async () => {
    const futureDate = new Date(Date.now() + 60_000);
    const job = await createTestJob(userId, {
      status: "failed",
      attempts: 4,
      errorMessage: "Backoff failure",
      nextRunAt: futureDate,
    });

    // Verify the job has a future nextRunAt
    const before = await prisma.job.findUnique({ where: { id: job.id } });
    expect(before!.nextRunAt).not.toBeNull();

    const response = await request(app)
      .post(`/jobs/${job.id}/retry`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.job.status).toBe("pending");

    // Verify nextRunAt was cleared in the database
    const after = await prisma.job.findUnique({ where: { id: job.id } });
    expect(after!.nextRunAt).toBeNull();
    expect(after!.attempts).toBe(0);
    expect(after!.retries).toBe(1);
  });
});

describe("POST /jobs/batch", () => {
  let token: string;
  let userId: string;

  beforeEach(async () => {
    const user = await createTestUser();
    userId = user.id;
    token = generateToken(userId);
  });

  it("should create multiple jobs atomically", async () => {
    const response = await request(app)
      .post("/jobs/batch")
      .set("Authorization", `Bearer ${token}`)
      .send({
        jobs: [
          { method: "GET", url: "https://api.example.com/one" },
          { method: "POST", url: "https://api.example.com/two", body: '{"key":"val"}' },
          { method: "PUT", url: "https://api.example.com/three", priority: 5 },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.jobs).toHaveLength(3);
    expect(response.body.data.count).toBe(3);

    // Verify each job has correct data
    expect(response.body.data.jobs[0].method).toBe("GET");
    expect(response.body.data.jobs[0].url).toBe("https://api.example.com/one");
    expect(response.body.data.jobs[1].method).toBe("POST");
    expect(response.body.data.jobs[1].body).toBe('{"key":"val"}');
    expect(response.body.data.jobs[2].priority).toBe(5);

    // Every job should be pending and belong to the authenticated user
    for (const job of response.body.data.jobs) {
      expect(job.status).toBe("pending");
      expect(job.userId).toBe(userId);
      expect(job.id).toBeDefined();
    }
  });

  it("should accept a single job in the array", async () => {
    const response = await request(app)
      .post("/jobs/batch")
      .set("Authorization", `Bearer ${token}`)
      .send({
        jobs: [{ method: "GET", url: "https://api.example.com/single" }],
      });

    expect(response.status).toBe(201);
    expect(response.body.data.jobs).toHaveLength(1);
    expect(response.body.data.count).toBe(1);
    expect(response.body.data.jobs[0].url).toBe("https://api.example.com/single");
  });

  it("should apply defaults for optional fields", async () => {
    const response = await request(app)
      .post("/jobs/batch")
      .set("Authorization", `Bearer ${token}`)
      .send({
        jobs: [{ method: "GET", url: "https://api.example.com/defaults" }],
      });

    expect(response.status).toBe(201);
    const job = response.body.data.jobs[0];
    expect(job.priority).toBe(0);
    expect(job.headers).toBe("{}");
    expect(job.body).toBeNull();
  });

  it("should persist all jobs in the database", async () => {
    const response = await request(app)
      .post("/jobs/batch")
      .set("Authorization", `Bearer ${token}`)
      .send({
        jobs: [
          { method: "GET", url: "https://api.example.com/a" },
          { method: "GET", url: "https://api.example.com/b" },
        ],
      });

    expect(response.status).toBe(201);

    const dbJobs = await prisma.job.findMany({ where: { userId } });
    expect(dbJobs).toHaveLength(2);
  });

  it("should reject an empty jobs array", async () => {
    const response = await request(app)
      .post("/jobs/batch")
      .set("Authorization", `Bearer ${token}`)
      .send({ jobs: [] });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should reject when jobs array exceeds 100 items", async () => {
    const jobs = Array.from({ length: 101 }, (_, i) => ({
      method: "GET",
      url: `https://api.example.com/${i}`,
    }));

    const response = await request(app)
      .post("/jobs/batch")
      .set("Authorization", `Bearer ${token}`)
      .send({ jobs });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should reject when any item has an invalid URL and report per-item errors", async () => {
    const response = await request(app)
      .post("/jobs/batch")
      .set("Authorization", `Bearer ${token}`)
      .send({
        jobs: [
          { method: "GET", url: "https://api.example.com/valid" },
          { method: "GET", url: "not-a-url" },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.details).toBeDefined();

    // The error path should reference the item index
    const paths = response.body.error.details.map((d: { path: string; message: string }) => d.path);
    expect(paths.some((p: string) => p.includes("1"))).toBe(true);
  });

  it("should reject when any item has an invalid HTTP method", async () => {
    const response = await request(app)
      .post("/jobs/batch")
      .set("Authorization", `Bearer ${token}`)
      .send({
        jobs: [
          { method: "GET", url: "https://api.example.com/valid" },
          { method: "INVALID", url: "https://api.example.com/bad-method" },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should not create any jobs when validation fails (atomic)", async () => {
    await request(app)
      .post("/jobs/batch")
      .set("Authorization", `Bearer ${token}`)
      .send({
        jobs: [
          { method: "GET", url: "https://api.example.com/valid" },
          { method: "GET", url: "bad-url" },
        ],
      });

    // No jobs should have been created
    const dbJobs = await prisma.job.findMany({ where: { userId } });
    expect(dbJobs).toHaveLength(0);
  });

  it("should reject when body is not an object with a jobs key", async () => {
    const response = await request(app)
      .post("/jobs/batch")
      .set("Authorization", `Bearer ${token}`)
      .send([{ method: "GET", url: "https://api.example.com/data" }]);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should reject when jobs field is not an array", async () => {
    const response = await request(app)
      .post("/jobs/batch")
      .set("Authorization", `Bearer ${token}`)
      .send({ jobs: "not-an-array" });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should reject without auth", async () => {
    const response = await request(app)
      .post("/jobs/batch")
      .send({
        jobs: [{ method: "GET", url: "https://api.example.com/data" }],
      });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("should reject with an invalid token", async () => {
    const response = await request(app)
      .post("/jobs/batch")
      .set("Authorization", "Bearer invalid-token")
      .send({
        jobs: [{ method: "GET", url: "https://api.example.com/data" }],
      });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("should accept exactly 100 jobs", async () => {
    const jobs = Array.from({ length: 100 }, (_, i) => ({
      method: "GET" as const,
      url: `https://api.example.com/${i}`,
    }));

    const response = await request(app)
      .post("/jobs/batch")
      .set("Authorization", `Bearer ${token}`)
      .send({ jobs });

    expect(response.status).toBe(201);
    expect(response.body.data.jobs).toHaveLength(100);
    expect(response.body.data.count).toBe(100);
  });
});
