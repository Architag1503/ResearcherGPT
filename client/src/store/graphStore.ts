import { create } from 'zustand';
import { graphService } from '../services/graph.service';

interface GraphState {
  nodes: any[];
  links: any[];
  comparison: { columns: string[]; rows: any[] };
  loading: boolean;
  fetchGraph: (projectId: string) => Promise<void>;
  fetchComparison: (projectId: string) => Promise<void>;
}

export const useGraphStore = create<GraphState>((set) => ({
  nodes: [],
  links: [],
  comparison: { columns: [], rows: [] },
  loading: false,

  fetchGraph: async (projectId) => {
    set({ loading: true });
    try {
      const data = await graphService.getKnowledgeGraph(projectId);
      set({
        nodes: data.nodes || [],
        links: data.links || [],
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  fetchComparison: async (projectId) => {
    try {
      const comparison = await graphService.getComparisonMatrix(projectId);
      set({ comparison });
    } catch {}
  },
}));
