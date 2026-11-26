/**
 * agentService.ts
 * Client-side service for communicating with the SymptomSage Python LangGraph
 * multi-agent backend (services/agent).
 *
 * Supports:
 *  - Non-streaming chat   → chatWithAgent()
 *  - Streaming SSE chat   → streamChatWithAgent()
 *  - HITL resume          → resumeWithAnswer()
 *  - Session history      → getSessionHistory()
 *  - Health check         → checkAgentHealth()
 */

const AGENT_BASE_URL =
  import.meta.env.VITE_AGENT_API_URL || 'http://localhost:8000';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AgentMessage {
  role: string;          // 'human' | 'ai' | 'tool'
  content: string;
  name: string | null;
}

export interface AgentChatResponse {
  answer: string;
  session_id: string;
  messages: AgentMessage[];
  error?: string;
}

export interface AgentStreamCallbacks {
  /** Called for each streamed token chunk. `node` is the agent that produced it. */
  onToken: (text: string, node: string) => void;
  /** Called when a tool starts running. */
  onToolStart: (tool: string, args: Record<string, unknown>, node: string) => void;
  /** Called when a tool finishes. `result` is a snippet (≤400 chars). */
  onToolEnd: (tool: string, result: string, node: string) => void;
  /** Called when a graph node completes. */
  onNode?: (node: string) => void;
  /** Called when the agent asks a follow-up question (HITL interrupt). */
  onFollowup?: (question: string, sessionId: string) => void;
  /** Called when streaming completes with the final answer + messages. */
  onDone: (answer: string, sessionId: string, messages: AgentMessage[]) => void;
  /** Called on network or agent error. */
  onError: (message: string) => void;
}

// ── Non-streaming chat ────────────────────────────────────────────────────────

export async function chatWithAgent(
  message: string,
  sessionId: string,
  userId: string = 'anonymous',
  imageBase64?: string,
): Promise<AgentChatResponse> {
  const res = await fetch(`${AGENT_BASE_URL}/api/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      session_id: sessionId,
      user_id: userId,
      image_base64: imageBase64 ?? null,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Agent API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<AgentChatResponse>;
}

// ── Streaming chat (SSE) ──────────────────────────────────────────────────────

/**
 * Stream a chat turn from the agent via SSE.
 * Returns a cleanup function that aborts the connection when called.
 */
export function streamChatWithAgent(
  message: string,
  sessionId: string,
  userId: string = 'anonymous',
  callbacks: AgentStreamCallbacks,
  imageBase64?: string,
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${AGENT_BASE_URL}/api/agent/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          session_id: sessionId,
          user_id: userId,
          image_base64: imageBase64 ?? null,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        callbacks.onError(`Agent API error ${res.status}: ${text}`);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        callbacks.onError('No response body from agent stream.');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE events are delimited by double newlines
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const eventLine = part.split('\n').find(l => l.startsWith('event:'));
          const dataLine  = part.split('\n').find(l => l.startsWith('data:'));

          if (!eventLine || !dataLine) continue;

          const event = eventLine.replace('event:', '').trim();
          let data: Record<string, unknown>;
          try {
            data = JSON.parse(dataLine.replace('data:', '').trim());
          } catch {
            continue;
          }

          switch (event) {
            case 'token':
              callbacks.onToken(
                data.text as string,
                (data.node as string) ?? 'agent',
              );
              break;
            case 'tool_start':
              callbacks.onToolStart(
                data.tool as string,
                (data.args as Record<string, unknown>) ?? {},
                (data.node as string) ?? 'agent',
              );
              break;
            case 'tool_end':
              callbacks.onToolEnd(
                data.tool as string,
                (data.result as string) ?? '',
                (data.node as string) ?? 'agent',
              );
              break;
            case 'node':
              callbacks.onNode?.((data.node as string) ?? '');
              break;
            case 'followup':
              callbacks.onFollowup?.(
                data.question as string,
                data.session_id as string,
              );
              break;
            case 'done':
              callbacks.onDone(
                (data.answer as string) ?? '',
                (data.session_id as string) ?? sessionId,
                (data.messages as AgentMessage[]) ?? [],
              );
              break;
            case 'error':
              callbacks.onError(data.message as string);
              break;
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') return; // User cancelled
      callbacks.onError(String(err));
    }
  })();

  return () => controller.abort();
}

// ── HITL resume ───────────────────────────────────────────────────────────────

export async function resumeWithAnswer(
  sessionId: string,
  answer: string,
): Promise<AgentChatResponse> {
  const res = await fetch(`${AGENT_BASE_URL}/api/agent/chat/resume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, answer }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Resume error ${res.status}: ${text}`);
  }

  return res.json() as Promise<AgentChatResponse>;
}

// ── Session history ───────────────────────────────────────────────────────────

export async function getSessionHistory(sessionId: string): Promise<AgentMessage[]> {
  const res = await fetch(
    `${AGENT_BASE_URL}/api/agent/session/${encodeURIComponent(sessionId)}/history`,
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.messages ?? []) as AgentMessage[];
}

// ── Health check ─────────────────────────────────────────────────────────────

export async function checkAgentHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${AGENT_BASE_URL}/api/agent/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.status === 'ok';
  } catch {
    return false;
  }
}
