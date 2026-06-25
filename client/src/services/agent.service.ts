import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const agentService = {
  async getAgentRuns(projectId: string) {
    const res = await axios.get(`${API_URL}/api/agents?projectId=${projectId}`);
    return res.data;
  },

  async triggerAgentRun(projectId: string, query: string) {
    const res = await axios.post(`${API_URL}/api/agents/run`, { projectId, query });
    return res.data;
  },

  async getAgentRunStatus(runId: string) {
    const res = await axios.get(`${API_URL}/api/agents/${runId}`);
    return res.data;
  }
};
