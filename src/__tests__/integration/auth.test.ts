import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../index.js";
import { createTestUser, TEST_USER_PASSWORD } from "../setup.js";

describe("POST /auth/signup", () => {
  it("should create a new user", async () => {
    const response = await request(app).post("/auth/signup").send({
      name: "Test User",
      email: "test@example.com",
      password: "password123",
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe("test@example.com");
    expect(response.body.data.user.name).toBe("Test User");
    expect(response.body.data.user.id).toBeDefined();
    expect(response.body.data.user.createdAt).toBeDefined();
    // Password should not be returned
    expect(response.body.data.user.password).toBeUndefined();
  });

  it("should reject duplicate email", async () => {
    // Create user first using the test helper (within same test)
    await createTestUser({ email: "duplicate@example.com" });

    // Try to signup with same email
    const response = await request(app).post("/auth/signup").send({
      name: "User 2",
      email: "duplicate@example.com",
      password: "password456",
    });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe("Email already registered");
  });

  it("should reject invalid email format", async () => {
    const response = await request(app).post("/auth/signup").send({
      name: "Test User",
      email: "invalid-email",
      password: "password123",
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should reject short password", async () => {
    const response = await request(app).post("/auth/signup").send({
      name: "Test User",
      email: "test@example.com",
      password: "12345",
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should reject missing fields", async () => {
    const response = await request(app).post("/auth/signup").send({
      name: "Test User",
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});

describe("POST /auth/signin", () => {
  it("should sign in with valid credentials", async () => {
    const user = await createTestUser({
      email: "signin@example.com",
    });

    const response = await request(app).post("/auth/signin").send({
      email: "signin@example.com",
      password: TEST_USER_PASSWORD,
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.token).toBeDefined();
    expect(response.body.data.user.id).toBe(user.id);
    expect(response.body.data.user.email).toBe("signin@example.com");
    // Password should not be returned
    expect(response.body.data.user.password).toBeUndefined();
  });

  it("should reject invalid password", async () => {
    await createTestUser({
      email: "wrongpass@example.com",
    });

    const response = await request(app).post("/auth/signin").send({
      email: "wrongpass@example.com",
      password: "wrongpassword",
    });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe("Invalid email or password");
  });

  it("should reject non-existent user", async () => {
    const response = await request(app).post("/auth/signin").send({
      email: "nonexistent@example.com",
      password: "password123",
    });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe("Invalid email or password");
  });

  it("should reject invalid email format", async () => {
    const response = await request(app).post("/auth/signin").send({
      email: "invalid-email",
      password: "password123",
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});
