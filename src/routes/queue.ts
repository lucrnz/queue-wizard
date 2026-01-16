import { Router, Request, Response, NextFunction } from "express";

import { prisma } from "../lib/db.js";
import { createChildLogger } from "../lib/logger.js";
import { getWorkerStatus } from "../lib/worker.js";
import { authMiddleware } from "../middleware/auth.js";
import { AuthenticationError } from "../lib/errors.js";

const router = Router();

router.use(authMiddleware);

// GET /queue/status - queue status overview
router.get("/status", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.userId) {
      throw new AuthenticationError("User ID not found in request");
    }

    const now = new Date();
    const startOfDay = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const [pendingCount, processingCount, failedCount, completedToday] = await Promise.all([
      prisma.job.count({ where: { status: "pending" } }),
      prisma.job.count({ where: { status: "processing" } }),
      prisma.job.count({ where: { status: "failed" } }),
      prisma.job.count({
        where: {
          status: "completed",
          updatedAt: {
            gte: startOfDay,
            lt: endOfDay,
          },
        },
      }),
    ]);

    const workerStatus = getWorkerStatus();

    createChildLogger({
      requestId: req.requestId,
      userId: req.userId,
      pendingCount,
      processingCount,
      failedCount,
      completedToday,
    }).info("queue.status");

    res.json({
      success: true,
      data: {
        pendingCount,
        processingCount,
        completedToday,
        failedCount,
        currentWorkers: workerStatus.currentWorkers,
        maxConcurrent: workerStatus.maxConcurrent,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
