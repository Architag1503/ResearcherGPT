import { create } from 'zustand';
import { chatService } from '../services/chat.service';

interface ChatState {
  sessions: any[];
  messages: any[];
  activeSessionId: string | null;
  loading: boolean;
  fetchSessions: (projectId: string) => Promise<void>;
  createSession: (projectId: string, title?: string) => Promise<void>;
  fetchMessages: (sessionId: string) => Promise<void>;
  setMessages: (messages: any[]) => void;
  setActiveSessionId: (id: string | null) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  messages: [],
  activeSessionId: null,
  loading: false,

  fetchSessions: async (projectId) => {
    set({ loading: true });
    try {
      const sessions = await chatService.getSessions(projectId);
      set({ sessions, loading: false });
      if (sessions.length > 0) {
        set({ activeSessionId: sessions[0]._id });
        get().fetchMessages(sessions[0]._id);
      }
    } catch {
      set({ loading: false });
    }
  },

  createSession: async (projectId, title) => {
    try {
      const sess = await chatService.createSession(projectId, title);
      set({
        sessions: [sess, ...get().sessions],
        activeSessionId: sess._id,
        messages: [],
      });
    } catch {}
  },

  fetchMessages: async (sessionId) => {
    try {
      const messages = await chatService.getMessages(sessionId);
      set({ messages });
    } catch {}
  },

  setMessages: (messages) => set({ messages }),
  setActiveSessionId: (activeSessionId) => set({ activeSessionId }),
}));
