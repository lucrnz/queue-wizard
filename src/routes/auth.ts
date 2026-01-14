import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../lib/db.js";
import { generateToken } from "../lib/jwt.js";
import { signupSchema, signinSchema } from "../lib/schemas.js";
import { AuthenticationError, ConflictError } from "../lib/errors.js";

const router = Router();

// POST /auth/signup
router.post(
  "/signup",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = signupSchema.parse(req.body);

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: validatedData.email },
      });

      if (existingUser) {
        throw new ConflictError("Email already registered");
      }

      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(validatedData.password, saltRounds);

      // Create user
      const user = await prisma.user.create({
        data: {
          name: validatedData.name,
          email: validatedData.email,
          password: hashedPassword,
        },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
        },
      });

      res.status(201).json({
        success: true,
        data: {
          user,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /auth/signin
router.post(
  "/signin",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = signinSchema.parse(req.body);

      // Find user
      const user = await prisma.user.findUnique({
        where: { email: validatedData.email },
      });

      if (!user) {
        throw new AuthenticationError("Invalid email or password");
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(
        validatedData.password,
        user.password
      );

      if (!isPasswordValid) {
        throw new AuthenticationError("Invalid email or password");
      }

      // Generate token
      const token = generateToken(user.id);

      res.json({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
