import { z } from "zod";

// Auth schemas
export const signupSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name too long"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const signinSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// Job schemas
export const httpMethodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);

export const jobStatusSchema = z.enum(["pending", "processing", "completed", "failed"]);

export const createJobSchema = z.object({
  priority: z.number().int().default(0),
  method: httpMethodSchema,
  url: z.string().url("Invalid URL"),
  headers: z.string().default("{}").refine(
    (val) => {
      try {
        JSON.parse(val);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Headers must be a valid JSON string" }
  ),
  body: z.string().nullable().default(null).refine(
    (val) => {
      if (val === null) return true;
      try {
        JSON.parse(val);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Body must be a valid JSON string or null" }
  ),
});

export const jobQuerySchema = z.object({
  status: jobStatusSchema.optional(),
});

export const jobIdParamSchema = z.object({
  id: z.string().uuid("Invalid job ID"),
});

// Types
export type SignupInput = z.infer<typeof signupSchema>;
export type SigninInput = z.infer<typeof signinSchema>;
export type CreateJobInput = z.infer<typeof createJobSchema>;
export type JobQueryInput = z.infer<typeof jobQuerySchema>;
export type HttpMethod = z.infer<typeof httpMethodSchema>;
export type JobStatus = z.infer<typeof jobStatusSchema>;
