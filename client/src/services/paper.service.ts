import axios from 'axios';
import { getApiUrl } from '../utils/apiUrl';

export const paperService = {
  async getPapers(projectId: string) {
    const res = await axios.get(`${getApiUrl()}/api/papers?projectId=${projectId}`);
    return res.data;
  },

  async getPaper(paperId: string) {
    const res = await axios.get(`${getApiUrl()}/api/papers/${paperId}`);
    return res.data;
  },

  async deletePaper(paperId: string) {
    const res = await axios.delete(`${getApiUrl()}/api/papers/${paperId}`);
    return res.data;
  },

  async uploadPaper(projectId: string, file: File) {
    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('projectId', projectId);
    const res = await axios.post(`${getApiUrl()}/api/papers/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  }
};
