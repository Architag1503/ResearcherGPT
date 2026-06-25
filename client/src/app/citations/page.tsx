'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useProjectStore } from '../../store/projectStore';
import axios from 'axios';
import { ArrowLeft, Bookmark, RefreshCw, FileText } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function CitationsPage() {
  const { activeProject, fetchProjects } = useProjectStore();
  const [citations, setCitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 p-6 md:p-10 space-y-8">
      
      {/* Header */}
      <div className="max-w-6xl mx-auto flex items-center gap-3 border-b border-zinc-800 pb-6">
        <Link href="/dashboard" className="p-2 rounded-lg hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bookmark className="w-6 h-6 text-indigo-400" /> Reference bibliography
          </h1>
          <p className="text-zinc-500 text-xs mt-1">Project Workspace: {activeProject?.name || 'Loading...'}</p>
        </div>
      </div>

      {/* Main List */}
      <div className="max-w-6xl mx-auto">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-500">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
            <p className="text-xs">Loading references library...</p>
          </div>
        ) : citations.length === 0 ? (
          <div className="py-20 border border-dashed border-zinc-800 rounded-2xl text-center space-y-2">
            <FileText className="w-10 h-10 text-zinc-600 mx-auto" />
            <p className="text-zinc-400 font-semibold">No citations logged</p>
            <p className="text-zinc-650 text-xs">Run a multi-agent writing agent to populate your bibliography.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {citations.map((c) => (
              <div key={c._id} className="p-5 rounded-2xl border border-zinc-800 bg-zinc-950/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-semibold text-[10px]">
                    [{c.key}]
                  </span>
                  <span className="text-[10px] text-zinc-500">{c.doi || 'No DOI'}</span>
                </div>
                <p className="text-sm text-zinc-200 leading-relaxed font-serif">{c.styles?.apa || c.styles?.ieee}</p>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
