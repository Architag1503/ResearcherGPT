'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Send, 
  Sparkles, 
  AlertCircle, 
  FileText, 
  ChevronRight, 
  Plus, 
  MessageSquare, 
  Trash2, 
  Edit2, 
  PanelLeftClose, 
  PanelLeftOpen, 
  Check, 
  X,
  FileCode,
  LayoutGrid,
  FileEdit,
  Image,
  RefreshCw,
  Info
} from 'lucide-react';
import TipTapEditor from './TipTapEditor';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface Message {
  _id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: any[];
}

interface ChatWindowProps {
  projectId: string;
}

interface PaperSection {
  title: string;
  heading: string;
  content: string;
}

export default function ChatWindow({ projectId }: ChatWindowProps) {
  // Chat & History states
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streamingMessage, setStreamingMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleInput, setEditTitleInput] = useState('');

  // Paper Selection & Editing states
  const [manuscripts, setManuscripts] = useState<any[]>([]);
  const [uploadedPapers, setUploadedPapers] = useState<any[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>('none');
  const [selectedDocType, setSelectedDocType] = useState<'generated' | 'pdf' | 'none'>('none');
  
  // Manuscript working draft states
  const [activeSectionIdx, setActiveSectionIdx] = useState<number>(0);
  const [currentDocTitle, setCurrentDocTitle] = useState<string>('');
  const [currentDocSections, setCurrentDocSections] = useState<PaperSection[]>([]);
  const [currentDocReferences, setCurrentDocReferences] = useState<string[]>([]);
  const [currentDocOutline, setCurrentDocOutline] = useState<string[]>([]);
  const [originalDoc, setOriginalDoc] = useState<{ title: string; sections: PaperSection[]; references: string[]; outline: string[] } | null>(null);
  const [isModified, setIsModified] = useState<boolean>(false);
  const [formattingLoad, setFormattingLoad] = useState<boolean>(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  // 1. Load Sessions
  const loadSessions = async (selectLatest = false) => {
    try {
      const res = await axios.get(`${API_URL}/api/chat/sessions?projectId=${projectId}`);
      setSessions(res.data);
      if (res.data.length > 0) {
        if (selectLatest) {
          setActiveSession(res.data[0]._id);
        } else {
          setActiveSession((prev) => {
            const stillExists = res.data.some((s: any) => s._id === prev);
            return stillExists ? prev : res.data[0]._id;
          });
        }
      } else {
        // Create a default session
        const newSess = await axios.post(`${API_URL}/api/chat/sessions`, {
          projectId,
          title: 'General RAG Chat'
        });
        setSessions([newSess.data]);
        setActiveSession(newSess.data._id);
      }
    } catch (err) {
      console.warn("Failed to load chat sessions. Using local fallback.");
      setSessions([{ _id: 'mock_session', title: 'Developer Fallback Session' }]);
      setActiveSession('mock_session');
    }
  };

  // 2. Fetch Workspace Documents
  const loadWorkspaceDocuments = async () => {
    try {
      // Fetch generated manuscripts
      const manuscriptsRes = await axios.get(`${API_URL}/api/projects/${projectId}/generated-papers`);
      setManuscripts(manuscriptsRes.data);

      // Fetch uploaded papers
      const uploadedRes = await axios.get(`${API_URL}/api/papers?projectId=${projectId}`);
      setUploadedPapers(uploadedRes.data);
    } catch (err) {
      console.warn("Failed to load workspace documents:", err);
    }
  };

  useEffect(() => {
    loadSessions(true);
    loadWorkspaceDocuments();
  }, [projectId]);

  // 3. Fetch messages for active session
  useEffect(() => {
    if (!activeSession) return;
    const loadMessages = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/chat/sessions/${activeSession}/messages`);
        setMessages(res.data);
      } catch (err) {
        setMessages([
          { _id: 'm1', role: 'assistant', content: 'Hello! Upload papers to your workspace and ask questions. I will reply with verifiable sources from your library.' }
        ]);
      }
    };
    loadMessages();
  }, [activeSession]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage]);

  // Handle document selection change
  const handleDocSelectionChange = (value: string) => {
    if (isModified) {
      if (!confirm("You have unsaved changes on the current manuscript. Switch anyway? (Changes will be lost)")) {
        return;
      }
    }

    setIsModified(false);
    setSelectedDocId(value);

    if (value === 'none') {
      setSelectedDocType('none');
      setOriginalDoc(null);
      return;
    }

    if (value.startsWith('gen:')) {
      const pId = value.replace('gen:', '');
      setSelectedDocType('generated');
      const targetPaper = manuscripts.find((p) => p._id === pId);
      if (targetPaper) {
        const paperBackup = {
          title: targetPaper.title,
          sections: JSON.parse(JSON.stringify(targetPaper.sections || [])),
          references: targetPaper.references || [],
          outline: targetPaper.outline || [],
        };
        setCurrentDocTitle(targetPaper.title);
        setCurrentDocSections(paperBackup.sections);
        setCurrentDocReferences(paperBackup.references);
        setCurrentDocOutline(paperBackup.outline);
        setOriginalDoc(paperBackup);
        setActiveSectionIdx(0);
      }
    } else if (value.startsWith('pdf:')) {
      setSelectedDocType('pdf');
      setOriginalDoc(null);
    }
  };

  // Create a new session
  const handleCreateSession = async () => {
    if (loading) return;
    try {
      const res = await axios.post(`${API_URL}/api/chat/sessions`, {
        projectId,
        title: `Chat Session ${sessions.length + 1}`
      });
      setSessions((prev) => [res.data, ...prev]);
      setActiveSession(res.data._id);
      setMessages([]);
    } catch (err) {
      console.error("Failed to create session:", err);
    }
  };

  // Rename a session
  const handleRenameSession = async (sessId: string, newTitle: string) => {
    if (!newTitle.trim()) {
      setEditingSessionId(null);
      return;
    }
    try {
      const res = await axios.put(`${API_URL}/api/chat/sessions/${sessId}`, {
        title: newTitle.trim()
      });
      setSessions((prev) =>
        prev.map((s) => (s._id === sessId ? { ...s, title: res.data.title } : s))
      );
      setEditingSessionId(null);
    } catch (err) {
      console.error("Failed to rename session:", err);
      setEditingSessionId(null);
    }
  };

  // Delete a session
  const handleDeleteSession = async (sessId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this chat session?")) {
      try {
        await axios.delete(`${API_URL}/api/chat/sessions/${sessId}`);
        const updated = sessions.filter((s) => s._id !== sessId);
        setSessions(updated);
        
        if (activeSession === sessId) {
          if (updated.length > 0) {
            setActiveSession(updated[0]._id);
          } else {
            // Create a default session if all deleted
            const newSess = await axios.post(`${API_URL}/api/chat/sessions`, {
              projectId,
              title: 'General RAG Chat'
            });
            setSessions([newSess.data]);
            setActiveSession(newSess.data._id);
          }
        }
      } catch (err) {
        console.error("Failed to delete session:", err);
      }
    }
  };

  // Handle active section change in TipTap editor
  const handleSectionContentChange = (idx: number, htmlContent: string) => {
    if (currentDocSections[idx].content === htmlContent) return;
    
    setIsModified(true);
    setCurrentDocSections((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], content: htmlContent };
      return copy;
    });
  };

  // Update paper title
  const handleTitleChange = (newTitle: string) => {
    if (currentDocTitle === newTitle) return;
    setIsModified(true);
    setCurrentDocTitle(newTitle);
  };

  // Save changes to backend database
  const handleSaveChanges = async () => {
    if (selectedDocId === 'none' || selectedDocType !== 'generated') return;
    const pId = selectedDocId.replace('gen:', '');
    
    try {
      await axios.put(`${API_URL}/api/projects/${projectId}/generated-papers`, {
        paperId: pId,
        title: currentDocTitle,
        sections: currentDocSections,
        references: currentDocReferences,
        outline: currentDocSections.map((s) => s.title),
      });
      setIsModified(false);
      
      // Refresh local document listing
      loadWorkspaceDocuments();
    } catch (err) {
      console.error("Failed to save changes:", err);
      alert("Error saving manuscript changes. Please try again.");
    }
  };

  // Discard changes
  const handleDiscardChanges = () => {
    if (!originalDoc) return;
    setCurrentDocTitle(originalDoc.title);
    setCurrentDocSections(JSON.parse(JSON.stringify(originalDoc.sections)));
    setCurrentDocReferences(originalDoc.references);
    setCurrentDocOutline(originalDoc.outline);
    setIsModified(false);
  };

  // Quick Action: Auto Correct & Format using FormaTeX auto-correct API
  const handleFormaTexAutoCorrect = async () => {
    if (currentDocSections.length === 0) return;
    setFormattingLoad(true);
    try {
      const activeSection = currentDocSections[activeSectionIdx];
      
      // Call actual auto-correct backend wrapper
      const formatRes = await axios.post(`${API_URL}/api/formatex/auto-correct`, {
        htmlContent: activeSection.content,
      });

      if (formatRes.data && formatRes.data.success) {
        handleSectionContentChange(activeSectionIdx, formatRes.data.htmlContent);
      }
    } catch (err) {
      console.error("Auto-correct formatting failed:", err);
    } finally {
      setFormattingLoad(false);
    }
  };

  // Quick Action: Insert AI Diagram Template
  const handleInsertDiagram = () => {
    const diagramHTML = `
      <div class="my-6 p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 font-mono text-[10px] text-zinc-400 shadow-md">
        <div class="text-[11px] font-bold text-indigo-400 mb-2 border-b border-zinc-800 pb-1 uppercase tracking-wider flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"></span> AI Methodology Pipeline Schematic
        </div>
        <pre class="leading-relaxed">
  [Raw Academic PDFs] ➔ [PDF Parser Engine] ➔ [Text Chunking Algorithm]
                                                   │
                                                   ▼
  [Cosine Reranking] 🠜 [Dense Embeddings Model] 🠜 [Qdrant Vector DB]
         │
         ▼
  [LLM Context Prompt] ➔ [Structured RAG Output & Citations]
        </pre>
      </div>
    `;
    const updatedContent = currentDocSections[activeSectionIdx].content + diagramHTML;
    handleSectionContentChange(activeSectionIdx, updatedContent);
  };

  // Quick Action: Insert AI Illustration Block
  const handleInsertImage = () => {
    const imageHTML = `
      <figure class="my-6 p-4 rounded-xl border border-zinc-850 bg-zinc-900/40 text-center">
        <div class="w-full h-32 rounded-lg bg-gradient-to-tr from-indigo-950 via-zinc-950 to-purple-950 flex flex-col items-center justify-center border border-indigo-500/20 relative overflow-hidden">
          <div class="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.15),transparent_60%)]"></div>
          <span class="text-[10px] font-semibold text-indigo-300 tracking-widest uppercase relative z-10 flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span> AI MODEL REPRESENTATION
          </span>
          <span class="text-[9px] text-zinc-500 mt-1 relative z-10 font-mono">Projection Vector Space Alignment</span>
        </div>
        <figcaption class="text-[10px] text-zinc-500 mt-2 italic">Figure: Latent semantic mapping of document embeddings and queries.</figcaption>
      </figure>
    `;
    const updatedContent = currentDocSections[activeSectionIdx].content + imageHTML;
    handleSectionContentChange(activeSectionIdx, updatedContent);
  };

  // Apply AI assistant response to active section
  const handleApplyToActiveSection = (text: string) => {
    if (selectedDocType !== 'generated' || currentDocSections.length === 0) return;
    
    // Convert newlines to paragraphs for basic HTML compatibility
    const paragraphs = text
      .split('\n\n')
      .map((p) => `<p>${p.replace(/\n/g, '<br />')}</p>`)
      .join('');
      
    const currentContent = currentDocSections[activeSectionIdx].content;
    const combined = currentContent + `<div class="p-3 my-4 bg-zinc-900/50 border border-zinc-800 rounded-lg text-xs leading-relaxed text-zinc-350">${paragraphs}</div>`;
    handleSectionContentChange(activeSectionIdx, combined);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || !activeSession) return;

    // Enhance prompt if editing a manuscript section
    let queryText = input;
    if (selectedDocType === 'generated' && currentDocSections.length > 0) {
      const activeSecName = currentDocSections[activeSectionIdx].title;
      queryText = `Regarding the research section "${activeSecName}" in the paper "${currentDocTitle}": ${input}`;
    }

    setInput('');
    setLoading(true);
    setStreamingMessage('');

    // Append user message immediately
    const tempUserMsg: Message = { _id: Date.now().toString(), role: 'user', content: input };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const response = await fetch(`${API_URL}/api/chat/sessions/${activeSession}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: queryText }),
      });

      if (!response.body) {
        throw new Error('ReadableStream not supported by gateway.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let accumulatedText = '';
      let finalMessageObj: any = null;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunkStr = decoder.decode(value);
          const lines = chunkStr.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(line.slice(6));
                if (parsed.type === 'token') {
                  accumulatedText += parsed.token;
                  setStreamingMessage(accumulatedText);
                } else if (parsed.type === 'done') {
                  finalMessageObj = parsed.message;
                }
              } catch {
                // If simple text payload fallback
                accumulatedText += line.slice(6);
                setStreamingMessage(accumulatedText);
              }
            }
          }
        }
      }

      // Replace streaming text with final verified Message object
      if (finalMessageObj) {
        setMessages((prev) => [...prev, finalMessageObj]);
      } else {
        setMessages((prev) => [
          ...prev,
          { _id: Math.random().toString(), role: 'assistant', content: accumulatedText }
        ]);
      }
    } catch (err: any) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { _id: Math.random().toString(), role: 'assistant', content: `Error streaming answer: ${err.message}` }
      ]);
    } finally {
      setStreamingMessage('');
      setLoading(false);
    }
  };

  return (
    <div className="flex border border-zinc-800 rounded-xl bg-zinc-950 overflow-hidden h-[600px] text-zinc-100 relative">
      
      {/* 1. Collapsible Sidebar for Chat History */}
      <div 
        className={`flex flex-col bg-zinc-900/60 border-r border-zinc-800 transition-all duration-300 shrink-0 ${
          sidebarOpen ? 'w-60 opacity-100' : 'w-0 opacity-0 pointer-events-none overflow-hidden border-r-0'
        }`}
      >
        {/* New Chat Button */}
        <button
          onClick={handleCreateSession}
          className="flex items-center justify-center gap-2 m-3 py-2.5 px-4 bg-indigo-650 hover:bg-indigo-600 active:bg-indigo-700 text-zinc-100 rounded-lg text-xs font-semibold transition-colors shadow-lg shadow-indigo-650/10 shrink-0"
        >
          <Plus className="w-4 h-4" /> New Chat
        </button>

        {/* Chat History Header */}
        <div className="px-4 py-2 border-t border-b border-zinc-850 bg-zinc-900/30 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Chat Sessions</span>
          <span className="text-[10px] font-medium text-zinc-600">{sessions.length} chats</span>
        </div>

        {/* Sessions List */}
        <div className="flex-grow overflow-y-auto p-2 space-y-1">
          {sessions.map((s) => {
            const isActive = activeSession === s._id;
            const isEditing = editingSessionId === s._id;
            
            return (
              <div
                key={s._id}
                onClick={() => !isEditing && setActiveSession(s._id)}
                className={`group relative flex items-center justify-between p-2.5 rounded-lg text-xs transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-zinc-800 border border-zinc-700/50 text-zinc-100' 
                    : 'text-zinc-405 hover:text-zinc-200 hover:bg-zinc-850 border border-transparent'
                }`}
              >
                <div className="flex items-center min-w-0 flex-1">
                  <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-indigo-400' : 'text-zinc-500 group-hover:text-zinc-400'}`} />
                  
                  {isEditing ? (
                    <input
                      type="text"
                      value={editTitleInput}
                      onChange={(e) => setEditTitleInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameSession(s._id, editTitleInput);
                        if (e.key === 'Escape') setEditingSessionId(null);
                      }}
                      onBlur={() => handleRenameSession(s._id, editTitleInput)}
                      autoFocus
                      className="bg-zinc-950 border border-zinc-800 px-2 py-0.5 rounded text-zinc-200 outline-none text-xs flex-1 ml-2 min-w-0 focus:border-indigo-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="truncate flex-1 ml-2 font-medium">
                      {s.title}
                    </span>
                  )}
                </div>

                {/* Inline Actions (Rename & Delete) */}
                {!isEditing && (
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity pl-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingSessionId(s._id);
                        setEditTitleInput(s.title);
                      }}
                      className="p-1 rounded hover:bg-zinc-750 text-zinc-500 hover:text-zinc-300 transition-colors"
                      title="Rename Chat"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteSession(s._id, e)}
                      className="p-1 rounded hover:bg-zinc-750 text-zinc-500 hover:text-red-400 transition-colors"
                      title="Delete Chat"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Main Chat Panel (Left pane of split layout if manuscript selected) */}
      <div className={`flex flex-col h-full bg-zinc-950 relative min-w-0 transition-all duration-300 ${
        selectedDocType === 'generated' ? 'w-[45%]' : 'flex-1'
      }`}>
        
        {/* Header containing Active Session & Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-2 bg-zinc-900 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {/* Sidebar Toggle */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors shrink-0"
              title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            >
              {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </button>

            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-semibold text-xs text-zinc-300 truncate">
                {sessions.find((s) => s._id === activeSession)?.title || 'Workspace Chat'}
              </span>
            </div>
          </div>

          {/* Document Context Selector */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider shrink-0">Focus:</span>
            <select
              value={selectedDocId}
              onChange={(e) => handleDocSelectionChange(e.target.value)}
              className="h-8 px-2 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-lg text-[11px] font-medium outline-none text-zinc-300 transition-colors max-w-[180px] truncate"
            >
              <option value="none">Project Library (Search All)</option>
              {manuscripts.length > 0 && (
                <optgroup label="Manuscript Editor">
                  {manuscripts.map((p) => (
                    <option key={p._id} value={`gen:${p._id}`}>📝 {p.title}</option>
                  ))}
                </optgroup>
              )}
              {uploadedPapers.length > 0 && (
                <optgroup label="Uploaded PDFs (RAG Context)">
                  {uploadedPapers.map((p) => (
                    <option key={p._id} value={`pdf:${p._id}`}>📄 {p.title}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        </div>

        {/* Messages List */}
        <div className="flex-grow p-4 overflow-y-auto space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-6 select-none max-w-lg mx-auto">
              <div className="w-12 h-12 rounded-full bg-indigo-650/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 animate-pulse">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-bold text-zinc-250">Start a Research Conversation</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  {selectedDocType === 'generated'
                    ? `You are chatting in workspace focus mode with "${currentDocTitle}". Ask questions or prompt changes to apply them to your manuscript draft.`
                    : 'Ask details, extract citations, or analyze methodologies across all papers uploaded to this workspace.'}
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg._id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] p-4 rounded-2xl ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-zinc-100 rounded-tr-none shadow-md shadow-indigo-600/10' 
                    : 'bg-zinc-900 text-zinc-200 rounded-tl-none border border-zinc-800'
                } space-y-3`}>
                  <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  
                  {/* Actions on AI Message in Edit Mode */}
                  {msg.role === 'assistant' && selectedDocType === 'generated' && currentDocSections.length > 0 && (
                    <button
                      onClick={() => handleApplyToActiveSection(msg.content)}
                      className="flex items-center gap-1 py-1 px-2.5 rounded bg-indigo-950/40 hover:bg-indigo-600/20 border border-indigo-500/30 text-[10px] text-indigo-300 font-semibold transition-colors mt-1"
                    >
                      <FileEdit className="w-3 h-3" /> Apply to Active Section
                    </button>
                  )}

                  {/* Sources List */}
                  {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                    <div className="border-t border-zinc-800/80 pt-2.5 mt-2 space-y-1">
                      <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-indigo-400 animate-pulse" /> Evidence Sources ({msg.sources.length})
                      </span>
                      <div className="grid grid-cols-1 gap-1.5 mt-1">
                        {msg.sources.map((src: any, idx: number) => (
                          <div key={idx} className="p-2 rounded bg-zinc-950/60 border border-zinc-850 flex items-start gap-2">
                            <FileText className="w-3.5 h-3.5 text-zinc-550 mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-semibold text-zinc-300 truncate" title={src.paperTitle}>{src.paperTitle}</p>
                              <p className="text-[9px] text-zinc-550 mt-0.5">
                                Page {src.pageNumber || 'N/A'} • Score {Math.round(src.confidenceScore * 100)}%
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {/* Streaming Placeholder */}
          {streamingMessage && (
            <div className="flex justify-start">
              <div className="max-w-[90%] p-4 rounded-2xl bg-zinc-900 text-zinc-200 rounded-tl-none border border-zinc-800">
                <p className="text-xs leading-relaxed whitespace-pre-wrap">{streamingMessage}</p>
                <span className="inline-block w-1.5 h-3 bg-zinc-400 ml-0.5 animate-pulse" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input Form */}
        <form onSubmit={handleSend} className="p-3 bg-zinc-900 border-t border-zinc-800 flex gap-2 shrink-0">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              selectedDocType === 'generated'
                ? `Prompt edits for "${currentDocSections[activeSectionIdx]?.title || 'active section'}"...`
                : "Ask a question about uploaded papers..."
            }
            disabled={loading}
            className="flex-grow h-10 px-4 bg-zinc-950 border border-zinc-800 rounded-lg text-xs outline-none focus:border-indigo-500 text-zinc-200 disabled:opacity-50 transition-colors"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="w-10 h-10 rounded-lg bg-indigo-600 text-zinc-100 hover:bg-indigo-500 transition-colors flex items-center justify-center disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* 3. Right Pane: Split-Screen Manuscript Editor */}
      {selectedDocType === 'generated' && currentDocSections.length > 0 && (
        <div className="w-[55%] border-l border-zinc-800 flex flex-col h-full bg-zinc-950 overflow-hidden relative">
          
          {/* Section Selector Tab bar */}
          <div className="flex items-center gap-1.5 p-2 bg-zinc-900/50 border-b border-zinc-800 overflow-x-auto shrink-0">
            {currentDocSections.map((s, idx) => (
              <button
                key={idx}
                onClick={() => setActiveSectionIdx(idx)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-colors shrink-0 ${
                  activeSectionIdx === idx
                    ? 'bg-indigo-600 text-zinc-100 shadow'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                }`}
              >
                {s.title}
              </button>
            ))}
          </div>

          {/* Editor Workspace */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            
            {/* Title Editor */}
            <div className="space-y-1 shrink-0">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Manuscript Title</label>
              <input
                type="text"
                value={currentDocTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="w-full h-9 px-3 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-semibold text-zinc-200 outline-none focus:border-zinc-700"
              />
            </div>

            {/* Editing Context Header */}
            <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-indigo-400" />
                <span className="font-bold text-xs text-zinc-200">
                  Editing Section: <span className="text-zinc-400 font-semibold">{currentDocSections[activeSectionIdx]?.heading}</span>
                </span>
              </div>

              {/* Formatting Correction / AI Quick insertions */}
              <div className="flex items-center gap-1">
                <button
                  onClick={handleFormaTexAutoCorrect}
                  disabled={formattingLoad}
                  className="px-2.5 h-7 rounded border border-zinc-800 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-350 text-[10px] font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
                  title="Correct layouts, fix styling anomalies"
                >
                  {formattingLoad ? (
                    <RefreshCw className="w-3 h-3 animate-spin text-indigo-400" />
                  ) : (
                    <RefreshCw className="w-3 h-3 text-indigo-400" />
                  )}
                  Auto-Format
                </button>
              </div>
            </div>

            {/* Rich Editor Block */}
            <div className="space-y-2">
              <TipTapEditor
                content={currentDocSections[activeSectionIdx]?.content || ''}
                onChange={(html) => handleSectionContentChange(activeSectionIdx, html)}
              />
            </div>

            {/* Quick Actions Panel */}
            <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-900/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-[11px] font-bold text-zinc-300">Quick Insertion Blocks</h4>
                <p className="text-[10px] text-zinc-500 mt-0.5">Add diagrams or illustration frames into this section.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleInsertDiagram}
                  className="h-8 px-3 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-[10px] font-semibold flex items-center gap-1 transition-colors"
                >
                  <LayoutGrid className="w-3 h-3 text-indigo-400" /> + Diagram
                </button>
                <button
                  onClick={handleInsertImage}
                  className="h-8 px-3 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-[10px] font-semibold flex items-center gap-1 transition-colors"
                >
                  <Image className="w-3 h-3 text-purple-400" /> + Image Frame
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Beautiful 3D Popup for Unsaved Changes confirmation */}
      {isModified && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div 
            className="w-full max-w-md p-6 rounded-2xl text-center space-y-6 relative overflow-hidden transition-all duration-500 select-none animate-in fade-in zoom-in duration-300"
            style={{
              perspective: '1000px',
              transform: 'rotateX(8deg) rotateY(-3deg) translateZ(15px)',
              transformStyle: 'preserve-3d',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 35px rgba(99, 102, 241, 0.25)',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.95) 0%, rgba(9, 9, 11, 0.98) 100%)',
            }}
          >
            {/* Grid Pattern Backing */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none opacity-20" />
            
            {/* 3D Floating Icon Ring */}
            <div 
              className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-650 to-purple-500 flex items-center justify-center mx-auto text-zinc-100 shadow-xl shadow-indigo-600/30 transition-transform duration-700 hover:rotate-12"
              style={{ transform: 'translateZ(35px)' }}
            >
              <Sparkles className="w-8 h-8 text-zinc-100" />
            </div>

            <div className="space-y-2" style={{ transform: 'translateZ(20px)' }}>
              <h3 className="text-base font-bold text-zinc-100 tracking-tight">Unsaved Manuscript Draft</h3>
              <p className="text-xs text-zinc-400 leading-relaxed px-4">
                You have unsaved changes on <span className="text-indigo-400 font-semibold">{currentDocTitle}</span>. Would you like to commit these updates or discard?
              </p>
            </div>

            <div className="flex gap-3 justify-center pt-2" style={{ transform: 'translateZ(25px)' }}>
              <button
                onClick={handleDiscardChanges}
                className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-semibold transition-all hover:scale-105 active:scale-95"
              >
                Discard Edits
              </button>
              <button
                onClick={handleSaveChanges}
                className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-zinc-100 text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all hover:scale-105 active:scale-95 border border-indigo-450/20"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
