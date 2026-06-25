'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useProjectStore } from '../../store/projectStore';
import axios from 'axios';
import { ArrowLeft, GitPullRequest, RefreshCw, Layers } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function SurveyGeneratorPage() {
  const { activeProject, fetchProjects } = useProjectStore();
  const [survey, setSurvey] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  const loadSurvey = async () => {
    if (!activeProject) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/projects/${activeProject._id}/generated-papers`);
      const surveys = res.data.filter((p: any) => p.title.startsWith("A Comprehensive Survey"));
      if (surveys.length > 0) {
        const p = surveys[0];
        const taxContent = p.sections.find((s: any) => s.title === 'Taxonomy Map')?.content || '{}';
        const themesContent = p.sections.find((s: any) => s.title === 'Emerging Themes')?.content || '[]';
        setSurvey({
          title: p.title,
          taxonomy: JSON.parse(taxContent),
          themes: JSON.parse(themesContent)
        });
      } else {
        setSurvey(null);
      }
    } catch {
      setSurvey(null);
    } finally {
      setLoading(false);
    }
  };

  const generateSurvey = async () => {
    if (!activeProject) return;
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/agents/run`, {
        projectId: activeProject._id,
        query: `A Comprehensive Survey on agentic LLM routing`,
        workflowType: 'survey'
      });
      await new Promise((resolve) => setTimeout(resolve, 4000));
      await loadSurvey();
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeProject) loadSurvey();
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
            <GitPullRequest className="w-6 h-6 text-indigo-400" /> Survey Paper Generator
          </h1>
          <p className="text-zinc-500 text-xs mt-1">Project Workspace: {activeProject?.name || 'Loading...'}</p>
        </div>
      </div>

      {/* Main Panel */}
      <div className="max-w-4xl mx-auto">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-500">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
            <p className="text-xs">Building taxonomy classifications...</p>
          </div>
        ) : !survey ? (
          <div className="py-20 border border-dashed border-zinc-850 rounded-2xl text-center space-y-3 text-zinc-500">
            <Layers className="w-10 h-10 text-zinc-600 mx-auto" />
            <p className="text-zinc-400">Generate a new taxonomy survey paper</p>
            <button
              onClick={generateSurvey}
              className="px-4 h-9 rounded bg-indigo-600 hover:bg-indigo-500 text-xs text-zinc-100 font-semibold"
            >
              Generate Survey
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {/* Taxonomy Tree display */}
            <div className="p-6 border border-zinc-800 bg-zinc-950/40 rounded-2xl space-y-4">
              <h3 className="font-bold text-base">Hierarchy Taxonomy Map</h3>
              <div className="space-y-3 text-sm">
                <div className="p-3.5 rounded-lg border border-indigo-500/20 bg-indigo-500/5">
                  <p className="font-bold text-indigo-400">{survey.taxonomy.category_name}</p>
                  <div className="mt-2.5 pl-4 border-l-2 border-zinc-800 space-y-3">
                    {survey.taxonomy.subcategories.map((sub: any, idx: number) => (
                      <div key={idx} className="space-y-1">
                        <p className="font-semibold text-zinc-300">{sub.category_name}</p>
                        <ul className="list-disc pl-5 text-xs text-zinc-500">
                          {sub.papers.map((p: string, pIdx: number) => <li key={pIdx}>Paper: *{p}*</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Themes */}
            <div className="p-6 border border-zinc-800 bg-zinc-950/40 rounded-2xl space-y-4">
              <h3 className="font-bold text-base">Emerging Themes</h3>
              <div className="grid grid-cols-1 gap-3 text-xs">
                {survey.themes.map((t: any, idx: number) => (
                  <div key={idx} className="p-3.5 rounded-lg border border-zinc-850 bg-zinc-900/10 space-y-1">
                    <p className="font-semibold text-zinc-200">{t.theme}</p>
                    <p className="text-zinc-500 leading-relaxed">{t.description}</p>
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
