import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt.js";
import { AuthenticationError } from "../lib/errors.js";

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AuthenticationError("Missing or invalid authorization header");
    }

    const token = authHeader.substring(7);

    if (!token) {
      throw new AuthenticationError("Token not provided");
    }

    const payload = verifyToken(token);
    req.userId = payload.userId;

    next();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      next(error);
    } else {
      next(new AuthenticationError("Invalid or expired token"));
    }
  }
}
