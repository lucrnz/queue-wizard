import express, { Request, Response } from "express";
import { config } from "./lib/config.js";
import { connectDatabase, disconnectDatabase } from "./lib/db.js";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestLogger } from "./middleware/requestLogger.js";
import authRoutes from "./routes/auth.js";
import jobsRoutes from "./routes/jobs.js";

const app = express();

// Middleware
app.use(express.json());
app.use(requestLogger);

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: "healthy",
      timestamp: new Date().toISOString(),
    },
  });
});

// Routes
app.use("/auth", authRoutes);
app.use("/jobs", jobsRoutes);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      message: "Endpoint not found",
    },
  });
});

// Error handler
app.use(errorHandler);

// Start server
async function startServer(): Promise<void> {
  await connectDatabase();

  app.listen(config.port, () => {
    logger.info({ port: config.port }, "server.start");
  });
}

// Only start server if this is the main module (not imported for testing)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  // Graceful shutdown
  process.on("SIGINT", async () => {
    logger.info("server.shutdown");
    await disconnectDatabase();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    logger.info("server.shutdown");
    await disconnectDatabase();
    process.exit(0);
  });

  startServer().catch((error) => {
    logger.error({ error }, "server.start_failed");
    process.exit(1);
  });
}

// Export app for testing
export default app;
