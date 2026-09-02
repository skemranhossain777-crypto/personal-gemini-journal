export type ReflectionMode = 'reflect' | 'summarize' | 'brainstorm' | 'chat';

export interface JournalMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}

export interface JournalInteraction {
  id: string;
  userId: string;
  title: string;
  mode: ReflectionMode;
  messages: JournalMessage[];
  summary?: string;
  tags?: string[];
  modelUsed?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReflectApiResponse {
  reply: string;
  summary: string;
  tags: string[];
  modelUsed: string;
  success: boolean;
  error?: string;
}
