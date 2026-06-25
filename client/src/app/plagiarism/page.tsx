'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useProjectStore } from '../../store/projectStore';
import axios from 'axios';
import { ArrowLeft, ShieldAlert, RefreshCw, BarChart2 } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function PlagiarismPage() {
  const { activeProject, fetchProjects } = useProjectStore();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  const loadReport = async () => {
    if (!activeProject) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/projects/${activeProject._id}/plagiarism-reports`);
      if (res.data && res.data.length > 0) {
        setReport(res.data[0]); // latest report
      } else {
        setReport(null);
      }
    } catch {
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [activeProject]);

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 p-6 md:p-10 space-y-8">
      
      {/* Header */}
      <div className="max-w-4xl mx-auto flex items-center gap-3 border-b border-zinc-800 pb-6">
        <Link href="/dashboard" className="p-2 rounded-lg hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-indigo-400" /> Plagiarism Audit
          </h1>
          <p className="text-zinc-500 text-xs mt-1">Project Workspace: {activeProject?.name || 'Loading...'}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-500">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
            <p className="text-xs">Running sentence similarity check...</p>
          </div>
        ) : !report ? (
          <div className="py-20 border border-dashed border-zinc-850 text-center text-zinc-500 rounded-2xl">
            No plagiarism audit generated yet.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Score Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-950/40 text-center space-y-1">
                <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Similarity Score</span>
                <p className="text-4xl font-extrabold text-indigo-400 mt-1">{report.similarityPercentage}%</p>
              </div>
              <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-950/40 text-center space-y-1">
                <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Risk Level</span>
                <p className={`text-4xl font-extrabold mt-1 ${report.riskScore > 30 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {report.riskScore}%
                </p>
              </div>
            </div>

            {/* Overlap list */}
            <div className="p-6 border border-zinc-800 bg-zinc-950/20 rounded-2xl space-y-4">
              <h3 className="font-bold text-base">Overlapping Text Snippets</h3>
              <div className="space-y-3">
                {report.matches.map((m: any, idx: number) => (
                  <div key={idx} className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/10 space-y-2">
                    <div className="flex items-center justify-between text-xs border-b border-zinc-850 pb-1.5">
                      <span className="font-semibold text-zinc-400">Match Source: {m.sourceTitle}</span>
                      <span className="text-[10px] text-zinc-500">Overlap: {m.similarityPercentage}%</span>
                    </div>
                    <p className="text-xs text-zinc-500 italic leading-relaxed">&ldquo;...{m.text}...&rdquo;</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
