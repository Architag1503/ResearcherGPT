import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string({
    required_error: "Project name is required",
  }).min(3, "Project name must be at least 3 characters long"),
  description: z.string().optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(3).optional(),
  description: z.string().optional(),
});
