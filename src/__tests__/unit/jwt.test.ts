import { describe, it, expect } from "vitest";
import { generateToken, verifyToken } from "../../lib/jwt.js";

describe("JWT utilities", () => {
  const userId = "test-user-id-123";

  describe("generateToken", () => {
    it("should generate a valid token string", () => {
      const token = generateToken(userId);
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3); // JWT has 3 parts
    });

    it("should generate different tokens for different users", () => {
      const token1 = generateToken("user-1");
      const token2 = generateToken("user-2");
      expect(token1).not.toBe(token2);
    });
  });

  describe("verifyToken", () => {
    it("should verify and decode a valid token", () => {
      const token = generateToken(userId);
      const payload = verifyToken(token);
      expect(payload.userId).toBe(userId);
    });

    it("should throw on invalid token", () => {
      expect(() => verifyToken("invalid-token")).toThrow();
    });

    it("should throw on malformed token", () => {
      expect(() => verifyToken("not.a.valid.jwt.token")).toThrow();
    });

    it("should throw on empty token", () => {
      expect(() => verifyToken("")).toThrow();
    });
  });
});
