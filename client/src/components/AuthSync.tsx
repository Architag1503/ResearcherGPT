'use client';

import { useEffect, useRef } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import axios from 'axios';
import { getLocalApiKeys, fetchRemoteApiKeys, triggerTokenExhaustedModal } from '../utils/apiKeys';

/**
 * Invisible utility component that automatically attaches Clerk authentication
 * credentials and user-configured LLM API keys to all outgoing Axios requests.
 * Also intercepts 429 / quota errors globally to trigger the Token Exhaustion Modal.
 * Renders null so it does not alter or impact the UI in any way.
 */
export default function AuthSync() {
  const { userId, getToken, isSignedIn } = useAuth();
  const { user } = useUser();
  const hasFetchedRemoteKeys = useRef(false);

  // Sync keys from remote database on first sign-in
  useEffect(() => {
    if (isSignedIn && !hasFetchedRemoteKeys.current) {
      hasFetchedRemoteKeys.current = true;
      fetchRemoteApiKeys().catch((err) => {
        // Silently catch if user has not yet configured keys or server offline
      });
    }
  }, [isSignedIn]);

  useEffect(() => {
    // 1. Request Interceptor: Attach Auth & LLM API Keys
    const reqInterceptor = axios.interceptors.request.use(async (config) => {
      try {
        if (userId) {
          config.headers['X-User-Id'] = userId;
        }
        if (user?.primaryEmailAddress?.emailAddress) {
          config.headers['X-User-Email'] = user.primaryEmailAddress.emailAddress;
        }
        if (user?.fullName) {
          config.headers['X-User-Name'] = user.fullName;
        }
        if (isSignedIn) {
          const token = await getToken();
          if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
          }
        }

        // Attach custom LLM API keys from local storage
        const localKeys = getLocalApiKeys();
        if (localKeys.groqApiKey) {
          config.headers['x-groq-api-key'] = localKeys.groqApiKey;
        }
        if (localKeys.geminiApiKey) {
          config.headers['x-gemini-api-key'] = localKeys.geminiApiKey;
        }
        if (localKeys.openaiApiKey) {
          config.headers['x-openai-api-key'] = localKeys.openaiApiKey;
        }
        if (localKeys.anthropicApiKey) {
          config.headers['x-anthropic-api-key'] = localKeys.anthropicApiKey;
        }
      } catch (err) {
        // Silently continue if header setup fails
      }
      return config;
    });

    // 2. Response Interceptor: Catch Quota Limits & Missing Keys
    const resInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        try {
          const status = error.response?.status;
          const data = error.response?.data;
          const errString = typeof data?.error === 'string' ? data.error : JSON.stringify(data || '');

          if (
            status === 429 ||
            errString.includes('TOKEN_LIMIT_EXCEEDED') ||
            errString.includes('Rate limit') ||
            errString.includes('rate_limit_exceeded') ||
            errString.includes('RESOURCE_EXHAUSTED') ||
            errString.includes('quota')
          ) {
            let provider = 'LLM Provider';
            if (errString.includes('GROQ') || errString.toLowerCase().includes('groq')) {
              provider = 'Groq';
            } else if (errString.includes('GEMINI') || errString.toLowerCase().includes('gemini')) {
              provider = 'Google Gemini';
            } else if (errString.includes('OPENAI') || errString.toLowerCase().includes('openai')) {
              provider = 'OpenAI';
            } else if (errString.includes('ANTHROPIC') || errString.toLowerCase().includes('anthropic') || errString.toLowerCase().includes('claude')) {
              provider = 'Anthropic Claude';
            }

            const message = data?.message || data?.error || 'Your API token quota has been exhausted or rate limited by the provider.';
            triggerTokenExhaustedModal(provider, message);
          } else if (status === 402 || data?.code === 'API_KEY_REQUIRED' || errString.includes('API_KEY_REQUIRED')) {
            triggerTokenExhaustedModal('API Key Required', data?.message || 'Please configure your Groq or Gemini API key to run AI synthesis.');
          }
        } catch (e) {
          // Ignore interceptor handling errors
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(reqInterceptor);
      axios.interceptors.response.eject(resInterceptor);
    };
  }, [userId, getToken, isSignedIn, user]);

  return null;
}
