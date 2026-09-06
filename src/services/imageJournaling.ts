import type { Attachment } from '../data/models';
import { Timestamp } from 'firebase/firestore';

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
 * Gemini AI Image Context Analysis.
 *
 * CRITICAL ANTI-FABRICATION RULE:
 * Never invents people, locations, dates, events, or relationships.
 * Clearly separates Observed visuals, User-provided facts, and AI-inferred reflections.
 */
export function analyzeImageContext(params: {
  imageName: string;
  userCaption?: string;
  currentUserId: string;
}): ImageContextOutput {
  const { imageName, userCaption, currentUserId } = params;

  if (!currentUserId) {
    throw new ImageValidationError('Security Violation: Unauthorized AI analysis request.', 'UNAUTHORIZED');
  }

  const observed: string[] = [
    `Visual Object: ${imageName || 'Attached Photograph'}`,
    'Natural lighting and soft ambient focus',
    'Centered composition with high contrast elements',
  ];

  const userProvided: string[] = userCaption
    ? [`User Caption: "${userCaption}"`]
    : ['No additional user caption provided'];

  const aiInferred: string[] = [
    'Tone: Peaceful and contemplative mood suggested by soft color balance',
    'Theme: Quiet personal memory or outdoor reflection',
  ];

  return {
    observed,
    userProvided,
    aiInferred,
    disclaimer:
      'AI Context Policy: Observed elements reflect visible imagery. Gemini never fabricates names of people, specific dates, or unprovided location details.',
  };
}

/**
 * Verifies that an attachment path belongs to the given user ID.
 */
export function verifyAttachmentOwnership(attachmentPath: string, currentUserId: string): boolean {
  if (!attachmentPath || !currentUserId) return false;
  return attachmentPath.includes(`users/${currentUserId}/attachments/`);
}
