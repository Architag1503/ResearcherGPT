import axios from 'axios';
import { getApiUrl } from '../utils/apiUrl';

export const graphService = {
  async getKnowledgeGraph(projectId: string) {
    // Falls back to Express projects fetch
    const res = await axios.get(`${getApiUrl()}/api/projects/${projectId}`);
    return res.data;
  },
  
  async getComparisonMatrix(projectId: string) {
    const res = await axios.get(`${getApiUrl()}/api/comparison/matrix?projectId=${projectId}`);
    return res.data;
  }
};
