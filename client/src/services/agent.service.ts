import axios from 'axios';
import { getApiUrl } from '../utils/apiUrl';

export const agentService = {
  async getAgentRuns(projectId: string) {
    const res = await axios.get(`${getApiUrl()}/api/agents?projectId=${projectId}`);
    return res.data;
  },

  async triggerAgentRun(projectId: string, query: string) {
    const res = await axios.post(`${getApiUrl()}/api/agents/run`, { projectId, query });
    return res.data;
  },

  async getAgentRunStatus(runId: string) {
    const res = await axios.get(`${getApiUrl()}/api/agents/${runId}`);
    return res.data;
  }
};
