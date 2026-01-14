import { describe, it, expect } from "vitest";
import {
  signupSchema,
  signinSchema,
  createJobSchema,
  jobQuerySchema,
  jobIdParamSchema,
  httpMethodSchema,
} from "../../lib/schemas.js";

describe("signupSchema", () => {
  it("should accept valid signup data", () => {
    const result = signupSchema.parse({
      name: "John Doe",
      email: "john@example.com",
      password: "password123",
    });
    expect(result.name).toBe("John Doe");
    expect(result.email).toBe("john@example.com");
    expect(result.password).toBe("password123");
  });

  it("should reject empty name", () => {
    expect(() =>
      signupSchema.parse({
        name: "",
        email: "john@example.com",
        password: "password123",
      })
    ).toThrow();
  });

  it("should reject invalid email", () => {
    expect(() =>
      signupSchema.parse({
        name: "John Doe",
        email: "not-an-email",
        password: "password123",
      })
    ).toThrow();
  });

  it("should reject short password", () => {
    expect(() =>
      signupSchema.parse({
        name: "John Doe",
        email: "john@example.com",
        password: "12345",
      })
    ).toThrow();
  });
});

describe("signinSchema", () => {
  it("should accept valid signin data", () => {
    const result = signinSchema.parse({
      email: "john@example.com",
      password: "mypassword",
    });
    expect(result.email).toBe("john@example.com");
    expect(result.password).toBe("mypassword");
  });

  it("should reject invalid email", () => {
    expect(() =>
      signinSchema.parse({
        email: "invalid",
        password: "password123",
      })
    ).toThrow();
  });

  it("should reject empty password", () => {
    expect(() =>
      signinSchema.parse({
        email: "john@example.com",
        password: "",
      })
    ).toThrow();
  });
});

describe("httpMethodSchema", () => {
  it("should accept valid HTTP methods", () => {
    expect(httpMethodSchema.parse("GET")).toBe("GET");
    expect(httpMethodSchema.parse("POST")).toBe("POST");
    expect(httpMethodSchema.parse("PUT")).toBe("PUT");
    expect(httpMethodSchema.parse("PATCH")).toBe("PATCH");
    expect(httpMethodSchema.parse("DELETE")).toBe("DELETE");
  });

  it("should reject invalid HTTP methods", () => {
    expect(() => httpMethodSchema.parse("INVALID")).toThrow();
    expect(() => httpMethodSchema.parse("get")).toThrow(); // lowercase
    expect(() => httpMethodSchema.parse("OPTIONS")).toThrow();
  });
});

describe("createJobSchema", () => {
  it("should accept valid job data", () => {
    const result = createJobSchema.parse({
      method: "GET",
      url: "https://example.com/api",
    });
    expect(result.method).toBe("GET");
    expect(result.url).toBe("https://example.com/api");
    expect(result.priority).toBe(0); // default
    expect(result.headers).toBe("{}"); // default
    expect(result.body).toBe(null); // default
  });

  it("should accept full job data with all fields", () => {
    const result = createJobSchema.parse({
      method: "POST",
      url: "https://api.example.com/data",
      priority: 5,
      headers: '{"Content-Type": "application/json"}',
      body: '{"key": "value"}',
    });
    expect(result.method).toBe("POST");
    expect(result.url).toBe("https://api.example.com/data");
    expect(result.priority).toBe(5);
    expect(result.headers).toBe('{"Content-Type": "application/json"}');
    expect(result.body).toBe('{"key": "value"}');
  });

  it("should reject invalid HTTP method", () => {
    expect(() =>
      createJobSchema.parse({
        method: "INVALID",
        url: "https://example.com",
      })
    ).toThrow();
  });

  it("should reject invalid URL", () => {
    expect(() =>
      createJobSchema.parse({
        method: "GET",
        url: "not-a-url",
      })
    ).toThrow();
  });

  it("should reject invalid JSON headers", () => {
    expect(() =>
      createJobSchema.parse({
        method: "GET",
        url: "https://example.com",
        headers: "not-json",
      })
    ).toThrow();
  });

  it("should reject invalid JSON body", () => {
    expect(() =>
      createJobSchema.parse({
        method: "POST",
        url: "https://example.com",
        body: "not-json",
      })
    ).toThrow();
  });

  it("should accept null body", () => {
    const result = createJobSchema.parse({
      method: "GET",
      url: "https://example.com",
      body: null,
    });
    expect(result.body).toBe(null);
  });
});

describe("jobQuerySchema", () => {
  it("should accept empty query", () => {
    const result = jobQuerySchema.parse({});
    expect(result.status).toBeUndefined();
  });

  it("should accept valid status filter", () => {
    expect(jobQuerySchema.parse({ status: "pending" }).status).toBe("pending");
    expect(jobQuerySchema.parse({ status: "processing" }).status).toBe("processing");
    expect(jobQuerySchema.parse({ status: "completed" }).status).toBe("completed");
    expect(jobQuerySchema.parse({ status: "failed" }).status).toBe("failed");
  });

  it("should reject invalid status", () => {
    expect(() => jobQuerySchema.parse({ status: "invalid" })).toThrow();
  });
});

describe("jobIdParamSchema", () => {
  it("should accept valid UUID", () => {
    const uuid = "123e4567-e89b-12d3-a456-426614174000";
    const result = jobIdParamSchema.parse({ id: uuid });
    expect(result.id).toBe(uuid);
  });

  it("should reject invalid UUID", () => {
    expect(() => jobIdParamSchema.parse({ id: "not-a-uuid" })).toThrow();
    expect(() => jobIdParamSchema.parse({ id: "123" })).toThrow();
  });
});
