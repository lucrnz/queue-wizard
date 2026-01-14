import "dotenv/config";

export const config = {
  port: parseInt(process.env["PORT"] || "3000", 10),
  jwtSecret: process.env["JWT_SECRET"] || "default-secret-change-me",
  jwtExpiresIn: "24h" as const,
} as const;
