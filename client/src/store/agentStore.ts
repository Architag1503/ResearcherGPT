import { create } from 'zustand';
import { agentService } from '../services/agent.service';

interface AgentState {
  runs: any[];
  activeRun: any | null;
  loading: boolean;
  fetchRuns: (projectId: string) => Promise<void>;
  triggerRun: (projectId: string, query: string) => Promise<void>;
  fetchRunStatus: (runId: string) => Promise<void>;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  runs: [],
  activeRun: null,
  loading: false,

  fetchRuns: async (projectId) => {
    set({ loading: true });
    try {
      const runs = await agentService.getAgentRuns(projectId);
      set({ runs, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  triggerRun: async (projectId, query) => {
    try {
      const run = await agentService.triggerAgentRun(projectId, query);
      set({ runs: [run, ...get().runs], activeRun: run });
    } catch {}
  },

  fetchRunStatus: async (runId) => {
    try {
      const activeRun = await agentService.getAgentRunStatus(runId);
      set({ activeRun });
      // Update in runs list
      set({
        runs: get().runs.map((r) => (r._id === runId ? activeRun : r)),
      });
    } catch {}
  },
}));
