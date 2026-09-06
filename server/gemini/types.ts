import type { MemoryType } from '../../src/data/models';

export interface GeminiServiceConfig {
  apiKey?: string;
  defaultModel?: string;
  fallbackModels?: string[];
  timeoutMs?: number;
  maxPromptLength?: number;
}

export type GeminiErrorCode =
  | 'INVALID_INPUT'
  | 'OVERSIZED_INPUT'
  | 'PROMPT_INJECTION'
  | 'TIMEOUT'
  | 'API_ERROR'
  | 'MALFORMED_RESPONSE'
  | 'RATE_LIMITED'
  | 'EMPTY_RESPONSE';

export class GeminiError extends Error {
  constructor(
    message: string,
    public readonly code: GeminiErrorCode,
    public readonly status: number = 500,
    public readonly originalError?: any
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

export type CompanionSkill =
  | 'reflect'
  | 'challenge'
  | 'coach'
  | 'summarize'
  | 'explore'
  | 'remember'
  | 'connect'
  | 'reframe'
  | 'celebrate';

export interface CompanionSkillInput {
  skill: CompanionSkill;
  prompt: string;
  title?: string;
  location?: { placeName: string; address?: string; lat: number; lng: number } | null;
  history?: Array<{ role: 'user' | 'model'; content: string }>;
  journalContext?: string[];
}

export interface CompanionSkillOutput {
  skill: CompanionSkill;
  reply: string;
  observations: string[]; // Facts observed directly in user input
  suggestions: string[];  // Actionable steps/ideas proposed
  inferences: string[];   // Inferred themes or connections explicitly labeled as inference
  summary: string;
  tags: string[];
  modelUsed: string;
}

// Legacy / specific operation input/output types
export interface ReflectionInput {
  prompt: string;
  mode?: string;
  title?: string;
  location?: { placeName: string; address?: string; lat: number; lng: number } | null;
  history?: Array<{ role: 'user' | 'model'; content: string }>;
}

export interface ReflectionOutput {
  reply: string;
  summary: string;
  tags: string[];
  modelUsed: string;
}

export interface SummarizationInput {
  text: string;
  title?: string;
}

export interface SummarizationOutput {
  summary: string;
  keyTakeaways: string[];
  emotionalTone: string;
  modelUsed: string;
}

export interface ThemeExtractionInput {
  text: string;
}

export interface ThemeExtractionOutput {
  themes: string[];
  dominantEmotions: string[];
  recurringTopics: string[];
  modelUsed: string;
}

export interface MemoryCandidateInput {
  text: string;
}

export interface MemoryCandidate {
  type: MemoryType;
  title: string;
  narrative: string;
  importance: number; // 1..5
  confidence: number; // 0..1
}

export interface MemoryCandidateOutput {
  candidates: MemoryCandidate[];
  modelUsed: string;
}

export interface ContextualQuestionsInput {
  text: string;
  contextSnippets?: string[];
}

export interface ContextualQuestionsOutput {
  questions: string[];
  contextRelevance: string;
  modelUsed: string;
}

export interface CoachingInput {
  situation: string;
  goalOrIntention?: string;
}

export interface CoachingOutput {
  guidance: string;
  actionableSteps: string[];
  perspectiveShift: string;
  modelUsed: string;
}

export interface ReframingInput {
  negativeThought: string;
  context?: string;
}

export interface ReframingOutput {
  originalThought: string;
  reframedPerspectives: string[];
  cognitiveDistortionsIdentified: string[];
  empoweringTakeaway: string;
  modelUsed: string;
}

export interface ContextDocument {
  id: string;
  title: string;
  content: string;
  type: 'entry' | 'memory' | 'goal' | 'timeline';
  date?: string;
  tags?: string[];
}

export interface EvidenceCitation {
  id: string;
  title: string;
  type: 'entry' | 'memory' | 'goal' | 'timeline';
  snippet: string;
  date?: string;
}

export interface AskMyLifeInput {
  question: string;
  contextDocuments: ContextDocument[];
  dateFilter?: { startDate?: string; endDate?: string };
}

export interface AskMyLifeOutput {
  answer: string;
  evidence: EvidenceCitation[];
  confidence: 'high' | 'medium' | 'low' | 'insufficient';
  hasSufficientEvidence: boolean;
  modelUsed: string;
}
