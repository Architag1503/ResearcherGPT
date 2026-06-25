'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useProjectStore } from '../../store/projectStore';
import axios from 'axios';
import { ArrowLeft, FileSymlink, RefreshCw, Layers } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function ProposalGeneratorPage() {
  const { activeProject, fetchProjects } = useProjectStore();
  const [proposal, setProposal] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const loadProposal = async () => {
    if (!activeProject) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/projects/${activeProject._id}/generated-papers`);
      const proposals = res.data.filter((p: any) => p.title.startsWith("Research Proposal:"));
      if (proposals.length > 0) {
        const p = proposals[0];
        const prob = p.sections.find((s: any) => s.title === 'Problem Statement')?.content || '';
        const objs = p.sections.find((s: any) => s.title === 'Objectives')?.content.split('\n') || [];
        const outcomes = p.sections.find((s: any) => s.title === 'Expected Outcomes')?.content.split('\n') || [];
        const tl = p.sections.find((s: any) => s.title === 'Timeline')?.content.split('\n') || [];
        setProposal({
          title: p.title,
          problem_statement: prob,
          objectives: objs,
          expected_outcomes: outcomes,
          timeline: tl
        });
      } else {
        setProposal(null);
      }
    } catch {
      setProposal(null);
    } finally {
      setLoading(false);
    }
  };

  const generateProposal = async () => {
    if (!activeProject) return;
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/agents/run`, {
        projectId: activeProject._id,
        query: `Stateful multi-agent RAG optimizations`,
        workflowType: 'proposal'
      });
      await new Promise((resolve) => setTimeout(resolve, 4000));
      await loadProposal();
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeProject) loadProposal();
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
            <FileSymlink className="w-6 h-6 text-indigo-400" /> Research Proposal Generator
          </h1>
          <p className="text-zinc-500 text-xs mt-1">Project Workspace: {activeProject?.name || 'Loading...'}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-500">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
            <p className="text-xs">Generating research proposal...</p>
          </div>
        ) : !proposal ? (
          <div className="py-20 border border-dashed border-zinc-850 rounded-2xl text-center space-y-3">
            <Layers className="w-10 h-10 text-zinc-650 mx-auto" />
            <p className="text-zinc-400">Generate a proposal proposal</p>
            <button
              onClick={generateProposal}
              className="px-4 h-9 rounded bg-indigo-600 hover:bg-indigo-500 text-xs text-zinc-100 font-semibold"
            >
              Generate Proposal
            </button>
          </div>
        ) : (
          <div className="p-6 border border-zinc-800 bg-zinc-950/40 rounded-2xl space-y-6">
            <h2 className="font-bold text-xl text-zinc-100">{proposal.title}</h2>
            
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Problem Statement</h4>
              <p className="text-sm text-zinc-300 leading-relaxed">{proposal.problem_statement}</p>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Objectives</h4>
              <ul className="list-disc pl-5 text-sm text-zinc-300 space-y-1">
                {proposal.objectives.map((o: string, idx: number) => <li key={idx}>{o}</li>)}
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Expected Outcomes</h4>
              <ul className="list-disc pl-5 text-sm text-zinc-300 space-y-1">
                {proposal.expected_outcomes.map((o: string, idx: number) => <li key={idx}>{o}</li>)}
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Timeline</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {proposal.timeline.map((t: string, idx: number) => (
                  <div key={idx} className="p-3 rounded-lg border border-zinc-850 bg-zinc-900/10 text-xs text-zinc-400">
                    {t}
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
