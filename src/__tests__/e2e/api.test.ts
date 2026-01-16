import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";

const execFileAsync = promisify(execFile);

let server: Server | null = null;
let externalServer: Server | null = null;
let baseUrl = "";
let externalBaseUrl = "";
let databaseDir = "";
let databasePath = "";
let startWorker: (() => void) | null = null;
let stopWorker: (() => void) | null = null;
let resetWorkerStateForTest: (() => void) | null = null;

async function runPrismaDbPush(): Promise<void> {
  const prismaBin = path.join(
    process.cwd(),
    "node_modules",
    ".bin",
    process.platform === "win32" ? "prisma.cmd" : "prisma"
  );

  await execFileAsync(prismaBin, ["db", "push", "--url", `file:${databasePath}`], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: `file:${databasePath}`,
    },
  });
}

async function requestJson<T>(
  route: string,
  options: RequestInit = {}
): Promise<{ status: number; body: T }> {
  const headers = new Headers(options.headers ?? {});

  if (!headers.has("content-type") && options.body) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(`${baseUrl}${route}`, {
    ...options,
    headers,
  });

  const body = (await response.json()) as T;
  return { status: response.status, body };
}

async function registerUser(
  label: string
): Promise<{ email: string; password: string; token: string }> {
  const email = `${label}-${randomUUID()}@example.com`;
  const password = "password123";

  const signupResponse = await requestJson<{ success: boolean }>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ name: "E2E User", email, password }),
  });

  expect(signupResponse.status).toBe(201);
  expect(signupResponse.body.success).toBe(true);

  const signinResponse = await requestJson<{ success: boolean; data: { token: string } }>(
    "/auth/signin",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }
  );

  expect(signinResponse.status).toBe(200);
  expect(signinResponse.body.success).toBe(true);

  return { email, password, token: signinResponse.body.data.token };
}

async function createJob(
  token: string,
  payload: {
    priority?: number;
    method?: string;
    url?: string;
    headers?: string;
    body?: string | null;
  }
): Promise<{ id: string; status: string }> {
  const response = await requestJson<{
    success: boolean;
    data: { job: { id: string; status: string } };
  }>("/jobs", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      priority: payload.priority ?? 0,
      method: payload.method ?? "GET",
      url: payload.url ?? `${externalBaseUrl}/success`,
      headers: payload.headers ?? "{}",
      body: payload.body ?? null,
    }),
  });

  expect(response.status).toBe(201);
  expect(response.body.success).toBe(true);

  return response.body.data.job;
}

async function waitForJobStatus(
  jobId: string,
  token: string,
  expectedStatus: string,
  timeoutMs = 20000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const response = await requestJson<{ success: boolean; data: { job: { status: string } } }>(
      `/jobs/${jobId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (response.body.data.job.status === expectedStatus) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for job ${jobId} to reach ${expectedStatus}`);
}

describe("E2E API flow", () => {
  beforeAll(async () => {
    databaseDir = await fs.mkdtemp(path.join(os.tmpdir(), "queue-wizard-e2e-"));
    databasePath = path.join(databaseDir, "test.db");
    process.env["DATABASE_URL"] = `file:${databasePath}`;

    await runPrismaDbPush();

    const [appModule, dbModule, workerModule] = await Promise.all([
      import("../../index.js"),
      import("../../lib/db.js"),
      import("../../lib/worker.js"),
    ]);

    const { default: app } = appModule;
    const { connectDatabase } = dbModule;

    startWorker = workerModule.startWorker;
    stopWorker = workerModule.stopWorker;
    resetWorkerStateForTest = workerModule.resetWorkerStateForTest;

    await connectDatabase();

    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
      if (!server) {
        reject(new Error("Server not initialized"));
        return;
      }

      server.once("error", reject);
      server.once("listening", resolve);
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to start test server");
    }

    baseUrl = `http://127.0.0.1:${address.port}`;

    externalServer = createServer((req, res) => {
      if (req.url === "/success") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (req.url === "/fail") {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false }));
        return;
      }

      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
    });

    await new Promise<void>((resolve, reject) => {
      externalServer?.listen(0, "127.0.0.1", () => resolve());
      externalServer?.once("error", reject);
    });

    const externalAddress = externalServer.address();
    if (!externalAddress || typeof externalAddress === "string") {
      throw new Error("Failed to start external test server");
    }

    externalBaseUrl = `http://127.0.0.1:${externalAddress.port}`;
  });

  afterAll(async () => {
    stopWorker?.();

    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }

    if (externalServer) {
      await new Promise<void>((resolve, reject) => {
        externalServer?.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }

    const { disconnectDatabase } = await import("../../lib/db.js");
    await disconnectDatabase();

    if (databaseDir) {
      await fs.rm(databaseDir, { recursive: true, force: true });
    }
  });

  it("runs the core authenticated workflow", async () => {
    const healthResponse = await requestJson<{ success: boolean; data: { status: string } }>(
      "/health"
    );

    expect(healthResponse.status).toBe(200);
    expect(healthResponse.body.success).toBe(true);
    expect(healthResponse.body.data.status).toBe("healthy");

    const user = await registerUser("core");
    const authHeader = { Authorization: `Bearer ${user.token}` };

    const createdJob = await createJob(user.token, {
      priority: 1,
      method: "POST",
      url: `${externalBaseUrl}/success`,
      headers: "{}",
      body: JSON.stringify({ hello: "world" }),
    });

    expect(createdJob.status).toBe("pending");

    const listJobsResponse = await requestJson<{
      success: boolean;
      data: { jobs: Array<{ id: string }>; count: number };
    }>("/jobs", {
      headers: authHeader,
    });

    expect(listJobsResponse.status).toBe(200);
    expect(listJobsResponse.body.success).toBe(true);
    expect(listJobsResponse.body.data.jobs.some((job) => job.id === createdJob.id)).toBe(true);

    const getJobResponse = await requestJson<{ success: boolean; data: { job: { id: string } } }>(
      `/jobs/${createdJob.id}`,
      {
        headers: authHeader,
      }
    );

    expect(getJobResponse.status).toBe(200);
    expect(getJobResponse.body.data.job.id).toBe(createdJob.id);

    const queueStatusResponse = await requestJson<{
      success: boolean;
      data: { pendingCount: number; processingCount: number; failedCount: number };
    }>("/queue/status", {
      headers: authHeader,
    });

    expect(queueStatusResponse.status).toBe(200);
    expect(queueStatusResponse.body.success).toBe(true);
    expect(queueStatusResponse.body.data.pendingCount).toBeGreaterThanOrEqual(1);
  });

  it("validates inputs and missing routes", async () => {
    const invalidSignup = await requestJson<{ success: boolean; error: { message: string } }>(
      "/auth/signup",
      {
        method: "POST",
        body: JSON.stringify({ name: "", email: "bad-email", password: "" }),
      }
    );

    expect(invalidSignup.status).toBe(400);
    expect(invalidSignup.body.success).toBe(false);
    expect(invalidSignup.body.error.message).toBe("Validation error");

    const user = await registerUser("validation");

    const invalidJob = await requestJson<{ success: boolean; error: { message: string } }>(
      "/jobs",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${user.token}` },
        body: JSON.stringify({
          priority: 0,
          method: "POST",
          url: "not-a-url",
          headers: "{}",
          body: null,
        }),
      }
    );

    expect(invalidJob.status).toBe(400);
    expect(invalidJob.body.error.message).toBe("Validation error");

    const invalidJobId = await requestJson<{ success: boolean; error: { message: string } }>(
      "/jobs/not-a-uuid",
      {
        headers: { Authorization: `Bearer ${user.token}` },
      }
    );

    expect(invalidJobId.status).toBe(400);
    expect(invalidJobId.body.error.message).toBe("Validation error");

    const invalidStatusFilter = await requestJson<{ success: boolean; error: { message: string } }>(
      "/jobs?status=unknown",
      {
        headers: { Authorization: `Bearer ${user.token}` },
      }
    );

    expect(invalidStatusFilter.status).toBe(400);
    expect(invalidStatusFilter.body.error.message).toBe("Validation error");

    const notFoundResponse = await requestJson<{ success: boolean; error: { message: string } }>(
      "/does-not-exist"
    );

    expect(notFoundResponse.status).toBe(404);
    expect(notFoundResponse.body.success).toBe(false);
    expect(notFoundResponse.body.error.message).toBe("Endpoint not found");
  });

  it("enforces auth and ownership", async () => {
    const missingAuth = await requestJson<{ success: boolean; error: { message: string } }>(
      "/queue/status"
    );

    expect(missingAuth.status).toBe(401);
    expect(missingAuth.body.error.message).toBe("Missing or invalid authorization header");

    const invalidAuth = await requestJson<{ success: boolean; error: { message: string } }>(
      "/jobs",
      {
        headers: { Authorization: "Bearer invalid-token" },
      }
    );

    expect(invalidAuth.status).toBe(401);
    expect(invalidAuth.body.error.message).toBe("Invalid or expired token");

    const userA = await registerUser("owner-a");
    const userB = await registerUser("owner-b");

    const otherJob = await createJob(userB.token, {
      method: "GET",
      url: `${externalBaseUrl}/success`,
      headers: "{}",
      body: null,
    });

    const forbiddenJob = await requestJson<{ success: boolean; error: { message: string } }>(
      `/jobs/${otherJob.id}`,
      {
        headers: { Authorization: `Bearer ${userA.token}` },
      }
    );

    expect(forbiddenJob.status).toBe(404);
    expect(forbiddenJob.body.error.message).toBe("Job not found");

    const userAJobs = await requestJson<{
      success: boolean;
      data: { jobs: Array<{ id: string }> };
    }>("/jobs", {
      headers: { Authorization: `Bearer ${userA.token}` },
    });

    expect(userAJobs.status).toBe(200);
    expect(userAJobs.body.data.jobs.some((job) => job.id === otherJob.id)).toBe(false);
  });

  it("processes jobs via the worker and supports status filters", async () => {
    stopWorker?.();
    resetWorkerStateForTest?.();

    const user = await registerUser("worker");

    const successJob = await createJob(user.token, {
      method: "GET",
      url: `${externalBaseUrl}/success`,
      headers: "{}",
      body: null,
    });

    const failedJob = await createJob(user.token, {
      method: "GET",
      url: `${externalBaseUrl}/fail`,
      headers: "{}",
      body: null,
    });

    startWorker?.();

    try {
      await waitForJobStatus(successJob.id, user.token, "completed");
      await waitForJobStatus(failedJob.id, user.token, "failed");
    } finally {
      stopWorker?.();
    }

    const completedJobs = await requestJson<{
      success: boolean;
      data: { jobs: Array<{ id: string }>; count: number };
    }>("/jobs?status=completed", {
      headers: { Authorization: `Bearer ${user.token}` },
    });

    expect(completedJobs.status).toBe(200);
    expect(completedJobs.body.data.jobs.some((job) => job.id === successJob.id)).toBe(true);

    const failedJobs = await requestJson<{
      success: boolean;
      data: { jobs: Array<{ id: string }>; count: number };
    }>("/jobs?status=failed", {
      headers: { Authorization: `Bearer ${user.token}` },
    });

    expect(failedJobs.status).toBe(200);
    expect(failedJobs.body.data.jobs.some((job) => job.id === failedJob.id)).toBe(true);
  });
});
