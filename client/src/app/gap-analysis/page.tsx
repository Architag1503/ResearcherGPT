'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useProjectStore } from '../../store/projectStore';
import axios from 'axios';
import { ArrowLeft, AlertTriangle, RefreshCw, BarChart2, Plus, Sparkles } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function GapAnalysisPage() {
  const { activeProject, fetchProjects } = useProjectStore();
  const [gaps, setGaps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit States for Gaps
  const [editingGapId, setEditingGapId] = useState<string | null>(null);
  const [editGapTitle, setEditGapTitle] = useState<string>('');
  const [editGapDescription, setEditGapDescription] = useState<string>('');
  const [editGapCategory, setEditGapCategory] = useState<string>('other');
  const [editGapImpact, setEditGapImpact] = useState<number>(5);
  const [editGapFeasibility, setEditGapFeasibility] = useState<number>(5);
  const [editGapEvidence, setEditGapEvidence] = useState<string>('');
  // Track which card is currently running AI generation
  const [fillingWithAIForId, setFillingWithAIForId] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const loadGaps = async () => {
    if (!activeProject) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/projects/${activeProject._id}/gaps`);
      setGaps(res.data || []);
    } catch {
      setGaps([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGaps();
  }, [activeProject]);

  const handleAddNewGapClick = () => {
    setEditingGapId('new-gap');
    setEditGapTitle('');
    setEditGapDescription('');
    setEditGapCategory('other');
    setEditGapImpact(5);
    setEditGapFeasibility(5);
    setEditGapEvidence('');
  };

  const handleSaveNewGap = async () => {
    if (!activeProject) return;
    try {
      const evidenceArray = editGapEvidence
        .split('\n')
        .map(e => e.trim())
        .filter(Boolean);

      const res = await axios.post(`${API_URL}/api/projects/${activeProject._id}/gaps`, {
        title: editGapTitle || 'Mined Gap',
        description: editGapDescription || 'No description provided.',
        category: editGapCategory,
        impactScore: editGapImpact,
        feasibilityScore: editGapFeasibility,
        evidence: evidenceArray
      });
      setEditingGapId(null);
      setGaps(prev => [res.data, ...prev]);
    } catch (err) {
      console.error('Failed to create manual gap:', err);
    }
  };

  const handleUpdateGap = async (gapId: string) => {
    try {
      const evidenceArray = editGapEvidence
        .split('\n')
        .map(e => e.trim())
        .filter(Boolean);

      await axios.put(`${API_URL}/api/projects/gaps/${gapId}`, {
        title: editGapTitle,
        description: editGapDescription,
        category: editGapCategory,
        impactScore: editGapImpact,
        feasibilityScore: editGapFeasibility,
        evidence: evidenceArray
      });
      setEditingGapId(null);
      loadGaps();
    } catch (err) {
      console.error('Failed to update gap:', err);
    }
  };

  const handleDeleteGap = async (gapId: string) => {
    try {
      await axios.delete(`${API_URL}/api/projects/gaps/${gapId}`);
      loadGaps();
    } catch (err) {
      console.error('Failed to delete gap:', err);
    }
  };

  /**
   * Fill the form fields with AI-generated data.
   * cardId: 'new-gap' for the new card form, or the gap's _id for existing cards.
   * If called from an existing card's view mode, we first open edit mode for that card.
   */
  const handleFillFormWithAI = async (cardId: string, existingGap?: any) => {
    if (!activeProject) return;
    setFillingWithAIForId(cardId);

    // If called from an existing card in view mode, open its edit form first with current data
    if (cardId !== 'new-gap' && existingGap) {
      setEditingGapId(cardId);
      setEditGapTitle(existingGap.title || '');
      setEditGapDescription(existingGap.description || '');
      setEditGapCategory(existingGap.category || 'other');
      setEditGapImpact(existingGap.impactScore || 5);
      setEditGapFeasibility(existingGap.feasibilityScore || 5);
      setEditGapEvidence((existingGap.evidence || []).join('\n'));
    } else if (cardId === 'new-gap') {
      // Ensure the new-gap form is open
      setEditingGapId('new-gap');
    }

    try {
      const res = await axios.post(`${API_URL}/api/projects/${activeProject._id}/gaps/generate-single`);
      if (res.data) {
        setEditGapTitle(res.data.title || 'Mined Gap');
        setEditGapDescription(res.data.description || 'No description provided.');
        setEditGapCategory(res.data.category || 'other');
        setEditGapImpact(res.data.impactScore || 5);
        setEditGapFeasibility(res.data.feasibilityScore || 5);
        setEditGapEvidence((res.data.evidence || []).join('\n'));
      }
    } catch (err) {
      console.error('Failed to fill form with AI:', err);
    } finally {
      setFillingWithAIForId(null);
    }
  };

  /** Shared edit form JSX — used for both new-gap and existing-gap editing */
  const renderEditForm = (cardId: string, onSave: () => void) => {
    const isGenerating = fillingWithAIForId === cardId;
    return (
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] text-zinc-500 font-semibold uppercase">Title</label>
          <input
            type="text"
            required
            placeholder="e.g. Mined Gap"
            value={editGapTitle}
            onChange={(e) => setEditGapTitle(e.target.value)}
            className="w-full h-8 px-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-zinc-500 font-semibold uppercase">Description</label>
          <textarea
            required
            placeholder="e.g. No description provided."
            value={editGapDescription}
            onChange={(e) => setEditGapDescription(e.target.value)}
            className="w-full p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
            rows={3}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-zinc-500 font-semibold uppercase">Supporting Evidence (one quote per line)</label>
          <textarea
            placeholder="Add sentences/quotes from source papers proving this gap..."
            value={editGapEvidence}
            onChange={(e) => setEditGapEvidence(e.target.value)}
            className="w-full p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
            rows={3}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500 font-semibold uppercase">Category</label>
            <select
              value={editGapCategory}
              onChange={(e) => setEditGapCategory(e.target.value)}
              className="w-full h-8 px-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="methodological">Methodological</option>
              <option value="empirical">Empirical</option>
              <option value="theoretical">Theoretical</option>
              <option value="dataset">Dataset</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500 font-semibold uppercase">Impact (1-10)</label>
            <input
              type="number"
              min={1}
              max={10}
              value={editGapImpact}
              onChange={(e) => setEditGapImpact(parseInt(e.target.value) || 5)}
              className="w-full h-8 px-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500 font-semibold uppercase">Feasibility (1-10)</label>
            <input
              type="number"
              min={1}
              max={10}
              value={editGapFeasibility}
              onChange={(e) => setEditGapFeasibility(parseInt(e.target.value) || 5)}
              className="w-full h-8 px-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
        <div className="flex gap-2 justify-between pt-1 w-full">
          <button
            type="button"
            onClick={() => handleFillFormWithAI(cardId)}
            disabled={isGenerating}
            className="px-3 py-1.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 disabled:text-zinc-500 disabled:bg-zinc-900 border border-amber-500/20 text-[11px] font-semibold transition-colors flex items-center gap-1.5"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-2.5 h-2.5" />
                <span>Generate Gap with AI</span>
              </>
            )}
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setEditingGapId(null)}
              className="px-3 py-1.5 rounded bg-zinc-850 hover:bg-zinc-800 text-[11px] font-semibold text-zinc-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-[11px] font-semibold text-zinc-100 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 p-6 md:p-10 space-y-8">
      
      {/* Header */}
      <div className="max-w-6xl mx-auto flex items-center justify-between border-b border-zinc-800 pb-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="p-2 rounded-lg hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-amber-500" /> Research Gap Analysis
            </h1>
            <p className="text-zinc-500 text-xs mt-1">Project Workspace: {activeProject?.name || 'Loading...'}</p>
          </div>
        </div>
        {activeProject && (
          <button
            onClick={handleAddNewGapClick}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-zinc-100 transition-all flex items-center gap-2 text-xs font-semibold shadow-lg shadow-indigo-600/10"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        )}
      </div>

      {/* Main Board */}
      <div className="max-w-6xl mx-auto">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-500">
            <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
            <p className="text-xs">Mining literature constraints...</p>
          </div>
        ) : gaps.length === 0 && editingGapId !== 'new-gap' ? (
          <div className="py-20 border border-dashed border-zinc-800 rounded-2xl text-center space-y-4 flex flex-col items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-zinc-600" />
            <div>
              <p className="text-zinc-400 font-semibold">No gaps mapped</p>
              <p className="text-zinc-650 text-xs mt-1">Create a new gap card manually, or generate them automatically using AI.</p>
            </div>
            {activeProject && (
              <button
                onClick={handleAddNewGapClick}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-zinc-100 font-semibold text-xs transition-colors flex items-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Research Gap</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Unsaved Manual Gap Creation Card */}
            {editingGapId === 'new-gap' && (
              <div className="p-6 rounded-2xl border border-indigo-500/50 bg-zinc-950/40 space-y-4 relative flex flex-col justify-between">
                {renderEditForm('new-gap', handleSaveNewGap)}
              </div>
            )}

            {[...gaps].sort((a, b) => (b.impactScore || 0) - (a.impactScore || 0)).map((g) => (
              <div key={g._id} className="p-6 rounded-2xl border border-zinc-800 bg-zinc-950/40 space-y-4 relative flex flex-col justify-between">
                {editingGapId === g._id ? (
                  renderEditForm(g._id, () => handleUpdateGap(g._id))
                ) : (
                  <div className="flex flex-col h-full justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                        <h3 className="font-bold text-base text-zinc-200">{g.title}</h3>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px] font-semibold uppercase">
                            {g.category}
                          </span>
                          <button
                            onClick={() => {
                              setEditingGapId(g._id);
                              setEditGapTitle(g.title);
                              setEditGapDescription(g.description);
                              setEditGapCategory(g.category || 'other');
                              setEditGapImpact(g.impactScore || 5);
                              setEditGapFeasibility(g.feasibilityScore || 5);
                              setEditGapEvidence((g.evidence || []).join('\n'));
                            }}
                            className="text-[10px] text-zinc-400 hover:text-indigo-400 font-semibold transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteGap(g._id)}
                            className="text-[10px] text-zinc-500 hover:text-red-400 font-semibold transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-zinc-450 leading-relaxed">{g.description}</p>
                      
                      {g.evidence && g.evidence.length > 0 && (
                        <div className="space-y-1.5 bg-[#0b0b0d] p-3 rounded-lg border border-zinc-900 mt-2">
                          <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Supporting Evidence</span>
                          <ul className="list-disc list-inside space-y-1 text-xs text-zinc-400 pl-1">
                            {g.evidence.map((ev: string, idx: number) => (
                              <li key={idx} className="leading-relaxed list-none border-l-2 border-amber-500/55 pl-2 py-0.5 italic">
                                &ldquo;{ev}&rdquo;
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between border-t border-zinc-850/60 pt-2">
                      <div className="flex gap-4 text-[11px] text-zinc-500">
                        <span className="flex items-center gap-1"><BarChart2 className="w-3.5 h-3.5 text-indigo-400" /> Impact: {g.impactScore}/10</span>
                        <span>Feasibility: {g.feasibilityScore}/10</span>
                      </div>
                      {/* Per-card Generate Gap with AI button */}
                      <button
                        onClick={() => handleFillFormWithAI(g._id, g)}
                        disabled={fillingWithAIForId === g._id}
                        className="px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 disabled:text-zinc-500 disabled:bg-zinc-900 border border-amber-500/20 text-[10px] font-semibold transition-colors flex items-center gap-1.5"
                      >
                        {fillingWithAIForId === g._id ? (
                          <>
                            <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>Generate Gap with AI</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
