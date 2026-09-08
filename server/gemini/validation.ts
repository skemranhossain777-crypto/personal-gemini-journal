import { GeminiError } from './types';

export const MAX_INPUT_LENGTH = 12000;

/** Malicious prompt injection signatures to reject for security defense in depth. */
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /system\s+prompt\s+override/i,
  /disregard\s+(all\s+)?safety\s+guidelines/i,
  /you\s+are\s+now\s+dan\b/i,
  /jailbreak\s+mode/i,
  /reveal\s+(your\s+)?system\s+instructions/i,
  /leak\s+(the\s+)?system\s+prompt/i,
  /override\s+system\s+prompt/i,
  /forget\s+(all\s+)?previous\s+rules/i,
  /output\s+(the\s+)?system\s+prompt/i,
  /print\s+(your\s+)?instructions/i,
  /bypass\s+safety\s+filters/i,
  /developer\s+mode/i,
  /act\s+as\s+(an\s+)?unfiltered/i,
];

/** Validates and sanitizes prompt text input. */
export function validateTextInput(input: unknown, maxLen = MAX_INPUT_LENGTH, fieldName = 'Input'): string {
  if (typeof input !== 'string' || !input.trim()) {
    throw new GeminiError(`${fieldName} must be a non-empty string.`, 'INVALID_INPUT', 400);
  }

  const trimmed = input.trim();

  if (trimmed.length > maxLen) {
    throw new GeminiError(
      `${fieldName} exceeds the maximum allowed length of ${maxLen.toLocaleString()} characters (received ${trimmed.length.toLocaleString()}).`,
      'OVERSIZED_INPUT',
      400
    );
  }

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      throw new GeminiError(
        'Input contains invalid or suspicious control patterns (prompt injection safety policy).',
        'PROMPT_INJECTION',
        400
      );
    }
  }

  return trimmed;
}

/** Sanitizes retrieved user journal context to prevent indirect prompt injection. */
export function sanitizeRetrievedContext(contextText: string): string {
  if (!contextText) return '';
  return contextText
    .replace(/<SYSTEM_INSTRUCTION>/gi, '[SANITIZED_TAG]')
    .replace(/<\/SYSTEM_INSTRUCTION>/gi, '[/SANITIZED_TAG]')
    .replace(/<UNTRUSTED_RETRIEVED_JOURNAL_CONTENT>/gi, '[SANITIZED_TAG]')
    .replace(/<\/UNTRUSTED_RETRIEVED_JOURNAL_CONTENT>/gi, '[/SANITIZED_TAG]')
    .replace(/ignore\s+(all\s+)?previous\s+instructions/gi, '[SANITIZED_INSTRUCTION]')
    .replace(/system\s+prompt\s+override/gi, '[SANITIZED_OVERRIDE]');
}

/** Extracts JSON payload from raw text (handling markdown codeblocks or raw JSON strings). */
export function extractJsonFromText(rawText: string): any {
  if (!rawText || !rawText.trim()) {
    throw new GeminiError('Raw AI response was empty.', 'EMPTY_RESPONSE', 500);
  }

  // 1. Try direct JSON parse
  try {
    return JSON.parse(rawText.trim());
  } catch {
    // Continue to fallback extraction
  }

  // 2. Try markdown json block: ```json ... ```
  const codeBlockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch?.[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {
      // Continue
    }
  }

  // 3. Try finding first '{' or '[' to matching '}' or ']'
  const firstBrace = rawText.indexOf('{');
  const lastBrace = rawText.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(rawText.slice(firstBrace, lastBrace + 1));
    } catch {
      // Continue
    }
  }

  throw new GeminiError('Failed to parse structured JSON from AI output.', 'MALFORMED_RESPONSE', 500);
}

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/avif',
] as const;

export const ALLOWED_AUDIO_MIME_TYPES = [
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/x-wav',
  'audio/mpeg3',
] as const;

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];
export type AllowedAudioMimeType = (typeof ALLOWED_AUDIO_MIME_TYPES)[number];

/** Validates multimodal media metadata (MIME + size) before it reaches Gemini. */
export function validateMultimodalMedia(input: {
  mimeType: string;
  buffer?: Buffer;
  size?: number;
  modality: 'image' | 'voice';
}): { allowedMime: (string)[] } {
  const { mimeType, modality } = input;
  const size = input.buffer?.length ?? input.size ?? 0;

  const mimeLower = (mimeType || '').toLowerCase();

  if (modality === 'image') {
    if (!(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mimeLower)) {
      throw new GeminiError(
        `Invalid image type "${mimeType || 'unknown'}". Allowed: JPG, PNG, WEBP, GIF, HEIC, AVIF.`,
        'INVALID_INPUT',
        400
      );
    }
    if (size > MAX_IMAGE_BYTES) {
      throw new GeminiError(
        `Image exceeds the ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))}MB limit (received ${Math.round(size / (1024 * 1024) * 10) / 10}MB).`,
        'OVERSIZED_INPUT',
        400
      );
    }
    return { allowedMime: ALLOWED_IMAGE_MIME_TYPES as unknown as string[] };
  }

  if (!(ALLOWED_AUDIO_MIME_TYPES as readonly string[]).includes(mimeLower)) {
    throw new GeminiError(
      `Invalid audio type "${mimeType || 'unknown'}". Allowed: WebM, MP4, MP3, WAV, OGG.`,
      'INVALID_INPUT',
      400
    );
  }
  if (size > MAX_AUDIO_BYTES) {
    throw new GeminiError(
      `Audio exceeds the ${Math.round(MAX_AUDIO_BYTES / (1024 * 1024))}MB limit (received ${Math.round(size / (1024 * 1024) * 10) / 10}MB).`,
      'OVERSIZED_INPUT',
      400
    );
  }
  return { allowedMime: ALLOWED_AUDIO_MIME_TYPES as unknown as string[] };
}

/** Validates and parses structured JSON output with fallback safety. */
export function parseAndValidateJson<T>(
  rawText: string,
  validator: (parsed: any) => T,
  fallback: T
): T {
  try {
    const rawObj = extractJsonFromText(rawText);
    const validated = validator(rawObj);
    return validated;
  } catch (err: any) {
    console.warn('[Gemini Response Validation] Parsing failed, returning safe fallback:', err?.message || err);
    return fallback;
  }
}
