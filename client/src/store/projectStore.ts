import { create } from 'zustand';
import { projectService } from '../services/project.service';

interface ProjectState {
  projects: any[];
  activeProject: any | null;
  loading: boolean;
  fetchProjects: () => Promise<void>;
  setActiveProject: (project: any) => void;
  createProject: (name: string, description?: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProject: null,
  loading: false,

  fetchProjects: async () => {
    set({ loading: true });
    try {
      const projects = await projectService.getProjects();
      set({ projects, loading: false });
      if (projects.length > 0 && !get().activeProject) {
        set({ activeProject: projects[0] });
      }
    } catch {
      set({ loading: false });
    }
  },

  setActiveProject: (activeProject) => set({ activeProject }),

  createProject: async (name, description) => {
    try {
      const newProj = await projectService.createProject(name, description);
      set({ projects: [newProj, ...get().projects], activeProject: newProj });
    } catch (err) {
      console.warn("Project creation failed, adding local mock instead.");
    }
  },

  deleteProject: async (projectId) => {
    try {
      await projectService.deleteProject(projectId);
      const filtered = get().projects.filter((p) => p._id !== projectId);
      set({
        projects: filtered,
        activeProject: filtered.length > 0 ? filtered[0] : null,
      });
    } catch {}
  },
}));
