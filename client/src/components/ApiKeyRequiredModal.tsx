'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Key,
  Zap,
  Cpu,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Eye,
  EyeOff,
  X,
  Lock,
  Sparkles,
} from 'lucide-react';
import {
  getLocalApiKeys,
  setLocalApiKeys,
  saveRemoteApiKeys,
  fetchRemoteApiKeys,
  UserApiKeys,
} from '../utils/apiKeys';

interface ApiKeyRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeysSaved: () => void;
}

export default function ApiKeyRequiredModal({
  isOpen,
  onClose,
  onKeysSaved,
}: ApiKeyRequiredModalProps) {
  const [groqKey, setGroqKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');

  const [showGroq, setShowGroq] = useState(false);
  const [showGemini, setShowGemini] = useState(false);
  const [showOpenai, setShowOpenai] = useState(false);
  const [showAnthropic, setShowAnthropic] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setErrorMessage('');
      setSavedSuccess(false);

      const local = getLocalApiKeys();
      if (local.groqApiKey) setGroqKey(local.groqApiKey);
      if (local.geminiApiKey) setGeminiKey(local.geminiApiKey);
      if (local.openaiApiKey) setOpenaiKey(local.openaiApiKey);
      if (local.anthropicApiKey) setAnthropicKey(local.anthropicApiKey);

      fetchRemoteApiKeys()
        .then((remote) => {
          if (remote?.keys) {
            if (remote.keys.groq) setGroqKey(remote.keys.groq);
            if (remote.keys.gemini) setGeminiKey(remote.keys.gemini);
            if (remote.keys.openai) setOpenaiKey(remote.keys.openai);
            if (remote.keys.anthropic) setAnthropicKey(remote.keys.anthropic);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const handleSaveAndProceed = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanGroq = groqKey.trim();
    const cleanGemini = geminiKey.trim();
    const cleanOpenai = openaiKey.trim();
    const cleanAnthropic = anthropicKey.trim();

    if (!cleanGroq) {
      setErrorMessage('Please enter your Groq API key (compulsory for 13-agent orchestration).');
      return;
    }
    if (!cleanGemini) {
      setErrorMessage('Please enter your Google Gemini API key (compulsory for 1M context synthesis & OCR).');
      return;
    }
    if (!cleanOpenai) {
      setErrorMessage('Please enter your OpenAI API key (compulsory for academic verification & GPT-4o synthesis).');
      return;
    }
    if (!cleanAnthropic) {
      setErrorMessage('Please enter your Anthropic Claude API key (compulsory for scholarly drafting & review).');
      return;
    }

    setIsSaving(true);
    try {
      const payload: UserApiKeys = {
        groqApiKey: cleanGroq,
        geminiApiKey: cleanGemini,
        openaiApiKey: cleanOpenai,
        anthropicApiKey: cleanAnthropic,
      };

      setLocalApiKeys(payload);
      await saveRemoteApiKeys(payload);

      setSavedSuccess(true);
      setTimeout(() => {
        setIsSaving(false);
        onKeysSaved();
      }, 700);
    } catch (err: any) {
      console.error('Failed to save API keys:', err);
      setErrorMessage(
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to save API keys. Please verify your connection.'
      );
      setIsSaving(false);
    }
  };

  const isGroqValid = groqKey.trim().length > 10;
  const isGeminiValid = geminiKey.trim().length > 10;
  const isOpenaiValid = openaiKey.trim().length > 10;
  const isAnthropicValid = anthropicKey.trim().length > 10;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop with blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: 'spring', damping: 26, stiffness: 340 }}
            className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-amber-500/30 bg-zinc-950/95 p-6 md:p-7 shadow-2xl shadow-amber-950/40 text-zinc-100 overflow-hidden"
          >
            {/* Ambient Background Glows */}
            <div className="absolute -top-24 -left-24 w-56 h-56 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-56 h-56 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-zinc-200 transition-colors rounded-lg hover:bg-zinc-900"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Header */}
            <div className="flex items-start gap-3.5 mb-4 shrink-0">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-indigo-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/10">
                <Key className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold tracking-tight text-white">
                    4 Compulsory LLM API Keys Required
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    Compulsory
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                  To create a research project, you must provide your personal API keys for all 4 AI engines below. In ResearcherGPT, each user runs on their own keys to ensure dedicated speed and total privacy.
                </p>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-3 p-3 rounded-xl border border-rose-500/30 bg-rose-950/30 text-rose-400 text-xs flex items-center gap-2.5 shrink-0"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </motion.div>
            )}

            {/* Form Fields - Scrollable Container */}
            <form onSubmit={handleSaveAndProceed} className="space-y-3.5 overflow-y-auto pr-1 flex-grow">
              
              {/* 1. Groq Key Input */}
              <div className="space-y-1.5 p-3 rounded-xl border border-zinc-800 bg-zinc-900/40">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" /> Groq API Key <span className="text-amber-400 font-normal">(Compulsory)</span>
                  </span>
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-400 hover:text-amber-300 flex items-center gap-1 text-[11px] underline underline-offset-2"
                  >
                    Get Free Key <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Executes 13-agent workflow via <span className="font-mono text-zinc-400">llama-3.3-70b-versatile</span> at 500+ tok/s.
                </p>
                <div className="relative">
                  <input
                    type={showGroq ? 'text' : 'password'}
                    value={groqKey}
                    onChange={(e) => setGroqKey(e.target.value)}
                    placeholder="gsk_..."
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-lg px-3.5 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50 pr-16 font-mono transition-colors"
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                    {isGroqValid && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    <button
                      type="button"
                      onClick={() => setShowGroq(!showGroq)}
                      className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showGroq ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. Gemini Key Input */}
              <div className="space-y-1.5 p-3 rounded-xl border border-zinc-800 bg-zinc-900/40">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-cyan-400" /> Google Gemini API Key <span className="text-cyan-400 font-normal">(Compulsory)</span>
                  </span>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px] underline underline-offset-2"
                  >
                    Get Free Key <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Powers 1,000,000-token full manuscript drafting, vision OCR, and embeddings via <span className="font-mono text-zinc-400">gemini-2.5-flash</span>.
                </p>
                <div className="relative">
                  <input
                    type={showGemini ? 'text' : 'password'}
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-cyan-500 rounded-lg px-3.5 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 pr-16 font-mono transition-colors"
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                    {isGeminiValid && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    <button
                      type="button"
                      onClick={() => setShowGemini(!showGemini)}
                      className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showGemini ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. OpenAI Key Input */}
              <div className="space-y-1.5 p-3 rounded-xl border border-zinc-800 bg-zinc-900/40">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-indigo-400" /> OpenAI API Key <span className="text-indigo-400 font-normal">(Compulsory)</span>
                  </span>
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-[11px] underline underline-offset-2"
                  >
                    OpenAI Console <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Powers factual claims verification and peer review analysis via <span className="font-mono text-zinc-400">gpt-4o</span>.
                </p>
                <div className="relative">
                  <input
                    type={showOpenai ? 'text' : 'password'}
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder="sk-..."
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-lg px-3.5 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 pr-16 font-mono transition-colors"
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                    {isOpenaiValid && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    <button
                      type="button"
                      onClick={() => setShowOpenai(!showOpenai)}
                      className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showOpenai ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* 4. Anthropic Claude Key Input */}
              <div className="space-y-1.5 p-3 rounded-xl border border-zinc-800 bg-zinc-900/40">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-orange-400" /> Anthropic Claude API Key <span className="text-orange-400 font-normal">(Compulsory)</span>
                  </span>
                  <a
                    href="https://console.anthropic.com/settings/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-400 hover:text-orange-300 flex items-center gap-1 text-[11px] underline underline-offset-2"
                  >
                    Anthropic Console <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Powers academic manuscript synthesis and high-rigor scholarly writing via <span className="font-mono text-zinc-400">claude-3-5-sonnet</span>.
                </p>
                <div className="relative">
                  <input
                    type={showAnthropic ? 'text' : 'password'}
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
                    placeholder="sk-ant-..."
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-orange-500 rounded-lg px-3.5 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50 pr-16 font-mono transition-colors"
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                    {isAnthropicValid && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    <button
                      type="button"
                      onClick={() => setShowAnthropic(!showAnthropic)}
                      className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showAnthropic ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-2 border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                  <Lock className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Encrypted & stored globally for your account</span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 w-full sm:w-auto"
                  >
                    {savedSuccess ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Saved! Opening Project Form...</span>
                      </>
                    ) : isSaving ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Saving Keys...</span>
                      </>
                    ) : (
                      <>
                        <Key className="w-3.5 h-3.5" />
                        <span>Save All 4 Keys & Continue</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Footer link to 3D onboarding page */}
              <div className="text-center pt-0.5">
                <Link
                  href="/onboarding/api-keys"
                  onClick={onClose}
                  className="text-[11px] text-zinc-500 hover:text-zinc-300 inline-flex items-center gap-1 transition-colors"
                >
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                  <span>Open 3D API Keys Studio</span>
                </Link>
              </div>

            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
