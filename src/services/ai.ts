import type { ReflectApiResponse, ReflectionMode, JournalLocation, JournalMessage } from '../types';
import type {
  CompanionSkill,
  CompanionSkillInput,
  CompanionSkillOutput,
  CoachingInput,
  CoachingOutput,
  ContextualQuestionsInput,
  ContextualQuestionsOutput,
  MemoryCandidateInput,
  MemoryCandidateOutput,
  ReflectionInput,
  ReflectionOutput,
  ReframingInput,
  ReframingOutput,
  SummarizationInput,
  SummarizationOutput,
  ThemeExtractionInput,
  ThemeExtractionOutput,
} from '../../server/gemini/types';

import { authService } from './auth';

export const AI_TIMEOUT_MS = 60_000;

export interface ReflectRequest {
  prompt: string;
  mode: ReflectionMode;
  title: string;
  location?: JournalLocation;
  history?: Pick<JournalMessage, 'role' | 'content'>[];
}

export class AIError extends Error {
  constructor(message: string, public readonly status?: number, public readonly code?: string) {
    super(message);
    this.name = 'AIError';
  }
}

/** Wraps a promise with a hard deadline. */
export function withTimeout<T>(fn: () => Promise<T>, ms: number = AI_TIMEOUT_MS): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new AIError('AI request timed out. Please try again.')), ms)
  );
  return Promise.race([fn(), timeout]);
}

/** Helper function to call server AI endpoints. */
async function callAiEndpoint<TPayload, TResult>(endpoint: string, payload: TPayload): Promise<TResult> {
  if (authService.currentUser?.isDemo) {
    throw new AIError('Live Gemini AI is available after signing in with Google.', undefined, 'LIVE_AI_REQUIRES_SIGN_IN');
  }

  return withTimeout(async () => {
    let response: Response;
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = await authService.getIdToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
    } catch {
      throw new AIError('Could not reach the server. Are you online?');
    }

    let data: any;
    try {
      data = await response.json();
    } catch {
      throw new AIError('Server returned an unreadable response.');
    }

    if (!response.ok || data.success === false) {
      throw new AIError(data.error || 'Server returned an error processing AI request.', response.status);
    }

    return data.result !== undefined ? data.result : data;
  });
}

/** 1. Reflection Operation */
export async function reflect(req: ReflectRequest): Promise<ReflectApiResponse> {
  return callAiEndpoint<ReflectRequest, ReflectApiResponse>('/api/gemini/reflect', req);
}

/** 2. Summarization Operation */
export async function summarize(req: SummarizationInput): Promise<SummarizationOutput> {
  return callAiEndpoint<SummarizationInput, SummarizationOutput>('/api/gemini/summarize', req);
}

/** 3. Theme Extraction Operation */
export async function extractThemes(req: ThemeExtractionInput): Promise<ThemeExtractionOutput> {
  return callAiEndpoint<ThemeExtractionInput, ThemeExtractionOutput>('/api/gemini/extract-themes', req);
}

/** 4. Memory Candidate Extraction Operation */
export async function extractMemoryCandidates(req: MemoryCandidateInput): Promise<MemoryCandidateOutput> {
  return callAiEndpoint<MemoryCandidateInput, MemoryCandidateOutput>('/api/gemini/extract-memories', req);
}

/** 5. Contextual Questions Operation */
export async function generateContextualQuestions(req: ContextualQuestionsInput): Promise<ContextualQuestionsOutput> {
  return callAiEndpoint<ContextualQuestionsInput, ContextualQuestionsOutput>('/api/gemini/contextual-questions', req);
}

/** 6. Coaching Operation */
export async function provideCoaching(req: CoachingInput): Promise<CoachingOutput> {
  return callAiEndpoint<CoachingInput, CoachingOutput>('/api/gemini/coach', req);
}

/** 7. Reframing Operation */
export async function reframePerspective(req: ReframingInput): Promise<ReframingOutput> {
  return callAiEndpoint<ReframingInput, ReframingOutput>('/api/gemini/reframe', req);
}

/** Companion Skill Operation (Reflect, Challenge, Coach, Summarize, Explore, Remember, Connect, Reframe, Celebrate) */
export async function executeCompanionSkill(req: CompanionSkillInput): Promise<CompanionSkillOutput> {
  return callAiEndpoint<CompanionSkillInput, CompanionSkillOutput>('/api/gemini/companion-skill', req);
}
