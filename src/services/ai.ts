import type { ReflectApiResponse, ReflectionMode, JournalLocation, JournalMessage } from '../types';

/**
 * AI service (skill Phase 5) wrapping the server-side Gemini endpoint.
 *
 * AI itself runs server-side in this project (the Express server holds
 * GEMINI_API_KEY and runs the model-fallback ladder server-side), so the client
 * service provides the HTTP call + timeout + structured error handling
 * recommended by the skill.
 */
export const AI_TIMEOUT_MS = 60_000;

export interface ReflectRequest {
  prompt: string;
  mode: ReflectionMode;
  title: string;
  location?: JournalLocation;
  history?: Pick<JournalMessage, 'role' | 'content'>[];
}

export class AIError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'AIError';
  }
}

/** Warps a promise with a hard deadline. */
export function withTimeout<T>(fn: () => Promise<T>, ms: number = AI_TIMEOUT_MS): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new AIError('AI request timed out. Please try again.')), ms)
  );
  return Promise.race([fn(), timeout]);
}

/** Calls the Gemini reflect endpoint with a timeout and structured errors. */
export async function reflect(req: ReflectRequest): Promise<ReflectApiResponse> {
  return withTimeout(async () => {
    let response: Response;
    try {
      response = await fetch('/api/gemini/reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
    } catch (err) {
      throw new AIError('Could not reach the server. Are you online?');
    }

    let data: Partial<ReflectApiResponse>;
    try {
      data = (await response.json()) as Partial<ReflectApiResponse>;
    } catch {
      throw new AIError('Server returned an unreadable response.');
    }

    if (!response.ok || data.success === false) {
      throw new AIError(data.error || 'Server returned an error generating your reflection.', response.status);
    }

    return data as ReflectApiResponse;
  });
}
