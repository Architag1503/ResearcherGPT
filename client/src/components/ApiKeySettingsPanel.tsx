'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Key,
  ShieldCheck,
  Zap,
  Cpu,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Eye,
  EyeOff,
  Save,
  Lock,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { getLocalApiKeys, setLocalApiKeys, saveRemoteApiKeys, fetchRemoteApiKeys, UserApiKeys } from '../utils/apiKeys';

export default function ApiKeySettingsPanel() {
  const [keys, setKeys] = useState<UserApiKeys>({
    groqApiKey: '',
    geminiApiKey: '',
    openaiApiKey: '',
    anthropicApiKey: '',
  });
  const [maskedRemote, setMaskedRemote] = useState<{ [key: string]: string }>({});
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Eye visibility toggles
  const [showGroq, setShowGroq] = useState(false);
  const [showGemini, setShowGemini] = useState(false);
  const [showOpenai, setShowOpenai] = useState(false);
  const [showAnthropic, setShowAnthropic] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const local = getLocalApiKeys();
      setKeys(local);

      const remote = await fetchRemoteApiKeys();
      if (remote) {
        setIsOwner(Boolean(remote.isOwner));
        if (remote.masked) {
          setMaskedRemote(remote.masked);
        }
        if (remote.keys) {
          setKeys((prev) => ({
            groqApiKey: remote.keys.groq || prev.groqApiKey || '',
            geminiApiKey: remote.keys.gemini || prev.geminiApiKey || '',
            openaiApiKey: remote.keys.openai || prev.openaiApiKey || '',
            anthropicApiKey: remote.keys.anthropic || prev.anthropicApiKey || '',
          }));
        }
      }
    } catch (err: any) {
      console.warn('Could not load remote API keys:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSaving(true);
    try {
      const payload: UserApiKeys = {
        groqApiKey: keys.groqApiKey.trim(),
        geminiApiKey: keys.geminiApiKey.trim(),
        openaiApiKey: keys.openaiApiKey?.trim() || '',
        anthropicApiKey: keys.anthropicApiKey?.trim() || '',
      };

      setLocalApiKeys(payload);
      const ok = await saveRemoteApiKeys(payload);
      if (ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setErrorMessage('Server returned an issue saving keys. Please try again.');
      }
    } catch (err: any) {
      console.error('Failed to save API keys:', err);
      setErrorMessage(err.response?.data?.error || 'Failed to save API keys to server.');
    } finally {
      setSaving(false);
    }
  };

  const hasGroq = Boolean(keys.groqApiKey && keys.groqApiKey.trim().length > 5);
  const hasGemini = Boolean(keys.geminiApiKey && keys.geminiApiKey.trim().length > 5);

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 backdrop-blur-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Key className="w-5 h-5 text-indigo-400" />
              <span>LLM API Keys & Global Quota Management</span>
            </h2>
            {isOwner && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Primary Owner Mode
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 max-w-2xl leading-relaxed">
            Configure your personal LLM provider credentials. Keys configured here apply <strong className="text-zinc-200">globally</strong> across all your research projects and pipelines.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl text-xs font-medium border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors flex items-center gap-1.5 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-950/20 text-rose-400 text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Success Notification */}
      {saveSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-emerald-400 text-xs flex items-center gap-3"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>All API keys updated successfully! Your research pipelines are now configured with these credentials.</span>
        </motion.div>
      )}

      {/* Key Form */}
      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Groq Card */}
        <div className="p-6 rounded-2xl border border-zinc-800/80 bg-zinc-950/40 backdrop-blur-sm space-y-4 hover:border-amber-500/30 transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-zinc-100">Groq API Key</h3>
                  {hasGroq ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Configured
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Required for Fast Synthesis
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Executes the 13-agent LangGraph workflow via <span className="text-zinc-400 font-mono">llama-3.3-70b-versatile</span>.
                </p>
              </div>
            </div>

            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-medium px-3 py-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-colors shrink-0"
            >
              <span>Groq Console</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="relative">
            <input
              type={showGroq ? 'text' : 'password'}
              value={keys.groqApiKey}
              onChange={(e) => setKeys({ ...keys, groqApiKey: e.target.value })}
              placeholder={maskedRemote.groq || 'gsk_...'}
              className="w-full bg-zinc-900/90 border border-zinc-800 focus:border-amber-500 rounded-xl px-4 py-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50 pr-12 font-mono transition-colors"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowGroq(!showGroq)}
                className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showGroq ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Gemini Card */}
        <div className="p-6 rounded-2xl border border-zinc-800/80 bg-zinc-950/40 backdrop-blur-sm space-y-4 hover:border-cyan-500/30 transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold shrink-0">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-zinc-100">Google Gemini API Key</h3>
                  {hasGemini ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Configured
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      Required for 1M Context & OCR
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Powers 1,000,000-token full-manuscript writing, PDF OCR, and vector embeddings via <span className="text-zinc-400 font-mono">gemini-2.5-flash</span>.
                </p>
              </div>
            </div>

            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-medium px-3 py-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/5 hover:bg-cyan-500/10 transition-colors shrink-0"
            >
              <span>Google AI Studio</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="relative">
            <input
              type={showGemini ? 'text' : 'password'}
              value={keys.geminiApiKey}
              onChange={(e) => setKeys({ ...keys, geminiApiKey: e.target.value })}
              placeholder={maskedRemote.gemini || 'AIzaSy...'}
              className="w-full bg-zinc-900/90 border border-zinc-800 focus:border-cyan-500 rounded-xl px-4 py-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 pr-12 font-mono transition-colors"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowGemini(!showGemini)}
                className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showGemini ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Optional Secondary Providers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* OpenAI */}
          <div className="p-5 rounded-xl border border-zinc-800/60 bg-zinc-950/30 backdrop-blur-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-indigo-400" /> OpenAI API Key
              </span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Optional Fallback</span>
            </div>
            <div className="relative">
              <input
                type={showOpenai ? 'text' : 'password'}
                value={keys.openaiApiKey || ''}
                onChange={(e) => setKeys({ ...keys, openaiApiKey: e.target.value })}
                placeholder={maskedRemote.openai || 'sk-...'}
                className="w-full bg-zinc-900/80 border border-zinc-800 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 font-mono pr-8 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowOpenai(!showOpenai)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showOpenai ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              OpenAI Console <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>

          {/* Anthropic Claude */}
          <div className="p-5 rounded-xl border border-zinc-800/60 bg-zinc-950/30 backdrop-blur-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-orange-400" /> Anthropic Claude API Key
              </span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Optional Fallback</span>
            </div>
            <div className="relative">
              <input
                type={showAnthropic ? 'text' : 'password'}
                value={keys.anthropicApiKey || ''}
                onChange={(e) => setKeys({ ...keys, anthropicApiKey: e.target.value })}
                placeholder={maskedRemote.anthropic || 'sk-ant-...'}
                className="w-full bg-zinc-900/80 border border-zinc-800 focus:border-orange-500 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 font-mono pr-8 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowAnthropic(!showAnthropic)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showAnthropic ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-orange-400 hover:text-orange-300 flex items-center gap-1"
            >
              Anthropic Console <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        </div>

        {/* Bottom Save Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-zinc-800/60">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Lock className="w-3.5 h-3.5 text-emerald-500" />
            <span>Saved securely in MongoDB & updated in client sessions globally</span>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-xs shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {saving ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Saving Keys...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Keys Globally</span>
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
}
