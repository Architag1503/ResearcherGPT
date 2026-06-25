import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const graphService = {
  async getKnowledgeGraph(projectId: string) {
    // Falls back to Express projects fetch
    const res = await axios.get(`${API_URL}/api/projects/${projectId}`);
    return res.data;
  },
  
  async getComparisonMatrix(projectId: string) {
    const res = await axios.get(`${API_URL}/api/comparison/matrix?projectId=${projectId}`);
    return res.data;
  }
};
