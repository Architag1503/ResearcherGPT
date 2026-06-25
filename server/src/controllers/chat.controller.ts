import { Request, Response } from 'express';
import axios from 'axios';
import ChatSession from '../models/ChatSession.js';
import Message from '../models/Message.js';
import Paper from '../models/Paper.js';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

export const createSession = async (req: Request, res: Response) => {
  try {
    const { projectId, title } = req.body;
    const session = new ChatSession({
      projectId,
      title: title || 'New Chat Session',
    });
    await session.save();
    return res.status(201).json(session);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const getSessions = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }
    const sessions = await ChatSession.find({ projectId }).sort({ createdAt: -1 });
    return res.status(200).json(sessions);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const getMessages = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const messages = await Message.find({ chatSessionId: sessionId }).sort({ createdAt: 1 });
    return res.status(200).json(messages);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const sendMessage = async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Message content is required' });
  }

  try {
    const session = await ChatSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Chat session not found' });
    }

    // 1. Save user message in DB
    const userMessage = new Message({
      chatSessionId: sessionId,
      role: 'user',
      content,
      sources: [],
    });
    await userMessage.save();

    // 2. Setup Server-Sent Events headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Send user message details back to frontend first
    res.write(`data: ${JSON.stringify({ type: 'user_message', message: userMessage })}\n\n`);

    // 3. Request streaming response from FastAPI AI service
    const aiResponse = await axios({
      method: 'post',
      url: `${AI_SERVICE_URL}/api/chat/stream`,
      data: {
        query: content,
        project_id: session.projectId,
        session_id: sessionId,
      },
      responseType: 'stream',
    });

    let assistantReply = '';
    let sources: any[] = [];

    // 4. Pipe streaming response from Python service to frontend
    aiResponse.data.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      // Inspect for sources metadata if sent in a custom line format
      // Typically FastAPI sends structured SSE logs or simple text chunks
      res.write(chunk);

      // Simple parser to reconstruct the assistant reply text
      // In production, parsing the event-stream format:
      // event: message \n data: "..."
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.type === 'token') {
              assistantReply += parsed.token;
            } else if (parsed.type === 'sources') {
              sources = parsed.sources;
            }
          } catch {
            // If it is just plain token text
            assistantReply += line.slice(6);
          }
        }
      }
    });

    aiResponse.data.on('end', async () => {
      // 5. Save Assistant reply with sources once stream completes
      const assistantMessage = new Message({
        chatSessionId: sessionId,
        role: 'assistant',
        content: assistantReply.trim() || 'No response generated.',
        sources: sources.map((s: any) => ({
          paperId: s.paper_id,
          paperTitle: s.title || 'Source Paper',
          pageNumber: s.page_number,
          textContent: s.text_content || s.snippet || '',
          confidenceScore: s.confidence_score || 0.8,
        })),
      });

      await assistantMessage.save();

      // Send final message payload with sources
      res.write(`data: ${JSON.stringify({ type: 'done', message: assistantMessage })}\n\n`);
      res.end();
    });

    aiResponse.data.on('error', (err: any) => {
      console.error('[sendMessage] Streaming error:', err);
      res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
      res.end();
    });
  } catch (error: any) {
    console.error('[sendMessage] Failed to send message:', error.message);
    return res.status(500).json({ error: error.message });
  }
};

export const updateSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    const session = await ChatSession.findByIdAndUpdate(
      sessionId,
      { title },
      { new: true }
    );
    if (!session) {
      return res.status(404).json({ error: 'Chat session not found' });
    }
    return res.status(200).json(session);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const deleteSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = await ChatSession.findByIdAndDelete(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Chat session not found' });
    }
    // Delete all messages associated with the session
    await Message.deleteMany({ chatSessionId: sessionId });
    return res.status(200).json({ message: 'Chat session and messages deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

