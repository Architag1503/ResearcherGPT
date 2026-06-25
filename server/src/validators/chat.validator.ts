import { z } from 'zod';

export const createSessionSchema = z.object({
  projectId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ObjectId"),
  title: z.string().optional(),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1, "Message content cannot be empty"),
});
