import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const citationService = {
  async getCitations(projectId: string) {
    const res = await axios.get(`${API_URL}/api/citations?projectId=${projectId}`);
    return res.data;
  },

  async createCitation(data: {
    projectId: string;
    doi?: string;
    title?: string;
    authors?: string[];
    journal?: string;
    year?: number;
  }) {
    const res = await axios.post(`${API_URL}/api/citations`, data);
    return res.data;
  },

  async deleteCitation(citationId: string) {
    const res = await axios.delete(`${API_URL}/api/citations/${citationId}`);
    return res.data;
  }
};
