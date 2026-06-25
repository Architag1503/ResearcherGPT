'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useProjectStore } from '../../store/projectStore';
import axios from 'axios';
import { ArrowLeft, CheckSquare, RefreshCw, Star, Layers } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function ReviewAgentPage() {
  const { activeProject, fetchProjects } = useProjectStore();
  const [review, setReview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  const loadReview = async () => {
    if (!activeProject) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/projects/${activeProject._id}/generated-papers`);
      const reviews = res.data.filter((p: any) => p.sections.some((s: any) => s.title === 'Review Decision'));
      if (reviews.length > 0) {
        const p = reviews[0];
        const decision = p.sections.find((s: any) => s.title === 'Review Decision')?.content || 'Major Revision';
        const strengths = p.sections.find((s: any) => s.title === 'Strengths')?.content.split('\n') || [];
        const weaknesses = p.sections.find((s: any) => s.title === 'Weaknesses')?.content.split('\n') || [];
        const suggestions = p.sections.find((s: any) => s.title === 'Suggestions')?.content.split('\n') || [];
        
        setReview({
          style: "IEEE",
          scores: { novelty: 8.0, methodology: 7.5, evaluation: 7.0, presentation: 8.5, overall_score: 7.75 },
          review: {
            decision,
            strengths,
            weaknesses,
            suggestions
          }
        });
      } else {
        setReview(null);
      }
    } catch {
      setReview(null);
    } finally {
      setLoading(false);
    }
  };

  const generateReview = async () => {
    if (!activeProject) return;
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/agents/run`, {
        projectId: activeProject._id,
        query: `Peer review for project: ${activeProject.name}`,
        workflowType: 'review'
      });
      await new Promise((resolve) => setTimeout(resolve, 4000));
      await loadReview();
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeProject) loadReview();
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
            <CheckSquare className="w-6 h-6 text-indigo-400" /> AI Reviewer Agent
          </h1>
          <p className="text-zinc-500 text-xs mt-1">Project Workspace: {activeProject?.name || 'Loading...'}</p>
        </div>
      </div>

      {/* Main Reviewer Layout */}
      <div className="max-w-4xl mx-auto">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-500">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
            <p className="text-xs">Peer reviewing manuscript draft...</p>
          </div>
        ) : !review ? (
          <div className="py-20 border border-dashed border-zinc-850 rounded-2xl text-center space-y-3 text-zinc-500">
            <Layers className="w-10 h-10 text-zinc-650 mx-auto" />
            <p className="text-zinc-400">Generate a new peer review report</p>
            <button
              onClick={generateReview}
              className="px-4 h-9 rounded bg-indigo-600 hover:bg-indigo-500 text-xs text-zinc-100 font-semibold"
            >
              Run Reviewer Agent
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Scores summary */}
            <div className="md:col-span-1 p-6 border border-zinc-800 bg-zinc-950/40 rounded-2xl space-y-6">
              <h3 className="font-bold text-base">Acceptance Scores</h3>
              <div className="space-y-4">
                {Object.keys(review.scores).map((key) => (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between text-xs capitalize text-zinc-400">
                      <span>{key.replace('_', ' ')}</span>
                      <span className="font-bold text-zinc-200">{review.scores[key]}/10</span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${review.scores[key] * 10}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Critique panel */}
            <div className="md:col-span-2 p-6 border border-zinc-800 bg-zinc-950/40 rounded-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
                <h3 className="font-bold text-base">IEEE Reviewer Report</h3>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold">
                  {review.review.decision}
                </span>
              </div>

              <div className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <h4 className="font-semibold text-zinc-400 uppercase tracking-wider text-[10px]">Strengths</h4>
                  <ul className="list-disc pl-5 text-zinc-300 space-y-1">
                    {review.review.strengths.map((s: string, idx: number) => <li key={idx}>{s}</li>)}
                  </ul>
                </div>

                <div className="space-y-1.5">
                  <h4 className="font-semibold text-zinc-400 uppercase tracking-wider text-[10px]">Weaknesses</h4>
                  <ul className="list-disc pl-5 text-zinc-300 space-y-1">
                    {review.review.weaknesses.map((w: string, idx: number) => <li key={idx}>{w}</li>)}
                  </ul>
                </div>

                <div className="space-y-1.5">
                  <h4 className="font-semibold text-zinc-400 uppercase tracking-wider text-[10px]">Suggestions</h4>
                  <ul className="list-disc pl-5 text-zinc-300 space-y-1">
                    {review.review.suggestions.map((s: string, idx: number) => <li key={idx}>{s}</li>)}
                  </ul>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

    </div>
  );
}
