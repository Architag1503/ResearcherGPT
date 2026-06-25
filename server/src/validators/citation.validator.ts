import { z } from 'zod';

export const createCitationSchema = z.object({
  projectId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ObjectId"),
  doi: z.string().optional(),
  title: z.string().min(1, "Title is required").optional(),
  authors: z.array(z.string()).optional(),
  journal: z.string().optional(),
  year: z.number().int().min(1000).max(3000).optional(),
});
