import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../lib/db.js";
import { createChildLogger } from "../lib/logger.js";
import { authMiddleware } from "../middleware/auth.js";
import {
  createJobSchema,
  batchCreateJobsSchema,
  jobQuerySchema,
  jobIdParamSchema,
} from "../lib/schemas.js";
import { NotFoundError, AuthenticationError, ConflictError } from "../lib/errors.js";

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// POST /jobs - create a new job
router.post("/", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.userId) {
      throw new AuthenticationError("User ID not found in request");
    }

    const validatedData = createJobSchema.parse(req.body);

    const job = await prisma.job.create({
      data: {
        priority: validatedData.priority,
        method: validatedData.method,
        url: validatedData.url,
        headers: validatedData.headers,
        body: validatedData.body,
        userId: req.userId,
      },
    });

    createChildLogger({
      requestId: req.requestId,
      userId: req.userId,
      jobId: job.id,
      method: job.method,
      url: job.url,
    }).info("job.created");

    res.status(201).json({
      success: true,
      data: {
        job,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /jobs/batch - create multiple jobs atomically
router.post("/batch", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.userId) {
      throw new AuthenticationError("User ID not found in request");
    }

    const validated = batchCreateJobsSchema.parse(req.body);

    const jobs = await prisma.$transaction(
      validated.jobs.map((jobData) =>
        prisma.job.create({
          data: {
            priority: jobData.priority,
            method: jobData.method,
            url: jobData.url,
            headers: jobData.headers,
            body: jobData.body,
            userId: req.userId!,
          },
        })
      )
    );

    createChildLogger({
      requestId: req.requestId,
      userId: req.userId,
      count: jobs.length,
    }).info("jobs.batch_created");

    res.status(201).json({
      success: true,
      data: {
        jobs,
        count: jobs.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /jobs - list user's jobs with optional status filter
router.get("/", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.userId) {
      throw new AuthenticationError("User ID not found in request");
    }

    const query = jobQuerySchema.parse(req.query);

    const whereClause: { userId: string; status?: string } = {
      userId: req.userId,
    };

    if (query.status) {
      whereClause.status = query.status;
    }

    const jobs = await prisma.job.findMany({
      where: whereClause,
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    });

    createChildLogger({
      requestId: req.requestId,
      userId: req.userId,
      status: query.status ?? null,
      count: jobs.length,
    }).info("jobs.listed");

    res.json({
      success: true,
      data: {
        jobs,
        count: jobs.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /jobs/:id - get a single job
router.get("/:id", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.userId) {
      throw new AuthenticationError("User ID not found in request");
    }

    const params = jobIdParamSchema.parse(req.params);

    const job = await prisma.job.findUnique({
      where: { id: params.id },
    });

    if (!job) {
      throw new NotFoundError("Job not found");
    }

    // Ensure the job belongs to the authenticated user
    if (job.userId !== req.userId) {
      throw new NotFoundError("Job not found");
    }

    createChildLogger({
      requestId: req.requestId,
      userId: req.userId,
      jobId: job.id,
    }).info("job.fetched");

    res.json({
      success: true,
      data: {
        job,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /jobs/:id/retry - retry a failed job
router.post(
  "/:id/retry",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.userId) {
        throw new AuthenticationError("User ID not found in request");
      }

      const params = jobIdParamSchema.parse(req.params);

      const job = await prisma.job.findUnique({
        where: { id: params.id },
      });

      if (!job) {
        throw new NotFoundError("Job not found");
      }

      // Ensure the job belongs to the authenticated user
      if (job.userId !== req.userId) {
        throw new NotFoundError("Job not found");
      }

      if (job.status !== "failed") {
        const messages: Record<string, string> = {
          pending: "Job is already pending",
          processing: "Cannot retry a job that is currently processing",
          completed: "Cannot retry a completed job",
          cancelled: "Cannot retry a cancelled job",
        };
        throw new ConflictError(messages[job.status] ?? "Job cannot be retried");
      }

      const updatedJob = await prisma.job.update({
        where: { id: params.id },
        data: {
          status: "pending",
          attempts: 0,
          retries: { increment: 1 },
          errorMessage: null,
          result: null,
          nextRunAt: null,
        },
      });

      createChildLogger({
        requestId: req.requestId,
        userId: req.userId,
        jobId: updatedJob.id,
        retries: updatedJob.retries,
      }).info("job.retried");

      res.json({
        success: true,
        data: {
          job: updatedJob,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /jobs/:id - cancel a pending job or remove a completed/failed job
router.delete("/:id", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.userId) {
      throw new AuthenticationError("User ID not found in request");
    }

    const params = jobIdParamSchema.parse(req.params);

    const job = await prisma.job.findUnique({
      where: { id: params.id },
    });

    if (!job) {
      throw new NotFoundError("Job not found");
    }

    // Ensure the job belongs to the authenticated user
    if (job.userId !== req.userId) {
      throw new NotFoundError("Job not found");
    }

    if (job.status === "processing") {
      throw new ConflictError("Cannot delete a job that is currently processing");
    }

    if (job.status === "cancelled") {
      throw new ConflictError("Job is already cancelled");
    }

    // Pending jobs are cancelled (kept for audit), completed/failed jobs are permanently removed
    if (job.status === "pending") {
      const updatedJob = await prisma.job.update({
        where: { id: params.id },
        data: { status: "cancelled" },
      });

      createChildLogger({
        requestId: req.requestId,
        userId: req.userId,
        jobId: updatedJob.id,
      }).info("job.cancelled");

      res.json({
        success: true,
        data: {
          job: updatedJob,
        },
      });
      return;
    }

    // completed or failed — permanently delete
    await prisma.job.delete({
      where: { id: params.id },
    });

    createChildLogger({
      requestId: req.requestId,
      userId: req.userId,
      jobId: params.id,
      previousStatus: job.status,
    }).info("job.deleted");

    res.json({
      success: true,
      data: {
        message: "Job permanently deleted",
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
