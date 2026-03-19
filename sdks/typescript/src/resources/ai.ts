import type { AegisClient } from "../client";
import type {
  AnalyzeRequest,
  AnalysisEntry,
  ChatRequest,
  ChatResponse,
  ChatMessage,
  ChatSession,
  AIStatus,
} from "../types";

export class AIResource {
  private client: AegisClient;

  constructor(client: AegisClient) {
    this.client = client;
  }

  /** Run a financial analysis. */
  async analyze(data?: AnalyzeRequest): Promise<AnalysisEntry> {
    return this.client.post<AnalysisEntry>("/api/ai/analyze", data ?? {});
  }

  /** Send a chat message to the AI assistant. */
  async chat(data: ChatRequest): Promise<ChatResponse> {
    return this.client.post<ChatResponse>("/api/ai/chat", data);
  }

  /** Get chat history for a session. */
  async getChatHistory(sessionId: string): Promise<ChatMessage[]> {
    return this.client.get<ChatMessage[]>("/api/ai/chat/history", {
      session_id: sessionId,
    });
  }

  /** List all chat sessions. */
  async getChatSessions(): Promise<ChatSession[]> {
    return this.client.get<ChatSession[]>("/api/ai/chat/sessions");
  }

  /** List all past analyses. */
  async getAnalyses(): Promise<AnalysisEntry[]> {
    return this.client.get<AnalysisEntry[]>("/api/ai/analyses");
  }

  /** Get AI service status. */
  async getStatus(): Promise<AIStatus> {
    return this.client.get<AIStatus>("/api/ai/status");
  }
}
