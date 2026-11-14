import { Request, Response } from 'express';
import UserApiKey from '../models/UserApiKey.js';
import { getUserApiKeys, isPrimaryOwner } from '../utils/userKeys.js';

/**
 * GET /api/user/api-keys
 * Returns the configured API keys for the authenticated user.
 */
export const getUserApiKeysHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 'mock_user_id';
    const isOwner = isPrimaryOwner((req as any).user);

    const record = await UserApiKey.findOne({ userId });

    const groqKey = record?.groqApiKey || '';
    const geminiKey = record?.geminiApiKey || '';
    const openaiKey = record?.openaiApiKey || '';
    const anthropicKey = record?.anthropicApiKey || '';

    // Mask helper
    const mask = (k: string) => {
      if (!k) return '';
      if (k.length <= 8) return '••••••••';
      return `${k.slice(0, 4)}••••••••${k.slice(-4)}`;
    };

    const hasConfiguredKeys = Boolean(
      (groqKey && geminiKey && openaiKey && anthropicKey) || isOwner
    );

    return res.status(200).json({
      hasConfiguredKeys,
      isOwner,
      keys: {
        groq: groqKey,
        gemini: geminiKey,
        openai: openaiKey,
        anthropic: anthropicKey,
      },
      masked: {
        groq: mask(groqKey),
        gemini: mask(geminiKey),
        openai: mask(openaiKey),
        anthropic: mask(anthropicKey),
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/user/api-keys
 * Saves or updates API keys globally for the authenticated user.
 */
export const saveUserApiKeysHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 'mock_user_id';
    const { groqApiKey, geminiApiKey, openaiApiKey, anthropicApiKey } = req.body;

    const updateData: any = {};
    if (groqApiKey !== undefined) updateData.groqApiKey = groqApiKey.trim();
    if (geminiApiKey !== undefined) updateData.geminiApiKey = geminiApiKey.trim();
    if (openaiApiKey !== undefined) updateData.openaiApiKey = openaiApiKey.trim();
    if (anthropicApiKey !== undefined) updateData.anthropicApiKey = anthropicApiKey.trim();

    const record = await UserApiKey.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      success: true,
      message: 'API keys saved successfully across your workspace.',
      hasConfiguredKeys: Boolean(
        record.groqApiKey && record.geminiApiKey && record.openaiApiKey && record.anthropicApiKey
      ),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
