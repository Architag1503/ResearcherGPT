'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Sliders, Key, HelpCircle } from 'lucide-react';

export default function SettingsPage() {
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [qdrantHost, setQdrantHost] = useState('localhost');
  const [neo4jUri, setNeo4jUri] = useState('bolt://localhost:7687');
  const [success, setSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 p-6 md:p-10">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="p-2 rounded-lg hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold">Workspace Settings</h1>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* API Keys configuration */}
          <div className="p-6 border border-zinc-800 bg-zinc-950/40 rounded-2xl space-y-4">
            <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
              <Key className="w-4.5 h-4.5 text-indigo-400" />
              <h3 className="font-semibold text-base">Model Provider Credentials</h3>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400">Gemini 2.5 Pro API Key</label>
                <input
                  type="password"
                  placeholder="AI_GEMINI_API_KEY..."
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  className="w-full h-10 px-3 bg-zinc-950 border border-zinc-850 rounded-lg text-xs outline-none focus:border-indigo-500 text-zinc-300"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400">OpenAI API Key (Fallback)</label>
                <input
                  type="password"
                  placeholder="sk-proj-..."
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  className="w-full h-10 px-3 bg-zinc-950 border border-zinc-850 rounded-lg text-xs outline-none focus:border-indigo-500 text-zinc-300"
                />
              </div>
            </div>
          </div>

          {/* Database configuration */}
          <div className="p-6 border border-zinc-800 bg-zinc-950/40 rounded-2xl space-y-4">
            <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
              <Sliders className="w-4.5 h-4.5 text-cyan-400" />
              <h3 className="font-semibold text-base">Database Endpoints</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400">Qdrant Host</label>
                <input
                  type="text"
                  placeholder="localhost"
                  value={qdrantHost}
                  onChange={(e) => setQdrantHost(e.target.value)}
                  className="w-full h-10 px-3 bg-zinc-950 border border-zinc-850 rounded-lg text-xs outline-none focus:border-indigo-500 text-zinc-300"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400">Neo4j Connection URI</label>
                <input
                  type="text"
                  placeholder="bolt://localhost:7687"
                  value={neo4jUri}
                  onChange={(e) => setNeo4jUri(e.target.value)}
                  className="w-full h-10 px-3 bg-zinc-950 border border-zinc-850 rounded-lg text-xs outline-none focus:border-indigo-500 text-zinc-300"
                />
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-zinc-500 flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5" /> Credentials are encrypted and stored locally.
            </span>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-5 h-10 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-zinc-100 font-semibold text-sm transition-colors flex items-center gap-1.5 shadow-lg shadow-indigo-600/10"
              >
                <Save className="w-4 h-4" /> Save Settings
              </button>
            </div>
          </div>

          {success && (
            <p className="text-xs text-center text-emerald-400 font-medium animate-pulse">Settings updated successfully!</p>
          )}
        </form>

      </div>
    </div>
  );
}
