import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../lib/db.js";
import { authMiddleware } from "../middleware/auth.js";
import { createJobSchema, jobQuerySchema, jobIdParamSchema } from "../lib/schemas.js";
import { NotFoundError, AuthenticationError } from "../lib/errors.js";

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

export default router;
