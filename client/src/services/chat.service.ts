import axios from 'axios';
import { getApiUrl } from '../utils/apiUrl';

export const chatService = {
  async getSessions(projectId: string) {
    const res = await axios.get(`${getApiUrl()}/api/chat/sessions?projectId=${projectId}`);
    return res.data;
  },

  async createSession(projectId: string, title?: string) {
    const res = await axios.post(`${getApiUrl()}/api/chat/sessions`, { projectId, title });
    return res.data;
  },

  async getMessages(sessionId: string) {
    const res = await axios.get(`${getApiUrl()}/api/chat/sessions/${sessionId}/messages`);
    return res.data;
  }
};
