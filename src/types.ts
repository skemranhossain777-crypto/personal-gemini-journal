export type ReflectionMode = 'reflect' | 'summarize' | 'brainstorm' | 'chat';

export interface JournalLocation {
  lat: number;
  lng: number;
  placeName: string;
  address?: string;
}

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
  location?: JournalLocation;
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

// Admin / RBAC types
export type AppRole = 'admin' | 'user';

export interface UserRole {
  role: AppRole;
  assignedBy?: string;
  assignedAt?: string;
}

export interface AdminUserSummary {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  interactionCount: number;
  lastActive: string | null;
  role: AppRole;
}

// Notification types
export interface NotificationSettings {
  slackWebhookUrl?: string;
  discordWebhookUrl?: string;
  enabled: boolean;
  notifyOn: ReflectionMode[];
}
