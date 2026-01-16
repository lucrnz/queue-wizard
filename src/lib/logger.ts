import pino from "pino";
import pretty from "pino-pretty";
import { config } from "./config.js";

const isProd = process.env["NODE_ENV"] === "production";

export const logger = pino(
  {
    level: config.logLevel,
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers: {
      err: pino.stdSerializers.err,
    },
  },
  isProd
    ? undefined
    : pretty({
        colorize: true,
        translateTime: "yyyy-mm-dd HH:MM:ss.l",
        ignore: "pid,hostname",
      })
);

export function createChildLogger(bindings: pino.Bindings): pino.Logger {
  return logger.child(bindings);
}

export function createWorkerLogger(workerId: string): pino.Logger {
  return createChildLogger({ scope: "worker", workerId });
}

export function createJobLogger(jobId: string): pino.Logger {
  return createChildLogger({ scope: "job", jobId });
}
