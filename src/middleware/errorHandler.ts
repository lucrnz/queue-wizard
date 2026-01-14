import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/errors.js";
import { ZodError, ZodIssue } from "zod";

interface ErrorResponse {
  success: false;
  error: {
    message: string;
    details?: Array<{ path: string; message: string }>;
  };
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const response: ErrorResponse = {
    success: false,
    error: {
      message: "Internal server error",
    },
  };

  if (err instanceof ZodError) {
    response.error.message = "Validation error";
    response.error.details = err.issues.map((issue: ZodIssue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    res.status(400).json(response);
    return;
  }

  if (err instanceof AppError) {
    response.error.message = err.message;
    res.status(err.statusCode).json(response);
    return;
  }

  // Log unexpected errors
  console.error("Unexpected error:", err);
  res.status(500).json(response);
}
