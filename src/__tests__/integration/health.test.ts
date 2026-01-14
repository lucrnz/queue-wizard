import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../index.js";

describe("GET /health", () => {
  it("should return healthy status", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("healthy");
    expect(response.body.data.timestamp).toBeDefined();
  });
});

describe("404 handler", () => {
  it("should return 404 for unknown endpoints", async () => {
    const response = await request(app).get("/unknown-endpoint");

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe("Endpoint not found");
  });
});
