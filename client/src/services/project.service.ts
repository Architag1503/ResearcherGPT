import axios from 'axios';
import { getApiUrl } from '../utils/apiUrl';

export const projectService = {
  async getProjects() {
    const res = await axios.get(`${getApiUrl()}/api/projects`);
    return res.data;
  },

  async getProject(projectId: string) {
    const res = await axios.get(`${getApiUrl()}/api/projects/${projectId}`);
    return res.data;
  },

  async createProject(name: string, description?: string) {
    const res = await axios.post(`${getApiUrl()}/api/projects`, { name, description });
    return res.data;
  },

  async deleteProject(projectId: string) {
    const res = await axios.delete(`${getApiUrl()}/api/projects/${projectId}`);
    return res.data;
  },

  async triggerGraphUpdate(projectId: string) {
    const res = await axios.post(`${getApiUrl()}/api/projects/${projectId}/graph`);
    return res.data;
  }
};
