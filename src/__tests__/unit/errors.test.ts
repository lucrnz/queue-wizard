import { describe, it, expect } from "vitest";
import {
  AppError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  ConflictError,
} from "../../lib/errors.js";

describe("AppError", () => {
  it("should create error with status code and message", () => {
    const error = new AppError(500, "Internal error");
    expect(error.statusCode).toBe(500);
    expect(error.message).toBe("Internal error");
    expect(error.name).toBe("AppError");
    expect(error).toBeInstanceOf(Error);
  });
});

describe("ValidationError", () => {
  it("should create error with status 400", () => {
    const error = new ValidationError("Invalid input");
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe("Invalid input");
    expect(error.name).toBe("ValidationError");
    expect(error).toBeInstanceOf(AppError);
  });
});

describe("AuthenticationError", () => {
  it("should create error with status 401 and default message", () => {
    const error = new AuthenticationError();
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe("Authentication required");
    expect(error.name).toBe("AuthenticationError");
    expect(error).toBeInstanceOf(AppError);
  });

  it("should accept custom message", () => {
    const error = new AuthenticationError("Token expired");
    expect(error.message).toBe("Token expired");
  });
});

describe("NotFoundError", () => {
  it("should create error with status 404 and default message", () => {
    const error = new NotFoundError();
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe("Resource not found");
    expect(error.name).toBe("NotFoundError");
    expect(error).toBeInstanceOf(AppError);
  });

  it("should accept custom message", () => {
    const error = new NotFoundError("User not found");
    expect(error.message).toBe("User not found");
  });
});

describe("ConflictError", () => {
  it("should create error with status 409", () => {
    const error = new ConflictError("Email already exists");
    expect(error.statusCode).toBe(409);
    expect(error.message).toBe("Email already exists");
    expect(error.name).toBe("ConflictError");
    expect(error).toBeInstanceOf(AppError);
  });
});
