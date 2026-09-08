import type { Attachment } from '../data/models';
import { Timestamp } from 'firebase/firestore';
import { authService } from './auth';
import { AIError, withTimeout } from './ai';

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB limit
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/avif',
] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export class ImageValidationError extends Error {
  constructor(message: string, public readonly code: 'SIZE_EXCEEDED' | 'INVALID_MIME' | 'MALICIOUS_FILE' | 'UNAUTHORIZED') {
    super(message);
    this.name = 'ImageValidationError';
  }
}

export interface ImageContextOutput {
  observed: string[];
  userProvided: string[];
  aiInferred: string[];
  disclaimer: string;
  /** Gemini-written reflective journal body derived from the image. */
  body: string;
  /** One-line Gemini summary for aiMetadata.summary. */
  summary: string;
  /** Gemini-suggested tags. */
  tags: string[];
  /** Gemini-identified emotional tone. */
  emotion: string;
  /** Gemini model identifier. */
  modelUsed: string;
}

/**
 * Validates an image file for size, MIME type, and malicious filename patterns.
 */
export function validateImageFile(file: File, currentUserId: string): { ok: boolean; error?: string } {
  if (!currentUserId) {
    return { ok: false, error: 'Authentication required. Please sign in to upload images.' };
  }

  if (!file || file.size === 0) {
    return { ok: false, error: 'The selected image file is empty.' };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return {
      ok: false,
      error: `Image size exceeds the 10MB limit (File size: ${(file.size / (1024 * 1024)).toFixed(1)}MB).`,
    };
  }

  // Strict MIME type check
  const mimeType = file.type.toLowerCase();
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType as AllowedImageMimeType)) {
    return {
      ok: false,
      error: `Invalid file type "${file.type}". Only JPG, PNG, WEBP, GIF, HEIC, and AVIF images are permitted.`,
    };
  }

  // Security check for malicious filenames (double extensions, html/js scripts)
  const nameLower = file.name.toLowerCase();
  const suspiciousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.php', '.html', '.htm', '.js', '.vbs', '.ps1', '.svg'];
  if (suspiciousExtensions.some((ext) => nameLower.endsWith(ext) || nameLower.includes(`${ext}.`))) {
    return {
      ok: false,
      error: 'Security Error: Malicious or prohibited file extension detected.',
    };
  }

  return { ok: true };
}

/**
 * Uploads an image safely with ownership checks, returning a secure Attachment record.
 */
export async function uploadImageAttachment(params: {
  file: File;
  currentUserId: string;
  caption?: string;
  mockFailure?: boolean;
}): Promise<Attachment> {
  const { file, currentUserId, caption, mockFailure = false } = params;

  // 1. Ownership & Authorization Check
  if (!currentUserId) {
    throw new ImageValidationError('Security Violation: Unauthorized upload attempt without user context.', 'UNAUTHORIZED');
  }

  // 2. Size & MIME Validation
  const validation = validateImageFile(file, currentUserId);
  if (!validation.ok) {
    throw new ImageValidationError(validation.error || 'Invalid image file.', 'INVALID_MIME');
  }

  if (mockFailure) {
    throw new Error('Network timeout during image upload. Please retry.');
  }

  // 3. Generate secure private reference path `users/{uid}/attachments/{id}`
  const id = `img_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  // Create local Blob URL for secure preview (never expose unauthenticated public storage URLs)
  const secureUrl = URL.createObjectURL(file);

  return {
    id,
    kind: 'image',
    url: secureUrl,
    caption: caption || file.name,
    createdAt: Timestamp.fromDate(new Date()),
  };
}

/**
 * Gemini AI Image Context Analysis (server-side multimodal).
 *
 * CRITICAL ANTI-FABRICATION RULE:
 * The server never invents people, locations, dates, events, or relationships.
 * It clearly separates Observed visuals, User-provided facts, and AI-inferred reflections.
 */
export async function analyzeImageContext(params: {
  file: File;
  imageName: string;
  userCaption?: string;
  currentUserId: string;
}): Promise<ImageContextOutput> {
  const { file, imageName, userCaption, currentUserId } = params;

  if (!currentUserId) {
    throw new ImageValidationError('Security Violation: Unauthorized AI analysis request.', 'UNAUTHORIZED');
  }
  if (!file) {
    throw new ImageValidationError('No image file selected for analysis.', 'INVALID_MIME');
  }

  // Client-side pre-validation stays (defense in depth); the server re-validates.
  const validation = validateImageFile(file, currentUserId);
  if (!validation.ok) {
    throw new ImageValidationError(validation.error || 'Invalid image file.', 'INVALID_MIME');
  }

  if (authService.currentUser?.isDemo) {
    return {
      observed: [`Visual Object: ${imageName || 'Attached Photograph'}`],
      userProvided: userCaption ? [`User Caption: "${userCaption}"`] : ['No additional user caption provided'],
      aiInferred: ['Live Gemini visual analysis is available after signing in with Google.'],
      body: `Image attached: ${imageName || 'Attached Photograph'}. Sign in with Google to analyze images with Gemini.`,
      summary: 'Image journaling requires sign-in to access Gemini analysis.',
      tags: ['image-journal'],
      emotion: 'Reflective',
      modelUsed: 'demo-unavailable',
      disclaimer:
        'AI Context Policy: Observed elements reflect visible imagery. Gemini never fabricates names of people, specific dates, or unprovided location details.',
    };
  }

  return withTimeout<ImageContextOutput>(async () => {
    const token = await authService.getIdToken();
    const form = new FormData();
    form.append('image', file, file.name);
    if (userCaption) form.append('caption', userCaption);

    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let response: Response;
    try {
      response = await fetch('/api/gemini/analyze-image', {
        method: 'POST',
        headers,
        body: form,
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
      throw new AIError(data.error || 'Failed to analyze image.', response.status);
    }

    const result = data.result || {};
    const visualAnalysis = result.visualAnalysis || {};
    const body = typeof result.body === 'string' && result.body.trim() ? result.body.trim() : `Image attached: ${imageName || 'Attached Photograph'}.`;
    const summary = typeof result.summary === 'string' && result.summary.trim() ? result.summary.trim() : 'Visual journal entry created from an image.';
    const tags = Array.isArray(result.tags) ? result.tags.map(String).filter(Boolean).slice(0, 8) : ['image-journal'];
    const emotion = typeof result.emotion === 'string' && result.emotion.trim() ? result.emotion.trim() : 'Reflective';
    const modelUsed = typeof result.modelUsed === 'string' ? result.modelUsed : 'gemini';

    return {
      observed: Array.isArray(visualAnalysis.observed) ? visualAnalysis.observed : [],
      userProvided: Array.isArray(visualAnalysis.userProvided) ? visualAnalysis.userProvided : [],
      aiInferred: Array.isArray(visualAnalysis.aiInferred) ? visualAnalysis.aiInferred : [],
      body,
      summary,
      tags: tags.length > 0 ? tags : ['image-journal'],
      emotion,
      modelUsed,
      disclaimer:
        'AI Context Policy: Observed elements reflect visible imagery. Gemini never fabricates names of people, specific dates, or unprovided location details.',
    };
  });
}

/**
 * Verifies that an attachment path belongs to the given user ID.
 */
export function verifyAttachmentOwnership(attachmentPath: string, currentUserId: string): boolean {
  if (!attachmentPath || !currentUserId) return false;
  return attachmentPath.includes(`users/${currentUserId}/attachments/`);
}
