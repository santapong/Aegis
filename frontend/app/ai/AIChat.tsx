"use client";

import { useEffect, useState, useRef } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ChatMessage {
  id?: number;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
}

interface ChatSession {
  session_id: string;
  started_at: string;
  last_message_at: string;
  message_count: number;
}

interface AIStatus {
  connected: boolean;
  model: string;
  available_models: string[];
  ollama_url: string;
}

export default function AIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [showSessions, setShowSessions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchStatus();
    fetchSessions();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function fetchStatus() {
    try {
      const res = await fetch(`${API}/api/ai/status`);
      setStatus(await res.json());
    } catch {
      setStatus({ connected: false, model: "qwen2.5:7b", available_models: [], ollama_url: "" });
    }
  }

  async function fetchSessions() {
    try {
      const res = await fetch(`${API}/api/ai/chat/sessions`);
      setSessions(await res.json());
    } catch {}
  }

  async function loadSession(sid: string) {
    try {
      const res = await fetch(`${API}/api/ai/chat/history?session_id=${sid}`);
      const history: ChatMessage[] = await res.json();
      setMessages(history);
      setSessionId(sid);
      setShowSessions(false);
    } catch {}
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, session_id: sessionId }),
      });
      const data = await res.json();
      if (data.error) {
        setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${data.error}\n\n${data.hint || ""}` }]);
      } else {
        setSessionId(data.session_id);
        setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Failed to connect to AI service. Is Ollama running?" }]);
    } finally {
      setLoading(false);
    }
  }

  async function runAnalysis() {
    setAnalyzing(true);
    setMessages((prev) => [...prev, { role: "user", content: "Run a full financial analysis of my data." }]);
    try {
      const res = await fetch(`${API}/api/ai/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.error) {
        setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${data.error}\n\n${data.hint || ""}` }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Failed to connect to AI service." }]);
    } finally {
      setAnalyzing(false);
    }
  }

  function newChat() {
    setMessages([]);
    setSessionId(null);
    fetchSessions();
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI Financial Advisor</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Powered by {status?.model || "Qwen"} via Ollama
              <span className={`ml-2 inline-block w-2 h-2 rounded-full ${status?.connected ? "bg-emerald-500" : "bg-red-500"}`} />
              <span className="ml-1 text-xs">{status?.connected ? "Connected" : "Disconnected"}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSessions(!showSessions)}
              className="px-3 py-1.5 text-sm rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition"
            >
              History ({sessions.length})
            </button>
            <button
              onClick={newChat}
              className="px-3 py-1.5 text-sm rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition"
            >
              New Chat
            </button>
            <button
              onClick={runAnalysis}
              disabled={analyzing}
              className="px-4 py-1.5 text-sm rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium transition disabled:opacity-50"
            >
              {analyzing ? "Analyzing..." : "Analyze My Finances"}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto flex gap-4">
        {/* Sessions Panel */}
        {showSessions && (
          <div className="w-64 shrink-0 bg-zinc-900/80 rounded-xl border border-zinc-800 p-3 max-h-[600px] overflow-y-auto">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Chat Sessions</h3>
            {sessions.length === 0 ? (
              <p className="text-xs text-zinc-600">No sessions yet</p>
            ) : (
              sessions.map((s) => (
                <button
                  key={s.session_id}
                  onClick={() => loadSession(s.session_id)}
                  className={`w-full text-left p-2.5 rounded-lg mb-1.5 text-sm transition ${
                    sessionId === s.session_id ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : "hover:bg-zinc-800 text-zinc-400"
                  }`}
                >
                  <div className="text-xs text-zinc-600">{new Date(s.started_at).toLocaleDateString()}</div>
                  <div>{s.message_count} messages</div>
                </button>
              ))
            )}
          </div>
        )}

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-zinc-900/50 rounded-xl border border-zinc-800 min-h-[600px]">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center text-zinc-600">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-zinc-400 mb-2">Aegis AI Advisor</h3>
                <p className="text-sm max-w-sm">
                  Ask me anything about your finances, or click &quot;Analyze My Finances&quot; for a comprehensive review.
                </p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-zinc-800 text-zinc-200 border border-zinc-700"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-zinc-800">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Ask about your finances..."
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition disabled:opacity-50 disabled:hover:bg-blue-600"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
