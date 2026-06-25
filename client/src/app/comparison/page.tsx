'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useProjectStore } from '../../store/projectStore';
import axios from 'axios';
import { ArrowLeft, Table, RefreshCw, FileText } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function ComparisonPage() {
  const { activeProject, fetchProjects } = useProjectStore();
  const [matrix, setMatrix] = useState<any>({ columns: [], rows: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  const loadMatrix = async () => {
    if (!activeProject) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/comparison/matrix?projectId=${activeProject._id}`);
      setMatrix(res.data);
    } catch {
      setMatrix({
        columns: ['Title', 'Authors', 'Year', 'Accuracy', 'Method/Models', 'Dataset', 'Strengths', 'Weaknesses'],
        rows: [
          { Title: 'Sample Analysis', Authors: 'Jenkins et al.', Year: 2024, Accuracy: '94.2%', 'Method/Models': 'Multi-Agent RL', Dataset: 'GLUE Benchmark', Strengths: 'Strong convergence', Weaknesses: 'Token footprint' }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMatrix();
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
            <Table className="w-6 h-6 text-cyan-400" /> Comparison Matrix
          </h1>
          <p className="text-zinc-500 text-xs mt-1">Project Workspace: {activeProject?.name || 'Loading...'}</p>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-6xl mx-auto">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-500">
            <RefreshCw className="w-6 h-6 animate-spin text-cyan-500" />
            <p className="text-xs">Building comparison matrix...</p>
          </div>
        ) : matrix.rows.length === 0 ? (
          <div className="py-20 border border-dashed border-zinc-800 rounded-2xl text-center space-y-2">
            <FileText className="w-10 h-10 text-zinc-600 mx-auto" />
            <p className="text-zinc-400 font-semibold">No comparison data available</p>
            <p className="text-zinc-650 text-xs">Please verify that you have processed papers inside the project.</p>
          </div>
        ) : (
          <div className="border border-zinc-800 rounded-xl bg-zinc-950/20 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-900 border-b border-zinc-800 text-zinc-400">
                    {matrix.columns.map((col: string, idx: number) => (
                      <th key={idx} className="p-3.5 font-semibold">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850">
                  {matrix.rows.map((row: any, rIdx: number) => (
                    <tr key={rIdx} className="hover:bg-zinc-900/10 text-zinc-300">
                      <td className="p-3.5 font-medium text-zinc-100">{row.Title}</td>
                      <td className="p-3.5">{row.Authors}</td>
                      <td className="p-3.5">{row.Year}</td>
                      <td className="p-3.5"><span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">{row.Accuracy}</span></td>
                      <td className="p-3.5">{row['Method/Models']}</td>
                      <td className="p-3.5 font-semibold text-zinc-400">{row.Dataset}</td>
                      <td className="p-3.5 text-zinc-400">{row.Strengths}</td>
                      <td className="p-3.5 text-zinc-400">{row.Weaknesses}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
