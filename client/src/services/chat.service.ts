import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const chatService = {
  async getSessions(projectId: string) {
    const res = await axios.get(`${API_URL}/api/chat/sessions?projectId=${projectId}`);
    return res.data;
  },

  async createSession(projectId: string, title?: string) {
    const res = await axios.post(`${API_URL}/api/chat/sessions`, { projectId, title });
    return res.data;
  },

  async getMessages(sessionId: string) {
    const res = await axios.get(`${API_URL}/api/chat/sessions/${sessionId}/messages`);
    return res.data;
  }
};
