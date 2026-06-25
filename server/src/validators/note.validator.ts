import { z } from 'zod';

export const createNoteSchema = z.object({
  projectId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ObjectId"),
  paperId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ObjectId").optional(),
  title: z.string().min(1, "Title cannot be empty").max(100, "Title is too long"),
  content: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
