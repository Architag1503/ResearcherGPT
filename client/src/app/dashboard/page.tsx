'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import axios from 'axios';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { FolderPlus, RefreshCw, ChevronRight, Plus, FileText, BookOpen, Layers, Cpu, BookMarked, Pencil, Trash2 } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface DashboardStats {
  projects: number;
  papers: number;
  citations: number;
  researchGaps: number;
  agentRuns: number;
  manuscripts: number;
  activeAgents: number;
  trend: { month: string; papers: number; citations: number }[];
}

const emptyStats: DashboardStats = {
  projects: 0,
  papers: 0,
  citations: 0,
  researchGaps: 0,
  agentRuns: 0,
  manuscripts: 0,
  activeAgents: 0,
  trend: [],
};

export default function Dashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [apiError, setApiError] = useState(false);
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [generationError, setGenerationError] = useState('');

  // Edit Project States
  const [showEditModal, setShowEditModal] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<any>(null);
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectDesc, setEditProjectDesc] = useState('');
  const [isUpdatingProject, setIsUpdatingProject] = useState(false);
  const [editGenerationError, setEditGenerationError] = useState('');
  const [isGeneratingEditDesc, setIsGeneratingEditDesc] = useState(false);

  // Delete Project States
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<any>(null);
  const [isDeletingProject, setIsDeletingProject] = useState(false);

  const handleGenerateDescriptionWithAI = async () => {
    if (!newProjectName.trim()) {
      setGenerationError('Please enter a project name first.');
      return;
    }
    setGenerationError('');
    setIsGeneratingDesc(true);
    try {
      const res = await axios.post(`${API_URL}/api/projects/generate-description`, {
        name: newProjectName,
      });
      if (res.data && res.data.description) {
        setNewProjectDesc(res.data.description);
      } else {
        setGenerationError('AI generation returned empty results.');
      }
    } catch (err: any) {
      console.error('Failed to generate description:', err);
      setGenerationError(err.response?.data?.error || 'AI generation failed. Please try again.');
    } finally {
      setIsGeneratingDesc(false);
    }
  };

  // Fetch projects
  const fetchProjects = async () => {
    setLoading(true);
    setApiError(false);
    try {
      const res = await axios.get(`${API_URL}/api/projects`);
      setProjects(res.data);
    } catch (err) {
      console.warn('Failed to fetch projects.');
      setApiError(true);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch dashboard stats
  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/dashboard/stats`);
      setStats(res.data);
    } catch (err) {
      console.warn('Failed to fetch dashboard stats.');
      setStats(emptyStats);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchStats();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    try {
      const res = await axios.post(`${API_URL}/api/projects`, {
        name: newProjectName,
        description: newProjectDesc,
      });
      const created = res.data;
      setProjects([created, ...projects]);
      // Refresh stats after project creation
      fetchStats();
      setNewProjectName('');
      setNewProjectDesc('');
      setShowModal(false);
    } catch (err) {
      console.error('Failed to create project:', err);
    }
  };

  const handleGenerateEditDescriptionWithAI = async () => {
    if (!editProjectName.trim()) {
      setEditGenerationError('Please enter a project name first.');
      return;
    }
    setEditGenerationError('');
    setIsGeneratingEditDesc(true);
    try {
      const res = await axios.post(`${API_URL}/api/projects/generate-description`, {
        name: editProjectName,
      });
      if (res.data && res.data.description) {
        setEditProjectDesc(res.data.description);
      } else {
        setEditGenerationError('AI generation returned empty results.');
      }
    } catch (err: any) {
      console.error('Failed to generate description:', err);
      setEditGenerationError(err.response?.data?.error || 'AI generation failed. Please try again.');
    } finally {
      setIsGeneratingEditDesc(false);
    }
  };

  const handleEditClick = (e: React.MouseEvent, proj: any) => {
    e.stopPropagation();
    e.preventDefault();
    setProjectToEdit(proj);
    setEditProjectName(proj.name);
    setEditProjectDesc(proj.description || '');
    setEditGenerationError('');
    setShowEditModal(true);
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProjectName.trim() || !projectToEdit) return;
    setIsUpdatingProject(true);
    try {
      const res = await axios.put(`${API_URL}/api/projects/${projectToEdit._id}`, {
        name: editProjectName,
        description: editProjectDesc,
      });
      const updated = res.data;
      setProjects(projects.map((p) => (p._id === updated._id ? updated : p)));
      setShowEditModal(false);
      setProjectToEdit(null);
      fetchStats();
    } catch (err) {
      console.error('Failed to update project:', err);
    } finally {
      setIsUpdatingProject(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, proj: any) => {
    e.stopPropagation();
    e.preventDefault();
    setProjectToDelete(proj);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!projectToDelete) return;
    setIsDeletingProject(true);
    try {
      await axios.delete(`${API_URL}/api/projects/${projectToDelete._id}`);
      setProjects(projects.filter((p) => p._id !== projectToDelete._id));
      setShowDeleteModal(false);
      setProjectToDelete(null);
      fetchStats();
    } catch (err) {
      console.error('Failed to delete project:', err);
    } finally {
      setIsDeletingProject(false);
    }
  };

  const StatCard = ({
    label,
    value,
    badge,
    badgeColor,
    icon: Icon,
    loading: isLoading,
  }: {
    label: string;
    value: number;
    badge?: string;
    badgeColor?: string;
    icon: React.ComponentType<any>;
    loading?: boolean;
  }) => (
    <div className="p-5 rounded-xl border border-zinc-800/40 bg-zinc-900/10 backdrop-blur-sm flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500 font-semibold tracking-wider uppercase">{label}</span>
        <Icon className="w-4 h-4 text-zinc-600" />
      </div>
      <div className="flex items-baseline gap-2 mt-3">
        {isLoading ? (
          <div className="h-8 w-10 bg-zinc-800 animate-pulse rounded" />
        ) : (
          <span className="text-3xl font-bold">{value}</span>
        )}
        {badge && !isLoading && (
          <span className={`text-xs font-medium ${badgeColor ?? 'text-zinc-500'}`}>{badge}</span>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-10">

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800/60 pb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Academic Workspace</h1>
            <p className="text-zinc-500 text-sm mt-1">Monitor datasets, references, gaps, and run agent pipelines.</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-5 h-10 rounded-lg bg-indigo-600 text-zinc-100 hover:bg-indigo-500 transition-colors flex items-center gap-2 shadow-lg shadow-indigo-600/10 font-medium text-sm"
          >
            <Plus className="w-4 h-4" /> New Project
          </button>
        </div>

        {/* API Error Banner */}
        {apiError && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-amber-800/50 bg-amber-950/30 text-amber-400 text-sm">
            <span className="font-semibold">⚠ Server Offline</span>
            <span className="text-amber-500">Could not connect to the backend. Make sure the server is running on port 5000.</span>
            <button
              onClick={() => { fetchProjects(); fetchStats(); }}
              className="ml-auto flex items-center gap-1 text-xs text-amber-400 hover:text-amber-200 transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard label="Projects"       value={stats.projects}      icon={FolderPlus}  loading={statsLoading} />
          <StatCard label="Papers"         value={stats.papers}        icon={FileText}    loading={statsLoading} />
          <StatCard label="Citations"      value={stats.citations}     icon={BookOpen}    loading={statsLoading} />
          <StatCard label="Research Gaps"  value={stats.researchGaps}  icon={Layers}      loading={statsLoading} />
          <StatCard
            label="Agent Runs"
            value={stats.agentRuns}
            icon={Cpu}
            loading={statsLoading}
            badge={stats.activeAgents > 0 ? `${stats.activeAgents} active` : undefined}
            badgeColor="text-indigo-400"
          />
          <StatCard label="Manuscripts"    value={stats.manuscripts}   icon={BookMarked}  loading={statsLoading} />
        </div>

        {/* Chart Area */}
        <div className="p-6 rounded-xl border border-zinc-800/40 bg-zinc-900/10 backdrop-blur-sm space-y-6">
          <div>
            <h3 className="font-semibold text-base">Workspace Progress</h3>
            <p className="text-xs text-zinc-500 mt-1">Cumulative growth of uploaded papers and citations over time.</p>
          </div>
          <div className="h-[250px] w-full">
            {statsLoading ? (
              <div className="h-full flex items-center justify-center text-zinc-600 gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" /> Loading trend data...
              </div>
            ) : stats.trend.length === 0 ? (
              <div className="h-full flex items-center justify-center text-zinc-600 text-sm">
                No trend data yet. Upload papers to start tracking progress.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.trend}>
                  <defs>
                    <linearGradient id="colorPapers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorCitations" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                    labelStyle={{ color: '#a1a1aa' }}
                  />
                  <Area type="monotone" dataKey="papers"    name="Uploaded Papers"      stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorPapers)" />
                  <Area type="monotone" dataKey="citations" name="Formatted References"  stroke="#14b8a6" strokeWidth={2} fillOpacity={1} fill="url(#colorCitations)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Projects Listing */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Recent Research Projects</h2>
            {!loading && projects.length > 0 && (
              <button
                onClick={() => { fetchProjects(); fetchStats(); }}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            )}
          </div>

          {loading ? (
            <div className="py-20 flex items-center justify-center gap-2 text-zinc-500">
              <RefreshCw className="w-5 h-5 animate-spin" /> Loading projects...
            </div>
          ) : projects.length === 0 ? (
            <div className="py-20 border border-dashed border-zinc-800/80 rounded-xl text-center flex flex-col items-center justify-center gap-2">
              <FolderPlus className="w-10 h-10 text-zinc-600 mb-2" />
              <p className="text-zinc-400 font-medium">No projects found</p>
              <p className="text-zinc-600 text-xs">
                {apiError
                  ? 'Could not load projects — please ensure the server is running.'
                  : 'Create your first research project workspace above.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {projects.map((proj) => (
                <motion.div
                  key={proj._id}
                  onClick={() => router.push(`/projects/${proj._id}`)}
                  whileHover={{ scale: 1.01, borderColor: '#3f3f46' }}
                  className="p-6 rounded-xl border border-zinc-800/50 bg-zinc-900/10 hover:bg-zinc-900/20 backdrop-blur-sm cursor-pointer transition-all flex justify-between items-center group"
                >
                  <div className="space-y-2 max-w-[70%] sm:max-w-[75%] md:max-w-[80%]">
                    <h3 className="font-semibold text-lg text-zinc-200 group-hover:text-zinc-100 transition-colors flex items-center gap-2">
                      {proj.name}
                    </h3>
                    <p className="text-sm text-zinc-500 line-clamp-2 leading-relaxed">
                      {proj.description || 'No description provided.'}
                    </p>
                    <span className="inline-block text-[11px] text-zinc-600">
                      Created {new Date(proj.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleEditClick(e, proj)}
                      title="Edit Project"
                      className="p-2 rounded-lg text-zinc-500 hover:text-indigo-400 hover:bg-zinc-800/60 transition-colors animate-fade-in"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteClick(e, proj)}
                      title="Delete Project"
                      className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-950/30 transition-colors animate-fade-in"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <ChevronRight className="w-5 h-5 text-zinc-650 group-hover:text-zinc-300 transition-colors ml-1" />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Project Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl space-y-6"
          >
            <div>
              <h3 className="text-lg font-bold">Create Research Project</h3>
              <p className="text-xs text-zinc-500 mt-1">Specify parameters for your new research workspace.</p>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400">Project Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. LLM Multi-Agent Orchestrations"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full h-10 px-3 bg-zinc-950 border border-zinc-800 rounded-lg text-sm outline-none focus:border-indigo-500 text-zinc-200"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-400">Description</label>
                  <button
                    type="button"
                    onClick={handleGenerateDescriptionWithAI}
                    disabled={isGeneratingDesc}
                    className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 disabled:text-zinc-650 flex items-center gap-1 transition-colors"
                  >
                    {isGeneratingDesc ? (
                      <>
                        <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Generating...
                      </>
                    ) : (
                      '✨ Generate with AI'
                    )}
                  </button>
                </div>
                <textarea
                  rows={3}
                  placeholder="Summarize research scope, variables, and models... (Leave blank to generate automatically on create)"
                  value={newProjectDesc}
                  onChange={(e) => {
                    setNewProjectDesc(e.target.value);
                    if (generationError) setGenerationError('');
                  }}
                  className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-sm outline-none focus:border-indigo-500 text-zinc-200"
                />
                {generationError && (
                  <p className="text-[10px] text-red-400 mt-1">{generationError}</p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 h-9 rounded-lg hover:bg-zinc-800 text-zinc-400 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 h-9 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-zinc-100 font-semibold text-sm transition-colors"
                >
                  Create
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Edit Project Modal */}
      {showEditModal && projectToEdit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl space-y-6"
          >
            <div>
              <h3 className="text-lg font-bold">Edit Research Project</h3>
              <p className="text-xs text-zinc-500 mt-1">Update parameters for your research workspace.</p>
            </div>

            <form onSubmit={handleUpdateProject} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400">Project Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. LLM Multi-Agent Orchestrations"
                  value={editProjectName}
                  onChange={(e) => setEditProjectName(e.target.value)}
                  className="w-full h-10 px-3 bg-zinc-950 border border-zinc-800 rounded-lg text-sm outline-none focus:border-indigo-500 text-zinc-200"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-400">Description</label>
                  <button
                    type="button"
                    onClick={handleGenerateEditDescriptionWithAI}
                    disabled={isGeneratingEditDesc}
                    className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 disabled:text-zinc-650 flex items-center gap-1 transition-colors"
                  >
                    {isGeneratingEditDesc ? (
                      <>
                        <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Generating...
                      </>
                    ) : (
                      '✨ Generate with AI'
                    )}
                  </button>
                </div>
                <textarea
                  rows={3}
                  placeholder="Summarize research scope, variables, and models... (Leave blank to generate automatically on update)"
                  value={editProjectDesc}
                  onChange={(e) => {
                    setEditProjectDesc(e.target.value);
                    if (editGenerationError) setEditGenerationError('');
                  }}
                  className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-sm outline-none focus:border-indigo-500 text-zinc-200"
                />
                {editGenerationError && (
                  <p className="text-[10px] text-red-400 mt-1">{editGenerationError}</p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setProjectToEdit(null);
                  }}
                  className="px-4 h-9 rounded-lg hover:bg-zinc-800 text-zinc-400 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingProject}
                  className="px-5 h-9 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-zinc-100 font-semibold text-sm transition-colors flex items-center gap-2"
                >
                  {isUpdatingProject && <RefreshCw className="w-3 h-3 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Delete Project Confirmation Modal */}
      {showDeleteModal && projectToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl space-y-6"
          >
            <div>
              <h3 className="text-lg font-bold text-red-400">Delete Research Project?</h3>
              <p className="text-xs text-zinc-500 mt-1">This action cannot be undone.</p>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-zinc-300 leading-relaxed">
                Are you sure you want to delete <span className="font-semibold text-zinc-100">"{projectToDelete.name}"</span>?
              </p>
              <div className="p-3.5 rounded-lg border border-red-950/40 bg-red-950/10 text-xs text-red-400 space-y-1.5">
                <p className="font-semibold">Permanently deletes associated data:</p>
                <ul className="list-disc list-inside space-y-1 opacity-90">
                  <li>Papers & references</li>
                  <li>Formatted citations</li>
                  <li>Identified research gaps</li>
                  <li>Agent pipelines & logs</li>
                  <li>Manuscript drafts & outline</li>
                  <li>Knowledge graphs & notes</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setProjectToDelete(null);
                }}
                className="px-4 h-9 rounded-lg hover:bg-zinc-800 text-zinc-400 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeletingProject}
                className="px-5 h-9 rounded-lg bg-red-600 hover:bg-red-500 disabled:bg-red-800 text-zinc-100 font-semibold text-sm transition-colors flex items-center gap-2"
              >
                {isDeletingProject && <RefreshCw className="w-3 h-3 animate-spin" />}
                Delete Project
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
