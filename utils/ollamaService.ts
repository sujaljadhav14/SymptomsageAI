/**
 * ollamaService.ts
 * Talks to a locally running Ollama instance (http://localhost:11434)
 * Used as fallback when Gemini Live API is unavailable.
 *
 * Requires Ollama running with a model pulled, e.g.:
 *   ollama pull llama3
 *   ollama serve
 */

const OLLAMA_BASE_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3';

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaStreamChunk {
  model: string;
  created_at: string;
  message: { role: string; content: string };
  done: boolean;
}

/**
 * Check if Ollama server is running and the model is available.
 * Returns { available: boolean, model: string, error?: string }
 */
export async function checkOllamaAvailability(model = DEFAULT_MODEL): Promise<{
  available: boolean;
  model: string;
  error?: string;
}> {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { available: false, model, error: 'Ollama server not responding' };

    const data = await res.json();
    const models: string[] = (data.models || []).map((m: any) => m.name);
    const hasModel = models.some(m => m.startsWith(model));

    if (!hasModel) {
      return {
        available: false,
        model,
        error: `Model "${model}" not found. Run: ollama pull ${model}`,
      };
    }

    return { available: true, model };
  } catch (e: any) {
    return {
      available: false,
      model,
      error: 'Ollama is not running. Start it with: ollama serve',
    };
  }
}

/**
 * Send a chat request to Ollama and stream the response.
 * Calls onChunk for each text chunk received.
 * Returns the full response text when done.
 */
export async function chatWithOllama(
  messages: OllamaMessage[],
  onChunk: (text: string) => void,
  model = DEFAULT_MODEL,
  signal?: AbortSignal
): Promise<string> {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Ollama error ${res.status}: ${errText}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const lines = decoder.decode(value).split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const chunk: OllamaStreamChunk = JSON.parse(line);
        if (chunk.message?.content) {
          fullText += chunk.message.content;
          onChunk(chunk.message.content);
        }
      } catch (_) {
        // Ignore malformed chunks
      }
    }
  }

  return fullText;
}

export { DEFAULT_MODEL, OLLAMA_BASE_URL };
