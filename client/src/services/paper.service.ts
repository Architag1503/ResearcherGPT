import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const paperService = {
  async getPapers(projectId: string) {
    const res = await axios.get(`${API_URL}/api/papers?projectId=${projectId}`);
    return res.data;
  },

  async getPaper(paperId: string) {
    const res = await axios.get(`${API_URL}/api/papers/${paperId}`);
    return res.data;
  },

  async deletePaper(paperId: string) {
    const res = await axios.delete(`${API_URL}/api/papers/${paperId}`);
    return res.data;
  },

  async uploadPaper(projectId: string, file: File) {
    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('projectId', projectId);
    const res = await axios.post(`${API_URL}/api/papers/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  }
};
