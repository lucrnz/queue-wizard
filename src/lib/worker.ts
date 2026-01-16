import { z } from "zod";

import { prisma } from "./db.js";
import { createJobLogger, createWorkerLogger } from "./logger.js";
import type { Job } from "../generated/prisma/client.js";

export const maxConcurrent = 5;

const pollIntervalMs = 2500;
const requestTimeoutMs = 10000;
const maxAttempts = 3;
const workerId = "main";

let currentWorkers = 0;
let poller: NodeJS.Timeout | null = null;
let isTickRunning = false;

const workerLogger = createWorkerLogger(workerId);
const headersSchema = z.record(z.string(), z.string());

function parseHeaders(headersJson: string): Record<string, string> {
  const parsed: unknown = JSON.parse(headersJson);
  return headersSchema.parse(parsed);
}

function parseBody(bodyJson: string | null): string | undefined {
  if (!bodyJson) {
    return undefined;
  }

  const parsed: unknown = JSON.parse(bodyJson);
  return JSON.stringify(parsed);
}

async function claimNextJob(): Promise<Job | null> {
  const jobs = await prisma.$queryRaw<Job[]>`
    UPDATE Job
    SET status = 'processing',
        attempts = attempts + 1,
        updatedAt = CURRENT_TIMESTAMP
    WHERE id = (
      SELECT id FROM Job
      WHERE status = 'pending'
      ORDER BY priority ASC, createdAt ASC
      LIMIT 1
    )
    RETURNING
      id,
      priority,
      method,
      url,
      headers,
      body,
      status,
      attempts,
      result,
      errorMessage,
      createdAt,
      updatedAt,
      userId;
  `;

  return jobs[0] ?? null;
}

async function executeJob(job: Job): Promise<void> {
  const jobLogger = createJobLogger(job.id);
  const startedAt = Date.now();

  currentWorkers += 1;
  jobLogger.info({ attempts: job.attempts, method: job.method, url: job.url }, "job.started");

  try {
    const rawHeaders = parseHeaders(job.headers);
    const body = parseBody(job.body ?? null);
    const headers: Record<string, string> = { ...rawHeaders };
    const hasContentType = Object.keys(headers).some((key) => key.toLowerCase() === "content-type");

    if (body && !hasContentType) {
      headers["content-type"] = "application/json";
    }

    if (body) {
      headers["accept"] = headers["accept"] ?? "application/json";
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

    try {
      const response = await fetch(job.url, {
        method: job.method,
        headers,
        body: body && job.method !== "GET" ? body : undefined,
        signal: controller.signal,
      });

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}: ${responseText}`);
      }

      let result = responseText;
      const contentType = response.headers.get("content-type") ?? "";

      if (contentType.includes("application/json")) {
        try {
          const parsed: unknown = JSON.parse(responseText);
          result = JSON.stringify(parsed);
        } catch {
          result = responseText;
        }
      }

      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: "completed",
          result,
          errorMessage: null,
        },
      });

      jobLogger.info({ durationMs: Date.now() - startedAt }, "job.completed");
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    const nextAttempts = job.attempts + 1;

    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: nextAttempts < maxAttempts ? "pending" : "failed",
        errorMessage,
        result: null,
        attempts: {
          increment: 1,
        },
      },
    });

    jobLogger.warn(
      { durationMs: Date.now() - startedAt, attempts: nextAttempts, errorMessage },
      "job.failed"
    );
  } finally {
    currentWorkers = Math.max(0, currentWorkers - 1);
  }
}

async function runTick(): Promise<void> {
  if (isTickRunning) {
    return;
  }

  isTickRunning = true;

  try {
    while (currentWorkers < maxConcurrent) {
      const job = await claimNextJob();

      if (!job) {
        break;
      }

      void executeJob(job);
    }
  } catch (error) {
    workerLogger.error({ err: error }, "worker.tick_failed");
  } finally {
    isTickRunning = false;
  }
}

export function startWorker(): void {
  if (poller) {
    return;
  }

  workerLogger.info({ maxConcurrent, pollIntervalMs }, "worker.started");

  poller = setInterval(() => {
    void runTick();
  }, pollIntervalMs);

  void runTick();
}

export function resetWorkerStateForTest(): void {
  currentWorkers = 0;
  isTickRunning = false;
  poller = null;
}

export function stopWorker(): void {
  if (!poller) {
    return;
  }

  clearInterval(poller);
  poller = null;
  isTickRunning = false;
  workerLogger.info("worker.stopped");
}

export function getWorkerStatus(): {
  readonly currentWorkers: number;
  readonly maxConcurrent: number;
} {
  return { currentWorkers, maxConcurrent };
}
