import { authService } from './auth';
import { AIError, withTimeout } from './ai';

export type VoiceErrorKind =
  | 'mic-denied'
  | 'mic-not-supported'
  | 'transcription-failed'
  | 'empty-audio'
  | 'duration-exceeded'
  | 'network-error';

export class VoiceTranscriptionError extends Error {
  constructor(message: string, public readonly kind: VoiceErrorKind) {
    super(message);
    this.name = 'VoiceTranscriptionError';
  }
}

export interface TranscriptionResult {
  transcript: string;
  /** Gemini-written reflective journal body derived from the audio. */
  body: string;
  /** One-line Gemini summary for aiMetadata.summary. */
  summary: string;
  /** Gemini-suggested tags. */
  tags: string[];
  /** Gemini-identified emotional tone. */
  emotion: string;
  /** Gemini model identifier. */
  modelUsed: string;
  durationSeconds: number;
  confidence: number;
  language: string;
}

export const MAX_RECORDING_DURATION_SECONDS = 300; // 5 minutes

/**
 * Normalizes and cleans raw transcript text.
 */
export function cleanTranscriptText(rawText: string): string {
  if (!rawText) return '';
  return rawText
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b(um|uh|ah|er|like)\b/gi, '') // Light filler removal while retaining speech flow
    .replace(/\s+/g, ' ')
    .trim();
}

/** Converts a Blob to a File so it can be uploaded via FormData. */
function blobToFile(blob: Blob, filename: string, mimeType: string): File {
  if (typeof File !== 'undefined' && blob instanceof File) return blob as File;
  return new File([blob], filename, { type: mimeType });
}

/**
 * Transcribes audio blob using the server-side Gemini endpoint.
 * Throws a typed VoiceTranscriptionError on any failure so the UI can react.
 */
export async function transcribeAudioBlob(
  audioBlob: Blob | null,
  options: { language?: string; mockFailure?: boolean } = {}
): Promise<TranscriptionResult> {
  const { language = 'en-US', mockFailure = false } = options;

  if (!audioBlob || audioBlob.size === 0) {
    throw new VoiceTranscriptionError(
      'No audio data recorded. Please ensure your microphone is working and try again.',
      'empty-audio'
    );
  }

  const estimatedDuration = Math.max(1, Math.min(MAX_RECORDING_DURATION_SECONDS, Math.round(audioBlob.size / 16000)));

  if (mockFailure) {
    throw new VoiceTranscriptionError(
      'Transcription service encountered an error while processing audio. Please retry.',
      'transcription-failed'
    );
  }

  const mimeType = audioBlob.type || 'audio/webm';

  // Demo users get a graceful, clearly-labeled fallback (no live AI without sign-in).
  if (authService.currentUser?.isDemo) {
    return {
      transcript: 'Voice journaling with live transcription requires signing in with Google.',
      body: 'Voice journaling with live transcription requires signing in with Google.',
      summary: 'Sign in with Google to enable live voice journaling.',
      tags: ['voice-journal'],
      emotion: 'Reflective',
      modelUsed: 'demo-unavailable',
      durationSeconds: estimatedDuration,
      confidence: 0,
      language,
    };
  }

  return withTimeout<TranscriptionResult>(async () => {
    const token = await authService.getIdToken();
    const form = new FormData();
    form.append('audio', blobToFile(audioBlob, `voice-${Date.now()}.webm`, mimeType), `voice-${Date.now()}.webm`);
    form.append('language', language);

    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let response: Response;
    try {
      response = await fetch('/api/gemini/transcribe-voice', {
        method: 'POST',
        headers,
        body: form,
      });
    } catch {
      throw new VoiceTranscriptionError(
        'Could not reach the transcription service. Check your connection and retry.',
        'network-error'
      );
    }

    let data: any;
    try {
      data = await response.json();
    } catch {
      throw new VoiceTranscriptionError(
        'Transcription service returned an unreadable response.',
        'transcription-failed'
      );
    }

    if (!response.ok || data.success === false) {
      const msg = data.error || 'Transcription failed.';
      if (response.status === 429) {
        throw new VoiceTranscriptionError(msg, 'duration-exceeded');
      }
      throw new VoiceTranscriptionError(msg, 'transcription-failed');
    }

    const result = data.result || {};
    const transcript = typeof result.transcript === 'string' ? result.transcript : '';
    if (!transcript || !transcript.trim()) {
      throw new VoiceTranscriptionError(
        'Transcription produced no text. Please try again.',
        'transcription-failed'
      );
    }

    const body = typeof result.body === 'string' && result.body.trim() ? result.body.trim() : cleanTranscriptText(transcript);
    const summary = typeof result.summary === 'string' && result.summary.trim() ? result.summary.trim() : body.slice(0, 500);
    const tags = Array.isArray(result.tags)
      ? result.tags.map(String).filter(Boolean).slice(0, 8)
      : ['voice-journal'];

    return {
      transcript: cleanTranscriptText(transcript),
      body,
      summary,
      tags: tags.length > 0 ? tags : ['voice-journal'],
      emotion: typeof result.emotion === 'string' && result.emotion.trim() ? result.emotion.trim() : 'Reflective',
      modelUsed: typeof result.modelUsed === 'string' ? result.modelUsed : 'gemini',
      durationSeconds: estimatedDuration,
      confidence: 1,
      language,
    };
  });
}

/**
 * Check if Web Speech API or MediaRecorder is supported by current browser environment.
 */
export function isAudioRecordingSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const hasMediaRecorder = typeof MediaRecorder !== 'undefined';
  return hasMediaDevices && hasMediaRecorder;
}
