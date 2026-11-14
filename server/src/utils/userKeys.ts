import { Request } from 'express';
import UserApiKey from '../models/UserApiKey.js';

export interface ExtractedUserKeys {
  groq?: string;
  gemini?: string;
  openai?: string;
  anthropic?: string;
  is_owner?: boolean;
}

export const isPrimaryOwner = (user?: { id?: string; email?: string }): boolean => {
  if (!user) return false;
  const email = (user.email || '').toLowerCase();
  const id = user.id || '';
  return (
    email.includes('archit') ||
    id === '666a7b29d5b51a0211a7c501' ||
    id === 'mock_user_id'
  );
};

export const hasAllRequiredUserKeys = (keys: ExtractedUserKeys): boolean => {
  return Boolean(
    keys.groq && keys.groq.trim().length > 5 &&
    keys.gemini && keys.gemini.trim().length > 5 &&
    keys.openai && keys.openai.trim().length > 5 &&
    keys.anthropic && keys.anthropic.trim().length > 5
  );
};

export const getUserApiKeys = async (
  userId: string,
  req: Request
): Promise<ExtractedUserKeys> => {
  const headerGroq = (req.headers['x-groq-api-key'] as string)?.trim();
  const headerGemini = (req.headers['x-gemini-api-key'] as string)?.trim();
  const headerOpenai = (req.headers['x-openai-api-key'] as string)?.trim();
  const headerAnthropic = (req.headers['x-anthropic-api-key'] as string)?.trim();

  // If provided in headers, prioritize them
  const keys: ExtractedUserKeys = {};
  if (headerGroq) keys.groq = headerGroq;
  if (headerGemini) keys.gemini = headerGemini;
  if (headerOpenai) keys.openai = headerOpenai;
  if (headerAnthropic) keys.anthropic = headerAnthropic;

  // If any key is missing, check database for user
  if (!keys.groq || !keys.gemini || !keys.openai || !keys.anthropic) {
    try {
      const dbRecord = await UserApiKey.findOne({ userId });
      if (dbRecord) {
        if (!keys.groq && dbRecord.groqApiKey) keys.groq = dbRecord.groqApiKey.trim();
        if (!keys.gemini && dbRecord.geminiApiKey) keys.gemini = dbRecord.geminiApiKey.trim();
        if (!keys.openai && dbRecord.openaiApiKey) keys.openai = dbRecord.openaiApiKey.trim();
        if (!keys.anthropic && dbRecord.anthropicApiKey) keys.anthropic = dbRecord.anthropicApiKey.trim();
      }
    } catch (err) {
      console.warn('[getUserApiKeys] DB lookup error:', err);
    }
  }

  const isOwner = isPrimaryOwner((req as any).user);
  keys.is_owner = isOwner;

  return keys;
};
