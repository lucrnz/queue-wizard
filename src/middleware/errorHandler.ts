import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { ZodError, ZodIssue } from "zod";

interface ErrorResponse {
  success: false;
  error: {
    message: string;
    details?: Array<{ path: string; message: string }>;
  };
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const response: ErrorResponse = {
    success: false,
    error: {
      message: "Internal server error",
    },
  };

  const errorContext = {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    userId: req.userId,
  };

  if (err instanceof ZodError) {
    response.error.message = "Validation error";
    response.error.details = err.issues.map((issue: ZodIssue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    logger.warn(
      {
        ...errorContext,
        issues: response.error.details,
      },
      "request.validation_failed"
    );
    res.status(400).json(response);
    return;
  }

  if (err instanceof AppError) {
    response.error.message = err.message;
    logger.info(
      {
        ...errorContext,
        statusCode: err.statusCode,
        errorName: err.name,
      },
      "request.app_error"
    );
    res.status(err.statusCode).json(response);
    return;
  }

  logger.error(
    {
      ...errorContext,
      err,
    },
    "request.unhandled_error"
  );
  res.status(500).json(response);
}
