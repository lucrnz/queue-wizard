import { NextFunction, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import { createChildLogger } from "../lib/logger.js";

function getClientIp(req: Request): string | undefined {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0]?.trim();
  }

  if (Array.isArray(forwarded)) {
    return forwarded[0];
  }

  return req.ip;
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = uuid();
  req.requestId = requestId;

  const requestLog = createChildLogger({
    requestId,
    method: req.method,
    url: req.originalUrl,
    ip: getClientIp(req),
  });

  const startTime = process.hrtime.bigint();

  requestLog.info(
    {
      userId: req.userId ?? null,
    },
    "request.start"
  );

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;

    requestLog.info(
      {
        statusCode: res.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
        userId: req.userId ?? null,
      },
      "request.finish"
    );
  });

  next();
}
