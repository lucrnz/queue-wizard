# Logging

QueueWizard uses structured logging powered by Pino. Logs are emitted as JSON in production and
pretty-printed during local development.

## Logger Factory

The logger factory lives in `src/lib/logger.ts` and exposes:

- `logger`: shared root logger
- `createChildLogger(bindings)`: create structured child loggers
- `createWorkerLogger(workerId)`: helper for worker loop logs
- `createJobLogger(jobId)`: helper for job execution logs

## Request Logging

The `requestLogger` middleware attaches a UUID `requestId` to every request, logs the incoming
request metadata, and logs a completion event with status code and response time.

Fields emitted by the middleware include:

- `requestId`
- `method`
- `url`
- `ip`
- `userId` (when authenticated)
- `statusCode` and `durationMs` on completion

## Error Logging

Unhandled errors are logged with request context, stack traces, and error metadata. Validation
errors emit structured issue details for easier debugging.

## Configuration

Set `LOG_LEVEL` to control verbosity (default: `info`). In production (`NODE_ENV=production`),
logs are JSON. In other environments, logs are pretty-printed for readability.
