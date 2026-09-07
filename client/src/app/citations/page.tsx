'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useProjectStore } from '../../store/projectStore';
import axios from 'axios';
import {
  ArrowLeft,
  Bookmark,
  RefreshCw,
  FileText,
  ExternalLink,
  Calendar,
  Users,
  Copy,
  Check,
  BookOpen
} from 'lucide-react';
import { getApiUrl } from '../../utils/apiUrl';

const API_URL = getApiUrl();

export default function CitationsPage() {
  const { activeProject, fetchProjects } = useProjectStore();
  const [citations, setCitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStyle, setActiveStyle] = useState<'apa' | 'ieee' | 'mla' | 'chicago' | 'harvard'>('apa');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const loadCitations = async () => {
    if (!activeProject) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/citations?projectId=${activeProject._id}`);
      setCitations(res.data);
    } catch {
      setCitations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCitations();
  }, [activeProject]);

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getFormattedStyle = (c: any) => {
    if (c.styles && c.styles[activeStyle]) {
      return c.styles[activeStyle];
    }
    return c.styles?.apa || c.styles?.ieee || c.apa || c.ieee || c.title;
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 p-6 md:p-10 space-y-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-2 rounded-lg hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bookmark className="w-6 h-6 text-indigo-400" /> Reference Bibliography
            </h1>
            <p className="text-zinc-500 text-xs mt-1">
              Project Workspace: <span className="text-zinc-300 font-medium">{activeProject?.name || 'Loading...'}</span>
            </p>
          </div>
        </div>

        {/* Style Selector Tabs */}
        <div className="flex items-center gap-1 bg-zinc-900/90 border border-zinc-800 p-1 rounded-xl text-xs">
          {(['apa', 'ieee', 'mla', 'chicago', 'harvard'] as const).map((style) => (
            <button
              key={style}
              onClick={() => setActiveStyle(style)}
              className={`px-3 py-1.5 rounded-lg font-medium uppercase transition-all ${
                activeStyle === style
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              {style}
            </button>
          ))}
        </div>
      </div>

      {/* Main List */}
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
          <span>Verified Academic Publications: <strong className="text-zinc-200">{citations.length}</strong></span>
          <button
            onClick={loadCitations}
            className="flex items-center gap-1.5 hover:text-indigo-400 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-zinc-500">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
            <p className="text-xs">Loading authentic references library...</p>
          </div>
        ) : citations.length === 0 ? (
          <div className="py-20 border border-dashed border-zinc-800 rounded-2xl text-center space-y-2">
            <FileText className="w-10 h-10 text-zinc-600 mx-auto" />
            <p className="text-zinc-400 font-semibold">No citations logged</p>
            <p className="text-zinc-500 text-xs">Run a multi-agent writing agent or paper compiler to populate verified references.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {citations.map((c) => {
              const formattedCitation = getFormattedStyle(c);
              const paperLink = c.url || (c.doi ? (c.doi.startsWith('http') ? c.doi : `https://doi.org/${c.doi}`) : null);
              const authorsText = Array.isArray(c.authors) && c.authors.length > 0 ? c.authors.join(', ') : 'Unknown Authors';
              const pubDateText = c.publishDate || c.year || 'n.d.';

              return (
                <div
                  key={c._id}
                  className="p-6 rounded-2xl border border-zinc-800 bg-zinc-950/40 hover:border-zinc-700 transition-all space-y-4"
                >
                  {/* Top Metadata Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-900 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-mono font-semibold text-xs">
                        [{c.key}]
                      </span>
                      {c.journal && (
                        <span className="flex items-center gap-1 text-xs text-zinc-400 bg-zinc-900/60 px-2 py-0.5 rounded border border-zinc-800">
                          <BookOpen className="w-3 h-3 text-zinc-500" /> {c.journal}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      {pubDateText && (
                        <span className="flex items-center gap-1 text-zinc-400">
                          <Calendar className="w-3.5 h-3.5 text-zinc-500" /> Published: <strong className="text-zinc-300 font-mono">{pubDateText}</strong>
                        </span>
                      )}
                      {paperLink && (
                        <a
                          href={paperLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors underline-offset-2 hover:underline"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> View Paper
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Paper Title & Authors */}
                  <div className="space-y-1.5">
                    <h3 className="text-base font-semibold text-zinc-100 leading-snug">
                      {c.title}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                      <Users className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                      <span className="truncate">{authorsText}</span>
                    </div>
                  </div>

                  {/* Formatted Citation Block */}
                  <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-start justify-between gap-4">
                    <p className="text-xs text-zinc-300 leading-relaxed font-serif select-all">
                      {formattedCitation}
                    </p>
                    <button
                      onClick={() => copyToClipboard(c._id, formattedCitation)}
                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors flex-shrink-0"
                      title="Copy citation"
                    >
                      {copiedId === c._id ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
