'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sphere } from '@react-three/drei';
import * as THREE from 'three';
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
  ArrowRight,
  Sparkles,
  Lock,
  ChevronLeft,
} from 'lucide-react';
import { getLocalApiKeys, setLocalApiKeys, saveRemoteApiKeys, fetchRemoteApiKeys } from '../../../utils/apiKeys';

// 3D Animated Background Neural Constellation
function NeuralLattice() {
  const pointsCount = 70;
  const meshRef = useRef<THREE.Group>(null);

  const particles = useMemo(() => {
    const coords: [number, number, number][] = [];
    for (let i = 0; i < pointsCount; i++) {
      coords.push([
        (Math.random() - 0.5) * 16,
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 10,
      ]);
    }
    return coords;
  }, []);

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.05;
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.15) * 0.08;
    }
  });

  return (
    <group ref={meshRef}>
      {particles.map((pos, idx) => {
        const isCyan = idx % 2 === 0;
        return (
          <Float key={idx} speed={1.2} rotationIntensity={0.6} floatIntensity={1.2}>
            <Sphere position={pos} args={[0.07, 16, 16]}>
              <meshStandardMaterial
                color={isCyan ? '#06b6d4' : '#6366f1'}
                emissive={isCyan ? '#06b6d4' : '#6366f1'}
                emissiveIntensity={1.8}
                roughness={0.1}
              />
            </Sphere>
          </Float>
        );
      })}
    </group>
  );
}

export default function OnboardingApiKeysPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Form State
  const [groqKey, setGroqKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');

  // Visibility Toggles
  const [showGroq, setShowGroq] = useState(false);
  const [showGemini, setShowGemini] = useState(false);
  const [showOpenai, setShowOpenai] = useState(false);
  const [showAnthropic, setShowAnthropic] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Load local and remote keys
    const loadKeys = async () => {
      try {
        const local = getLocalApiKeys();
        if (local.groqApiKey) setGroqKey(local.groqApiKey);
        if (local.geminiApiKey) setGeminiKey(local.geminiApiKey);
        if (local.openaiApiKey) setOpenaiKey(local.openaiApiKey);
        if (local.anthropicApiKey) setAnthropicKey(local.anthropicApiKey);

        // Fetch latest saved from server
        const remote = await fetchRemoteApiKeys();
        if (remote.keys) {
          if (remote.keys.groq) setGroqKey(remote.keys.groq);
          if (remote.keys.gemini) setGeminiKey(remote.keys.gemini);
          if (remote.keys.openai) setOpenaiKey(remote.keys.openai);
          if (remote.keys.anthropic) setAnthropicKey(remote.keys.anthropic);
        }
      } catch (err) {
        // Silently continue if new user or server offline
      } finally {
        setLoading(false);
      }
    };
    loadKeys();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!groqKey.trim() || !geminiKey.trim() || !openaiKey.trim() || !anthropicKey.trim()) {
      setErrorMessage('All 4 LLM API keys (Groq, Google Gemini, OpenAI, and Anthropic Claude) are compulsory. Please fill in all keys.');
      return;
    }

    setSaving(true);
    try {
      const keysPayload = {
        groqApiKey: groqKey.trim(),
        geminiApiKey: geminiKey.trim(),
        openaiApiKey: openaiKey.trim(),
        anthropicApiKey: anthropicKey.trim(),
      };

      setLocalApiKeys(keysPayload);
      await saveRemoteApiKeys(keysPayload);

      setSaveSuccess(true);
      setTimeout(() => {
        router.push('/dashboard');
      }, 1000);
    } catch (err: any) {
      console.error('Failed to save API keys:', err);
      setErrorMessage(err.response?.data?.error || 'Failed to save API keys. Please verify server connection.');
    } finally {
      setSaving(false);
    }
  };

  const isGroqValid = groqKey.trim().length > 10;
  const isGeminiValid = geminiKey.trim().length > 10;
  const isOpenaiValid = openaiKey.trim().length > 10;
  const isAnthropicValid = anthropicKey.trim().length > 10;

  return (
    <div className="relative min-h-screen bg-[#09090b] text-zinc-100 flex flex-col justify-between overflow-x-hidden">
      {/* 3D Background Canvas */}
      {mounted && (
        <div className="fixed inset-0 pointer-events-none z-0 opacity-40">
          <Canvas camera={{ position: [0, 0, 7], fov: 60 }}>
            <ambientLight intensity={0.4} />
            <pointLight position={[10, 10, 10]} intensity={1} color="#6366f1" />
            <pointLight position={[-10, -10, -10]} intensity={0.8} color="#06b6d4" />
            <NeuralLattice />
          </Canvas>
        </div>
      )}

      {/* Ambient Radial Gradient Glows */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[128px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-[128px] pointer-events-none" />

      {/* Top Navigation */}
      <header className="relative z-10 max-w-6xl mx-auto w-full px-6 py-6 flex items-center justify-between border-b border-zinc-800/50 backdrop-blur-sm">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center font-bold text-sm text-white shadow-lg shadow-indigo-600/20 group-hover:scale-105 transition-transform">
            R
          </div>
          <span className="font-bold text-base tracking-tight text-zinc-200">
            Researcher<span className="text-indigo-400">GPT</span>
          </span>
        </Link>

        <Link
          href="/dashboard"
          className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5 transition-colors px-3 py-1.5 rounded-lg border border-zinc-800 hover:bg-zinc-900"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back to Dashboard
        </Link>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 max-w-4xl mx-auto w-full px-6 py-10 my-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-8"
        >
          {/* Header Title Section */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold tracking-wide">
              <Sparkles className="w-3.5 h-3.5" /> Bring Your Own Key (BYOK)
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              Configure Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-cyan-400">LLM API Keys</span>
            </h1>
            <p className="text-zinc-400 text-sm max-w-xl mx-auto leading-relaxed">
              To provide zero-cost academic paper generation and avoid shared token limits, ResearcherGPT connects directly to your personal API keys. Keys are saved globally for your account.
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 rounded-xl border border-rose-500/30 bg-rose-950/20 text-rose-400 text-xs flex items-center gap-3"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </motion.div>
          )}

          {/* API Key Configuration Form */}
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 gap-5">
              
              {/* Groq Card */}
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2 }}
                className="p-6 rounded-2xl border border-zinc-800 bg-zinc-950/70 backdrop-blur-xl shadow-xl space-y-4 hover:border-amber-500/40 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold text-zinc-100">Groq API Key</h2>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Recommended
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Powers all 13 synthesis agents via <span className="text-zinc-400 font-mono">llama-3.3-70b-versatile</span> at 500+ tok/s.
                      </p>
                    </div>
                  </div>
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-medium px-3 py-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-colors shrink-0"
                  >
                    <span>Get Free Key</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="relative">
                  <input
                    type={showGroq ? 'text' : 'password'}
                    value={groqKey}
                    onChange={(e) => setGroqKey(e.target.value)}
                    placeholder="gsk_..."
                    className="w-full bg-zinc-900/90 border border-zinc-800 focus:border-amber-500 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50 pr-12 font-mono transition-all"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {isGroqValid && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    <button
                      type="button"
                      onClick={() => setShowGroq(!showGroq)}
                      className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showGroq ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* Gemini Card */}
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2 }}
                className="p-6 rounded-2xl border border-zinc-800 bg-zinc-950/70 backdrop-blur-xl shadow-xl space-y-4 hover:border-cyan-500/40 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold">
                      <Cpu className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold text-zinc-100">Google Gemini API Key</h2>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          Recommended
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Powers 1M-token full-manuscript writing, multi-page OCR, and semantic vector embeddings via <span className="text-zinc-400 font-mono">gemini-2.5-flash</span>.
                      </p>
                    </div>
                  </div>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-medium px-3 py-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/5 hover:bg-cyan-500/10 transition-colors shrink-0"
                  >
                    <span>Get Free Key</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="relative">
                  <input
                    type={showGemini ? 'text' : 'password'}
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-zinc-900/90 border border-zinc-800 focus:border-cyan-500 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 pr-12 font-mono transition-all"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {isGeminiValid && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    <button
                      type="button"
                      onClick={() => setShowGemini(!showGemini)}
                      className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showGemini ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* OpenAI Card */}
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2 }}
                className="p-6 rounded-2xl border border-zinc-800 bg-zinc-950/70 backdrop-blur-xl shadow-xl space-y-4 hover:border-indigo-500/40 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
                      <Key className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold text-zinc-100">OpenAI API Key</h2>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          Compulsory
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Powers academic fact verification, citation validation, and peer review via <span className="text-zinc-400 font-mono">gpt-4o</span>.
                      </p>
                    </div>
                  </div>
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium px-3 py-1.5 rounded-lg border border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 transition-colors shrink-0"
                  >
                    <span>OpenAI Console</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="relative">
                  <input
                    type={showOpenai ? 'text' : 'password'}
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder="sk-..."
                    required
                    className="w-full bg-zinc-900/90 border border-zinc-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 pr-12 font-mono transition-all"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {isOpenaiValid && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    <button
                      type="button"
                      onClick={() => setShowOpenai(!showOpenai)}
                      className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showOpenai ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* Anthropic Card */}
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2 }}
                className="p-6 rounded-2xl border border-zinc-800 bg-zinc-950/70 backdrop-blur-xl shadow-xl space-y-4 hover:border-orange-500/40 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 font-bold">
                      <Key className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold text-zinc-100">Anthropic Claude API Key</h2>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          Compulsory
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Powers rigorous scholarly manuscript drafting, methodology analysis, and synthesis via <span className="text-zinc-400 font-mono">claude-3-5-sonnet</span>.
                      </p>
                    </div>
                  </div>
                  <a
                    href="https://console.anthropic.com/settings/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 font-medium px-3 py-1.5 rounded-lg border border-orange-500/20 bg-orange-500/5 hover:bg-orange-500/10 transition-colors shrink-0"
                  >
                    <span>Anthropic Console</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="relative">
                  <input
                    type={showAnthropic ? 'text' : 'password'}
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
                    placeholder="sk-ant-..."
                    required
                    className="w-full bg-zinc-900/90 border border-zinc-800 focus:border-orange-500 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50 pr-12 font-mono transition-all"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {isAnthropicValid && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    <button
                      type="button"
                      onClick={() => setShowAnthropic(!showAnthropic)}
                      className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showAnthropic ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </motion.div>

            </div>

            {/* Submission and Action Buttons */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Lock className="w-3.5 h-3.5 text-emerald-500" />
                <span>Encrypted & stored globally for your account</span>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Link
                  href="/dashboard"
                  className="px-4 py-2.5 rounded-xl border border-zinc-800 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors w-full sm:w-auto text-center"
                >
                  Skip for Now
                </Link>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 w-full sm:w-auto"
                >
                  {saveSuccess ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                      <span>Saved! Redirecting to Workspace...</span>
                    </>
                  ) : saving ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Saving Keys...</span>
                    </>
                  ) : (
                    <>
                      <span>Save Keys & Launch Workspace</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Privacy & Guarantee Info Card */}
          <div className="p-5 rounded-2xl border border-zinc-800/60 bg-zinc-950/40 backdrop-blur-sm grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-zinc-400">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-zinc-200 block mb-0.5">100% Private</strong>
                Keys are never shared with other users or logged into public metrics.
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-zinc-200 block mb-0.5">Zero Shared Quota</strong>
                Run long 35k-75k token synthesis runs without hitting developer bottlenecks.
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-zinc-200 block mb-0.5">Free Tiers Included</strong>
                Both Groq and Google Gemini offer free tiers with generous rate limits.
              </div>
            </div>
          </div>

        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-6xl mx-auto w-full px-6 py-6 border-t border-zinc-900 text-center text-xs text-zinc-600">
        ResearcherGPT Autonomous Multi-Agent Academic Synthesis Framework • Bring Your Own Key (BYOK)
      </footer>
    </div>
  );
}
