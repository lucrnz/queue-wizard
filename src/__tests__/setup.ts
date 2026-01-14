import { beforeEach, afterAll } from "vitest";
import { prisma } from "../lib/db.js";
import bcrypt from "bcrypt";

// Clean database before each test
beforeEach(async () => {
  // Delete in order to respect foreign key constraints
  await prisma.job.deleteMany();
  await prisma.user.deleteMany();
});

// Disconnect after all tests
afterAll(async () => {
  await prisma.$disconnect();
});

// Test user credentials
export const TEST_USER_PASSWORD = "password123";

// Helper to create a test user with pre-hashed password
export async function createTestUser(overrides?: {
  name?: string;
  email?: string;
  password?: string;
}) {
  const hashedPassword = await bcrypt.hash(overrides?.password ?? TEST_USER_PASSWORD, 10);

  return prisma.user.create({
    data: {
      name: overrides?.name ?? "Test User",
      email: overrides?.email ?? `test-${Date.now()}@example.com`,
      password: hashedPassword,
    },
  });
}

// Helper to create a test job
export async function createTestJob(
  userId: string,
  overrides?: {
    method?: string;
    url?: string;
    headers?: string;
    body?: string | null;
    priority?: number;
    status?: string;
  }
) {
  return prisma.job.create({
    data: {
      method: overrides?.method ?? "GET",
      url: overrides?.url ?? "https://api.example.com/test",
      headers: overrides?.headers ?? "{}",
      body: overrides?.body ?? null,
      priority: overrides?.priority ?? 0,
      status: overrides?.status ?? "pending",
      userId,
    },
  });
}
