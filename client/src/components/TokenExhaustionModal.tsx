'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Key, ExternalLink, Check, Eye, EyeOff, X, Zap } from 'lucide-react';
import { getLocalApiKeys, saveRemoteApiKeys, UserApiKeys } from '../utils/apiKeys';

interface ExhaustionEventDetail {
  provider: string;
  message: string;
}

export default function TokenExhaustionModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [providerName, setProviderName] = useState<string>('LLM Provider');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [keys, setKeys] = useState<UserApiKeys>({
    groqApiKey: '',
    geminiApiKey: '',
    openaiApiKey: '',
    anthropicApiKey: '',
  });
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    const handleExhaustion = (e: Event) => {
      const customEvent = e as CustomEvent<ExhaustionEventDetail>;
      const p = customEvent.detail?.provider || 'LLM Provider';
      const m = customEvent.detail?.message || 'Token quota exceeded or rate limit reached.';
      setProviderName(p);
      setErrorMessage(m);

      // Load latest local keys
      const current = getLocalApiKeys();
      setKeys(current);
      setSavedSuccess(false);
      setIsOpen(true);
    };

    window.addEventListener('token-limit-exceeded', handleExhaustion);
    return () => {
      window.removeEventListener('token-limit-exceeded', handleExhaustion);
    };
  }, []);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      await saveRemoteApiKeys(keys);
      setSavedSuccess(true);
      setTimeout(() => {
        setIsOpen(false);
        setSavedSuccess(false);
      }, 900);
    } catch (err) {
      console.error('Failed to save API keys from modal:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const isGroq = providerName.toLowerCase().includes('groq');
  const isGemini = providerName.toLowerCase().includes('gemini');
  const isOpenAI = providerName.toLowerCase().includes('openai');
  const isAnthropic = providerName.toLowerCase().includes('anthropic') || providerName.toLowerCase().includes('claude');

  // Provider registration console URLs
  const getConsoleLink = () => {
    if (isGroq) return 'https://console.groq.com/keys';
    if (isGemini) return 'https://aistudio.google.com/app/apikey';
    if (isOpenAI) return 'https://platform.openai.com/api-keys';
    if (isAnthropic) return 'https://console.anthropic.com/settings/keys';
    return 'https://console.groq.com/keys';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop with blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-lg rounded-2xl border border-amber-500/30 bg-zinc-950/95 p-6 md:p-8 shadow-2xl shadow-amber-950/40 text-zinc-100 overflow-hidden"
          >
            {/* Top Amber Glow Ambient */}
            <div className="absolute -top-24 -left-24 w-52 h-52 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-52 h-52 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

            {/* Close Button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-zinc-200 transition-colors rounded-lg hover:bg-zinc-900"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400 shadow-inner shadow-amber-500/20">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  <span>API Quota Depleted</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono font-medium">
                    {providerName}
                  </span>
                </h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  The API tokens for <strong className="text-zinc-200">{providerName}</strong> were exhausted or rate limited during your operation. Enter a new key below to continue without losing your workspace state.
                </p>
              </div>
            </div>

            {/* Error Message Details */}
            {errorMessage && (
              <div className="mb-5 p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 text-[11px] font-mono text-zinc-400 break-words line-clamp-3">
                <span className="text-amber-400 font-semibold mr-1.5">Provider Response:</span>
                {errorMessage}
              </div>
            )}

            {/* Key Inputs Form */}
            <form onSubmit={handleSave} className="space-y-4">
              {/* Primary Key Field tailored to affected provider */}
              {(isGroq || (!isGemini && !isOpenAI && !isAnthropic)) && (
                <div>
                  <div className="flex items-center justify-between text-xs font-medium text-zinc-300 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" /> Groq API Key <span className="text-zinc-500 font-normal">(Free, Instant)</span>
                    </span>
                    <a
                      href="https://console.groq.com/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-400 hover:text-amber-300 flex items-center gap-1 text-[11px] underline underline-offset-2"
                    >
                      Get Key <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={keys.groqApiKey}
                      onChange={(e) => setKeys({ ...keys, groqApiKey: e.target.value })}
                      placeholder="gsk_..."
                      className="w-full bg-zinc-900/90 border border-zinc-800 focus:border-amber-500 rounded-lg px-3.5 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50 pr-10 font-mono transition-colors"
                      required={isGroq}
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {(isGemini || (!isGroq && !isOpenAI && !isAnthropic)) && (
                <div>
                  <div className="flex items-center justify-between text-xs font-medium text-zinc-300 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-cyan-400" /> Google Gemini API Key <span className="text-zinc-500 font-normal">(Free, 1M Context)</span>
                    </span>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px] underline underline-offset-2"
                    >
                      Get Key <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={keys.geminiApiKey}
                      onChange={(e) => setKeys({ ...keys, geminiApiKey: e.target.value })}
                      placeholder="AIzaSy..."
                      className="w-full bg-zinc-900/90 border border-zinc-800 focus:border-cyan-500 rounded-lg px-3.5 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 pr-10 font-mono transition-colors"
                      required={isGemini}
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {isOpenAI && (
                <div>
                  <div className="flex items-center justify-between text-xs font-medium text-zinc-300 mb-1.5">
                    <span>OpenAI API Key</span>
                    <a
                      href="https://platform.openai.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-[11px] underline underline-offset-2"
                    >
                      Get Key <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={keys.openaiApiKey || ''}
                    onChange={(e) => setKeys({ ...keys, openaiApiKey: e.target.value })}
                    placeholder="sk-..."
                    className="w-full bg-zinc-900/90 border border-zinc-800 focus:border-indigo-500 rounded-lg px-3.5 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono transition-colors"
                  />
                </div>
              )}

              {isAnthropic && (
                <div>
                  <div className="flex items-center justify-between text-xs font-medium text-zinc-300 mb-1.5">
                    <span>Anthropic Claude API Key</span>
                    <a
                      href="https://console.anthropic.com/settings/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-400 hover:text-orange-300 flex items-center gap-1 text-[11px] underline underline-offset-2"
                    >
                      Get Key <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={keys.anthropicApiKey || ''}
                    onChange={(e) => setKeys({ ...keys, anthropicApiKey: e.target.value })}
                    placeholder="sk-ant-..."
                    className="w-full bg-zinc-900/90 border border-zinc-800 focus:border-orange-500 rounded-lg px-3.5 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-orange-500 font-mono transition-colors"
                  />
                </div>
              )}

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Dismiss
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  {savedSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Saved! Resuming...
                    </>
                  ) : isSaving ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Key className="w-3.5 h-3.5" /> Save & Continue
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
