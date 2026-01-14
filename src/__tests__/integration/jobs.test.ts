import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../index.js";
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
