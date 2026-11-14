import axios from 'axios';
import { getApiUrl } from './apiUrl';

export interface UserApiKeys {
  groqApiKey: string;
  geminiApiKey: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
}

export const hasRequiredApiKeys = (keys?: UserApiKeys | null): boolean => {
  if (!keys) return false;
  return Boolean(
    keys.groqApiKey && keys.groqApiKey.trim().length > 5 &&
    keys.geminiApiKey && keys.geminiApiKey.trim().length > 5
  );
};

const STORAGE_KEY = 'researchergpt_user_api_keys';

export const getLocalApiKeys = (): UserApiKeys => {
  if (typeof window === 'undefined') {
    return { groqApiKey: '', geminiApiKey: '', openaiApiKey: '', anthropicApiKey: '' };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[getLocalApiKeys] Error reading localStorage:', err);
  }
  return { groqApiKey: '', geminiApiKey: '', openaiApiKey: '', anthropicApiKey: '' };
};

export const setLocalApiKeys = (keys: UserApiKeys): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch (err) {
    console.warn('[setLocalApiKeys] Error saving to localStorage:', err);
  }
};

export const fetchRemoteApiKeys = async (): Promise<{
  hasConfiguredKeys: boolean;
  isOwner: boolean;
  keys: { groq: string; gemini: string; openai: string; anthropic: string };
  masked: { groq: string; gemini: string; openai: string; anthropic: string };
}> => {
  const apiBase = getApiUrl();
  const res = await axios.get(`${apiBase}/api/user/api-keys`, {
    params: { _t: Date.now() },
  });
  const data = res.data;
  if (data?.keys) {
    // Sync to local storage
    setLocalApiKeys({
      groqApiKey: data.keys.groq || '',
      geminiApiKey: data.keys.gemini || '',
      openaiApiKey: data.keys.openai || '',
      anthropicApiKey: data.keys.anthropic || '',
    });
  }
  return data;
};

export const saveRemoteApiKeys = async (keys: UserApiKeys): Promise<boolean> => {
  const apiBase = getApiUrl();
  setLocalApiKeys(keys);
  const res = await axios.post(`${apiBase}/api/user/api-keys`, {
    groqApiKey: keys.groqApiKey,
    geminiApiKey: keys.geminiApiKey,
    openaiApiKey: keys.openaiApiKey || '',
    anthropicApiKey: keys.anthropicApiKey || '',
  });
  return res.data?.success || false;
};

export const triggerTokenExhaustedModal = (provider: string, message?: string) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('token-limit-exceeded', {
        detail: {
          provider: provider || 'LLM Provider',
          message: message || 'Your API token limit was exceeded.',
        },
      })
    );
  }
};
