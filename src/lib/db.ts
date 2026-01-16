import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultDbPath = path.join(__dirname, "../../prisma/dev.db");

function resolveDatabasePath(databaseUrl: string): string {
  const normalized = databaseUrl.startsWith("file:")
    ? databaseUrl.slice("file:".length)
    : databaseUrl;

  if (path.isAbsolute(normalized)) {
    return normalized;
  }

  return path.resolve(process.cwd(), normalized);
}

const databaseUrl = process.env["DATABASE_URL"];
const dbPath = databaseUrl ? resolveDatabasePath(databaseUrl) : defaultDbPath;
const adapter = new PrismaBetterSqlite3({ url: dbPath });

export const prisma = new PrismaClient({ adapter });

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info("db.connected");
  } catch (error) {
    logger.error({ error }, "db.connect_failed");
    process.exit(1);
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
