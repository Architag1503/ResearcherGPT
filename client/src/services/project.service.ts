import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const projectService = {
  async getProjects() {
    const res = await axios.get(`${API_URL}/api/projects`);
    return res.data;
  },

  async getProject(projectId: string) {
    const res = await axios.get(`${API_URL}/api/projects/${projectId}`);
    return res.data;
  },

  async createProject(name: string, description?: string) {
    const res = await axios.post(`${API_URL}/api/projects`, { name, description });
    return res.data;
  },

  async deleteProject(projectId: string) {
    const res = await axios.delete(`${API_URL}/api/projects/${projectId}`);
    return res.data;
  },

  async triggerGraphUpdate(projectId: string) {
    const res = await axios.post(`${API_URL}/api/projects/${projectId}/graph`);
    return res.data;
  }
};
