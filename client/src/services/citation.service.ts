import axios from 'axios';
import { getApiUrl } from '../utils/apiUrl';

export const citationService = {
  async getCitations(projectId: string) {
    const res = await axios.get(`${getApiUrl()}/api/citations?projectId=${projectId}`);
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
    const res = await axios.post(`${getApiUrl()}/api/citations`, data);
    return res.data;
  },

  async deleteCitation(citationId: string) {
    const res = await axios.delete(`${getApiUrl()}/api/citations/${citationId}`);
    return res.data;
  }
};
