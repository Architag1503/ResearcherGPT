import { z } from 'zod';

export const uploadPaperSchema = z.object({
  projectId: z.string({
    required_error: "projectId is required reference to workspace",
  }).regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ObjectId"),
});
