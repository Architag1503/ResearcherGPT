import { create } from 'zustand';
import { citationService } from '../services/citation.service';

interface CitationState {
  citations: any[];
  loading: boolean;
  fetchCitations: (projectId: string) => Promise<void>;
  addCitation: (data: any) => Promise<void>;
  removeCitation: (citationId: string) => Promise<void>;
}

export const useCitationStore = create<CitationState>((set, get) => ({
  citations: [],
  loading: false,

  fetchCitations: async (projectId) => {
    set({ loading: true });
    try {
      const citations = await citationService.getCitations(projectId);
      set({ citations, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  addCitation: async (data) => {
    try {
      const cite = await citationService.createCitation(data);
      set({ citations: [cite, ...get().citations] });
    } catch {}
  },

  removeCitation: async (citationId) => {
    try {
      await citationService.deleteCitation(citationId);
      set({ citations: get().citations.filter((c) => c._id !== citationId) });
    } catch {}
  },
}));
