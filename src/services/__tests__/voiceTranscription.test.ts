import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  cleanTranscriptText,
  transcribeAudioBlob,
  isAudioRecordingSupported,
  VoiceTranscriptionError,
  MAX_RECORDING_DURATION_SECONDS,
} from '../voiceTranscription';

vi.mock('../auth', () => ({
  authService: {
    currentUser: {},
    getIdToken: vi.fn(async () => 'id-token-abc'),
  },
}));

describe('voiceTranscription service', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          result: {
            transcript: 'Today I took a long walk through the park and reflected on my goals.',
            body: 'Today I took a long walk through the park and reflected on my goals.',
            summary: 'A peaceful reflection.',
            tags: ['nature'],
            emotion: 'Peaceful',
          },
        }),
      }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('cleans transcript text and collapses extra whitespace', () => {
    const raw = 'Today um I took a ah long walk er in the park.';
    const cleaned = cleanTranscriptText(raw);
    expect(cleaned).toBe('Today I took a long walk in the park.');
  });

  it('transcribes valid audio blob via the server endpoint', async () => {
    const dummyBlob = new Blob(['sample-audio-data'], { type: 'audio/webm' });
    const result = await transcribeAudioBlob(dummyBlob);

    expect(result.transcript).toContain('long walk');
    expect(result.body).toContain('long walk');
    expect(result.summary).toBe('A peaceful reflection.');
    expect(result.tags).toContain('nature');
    expect(result.emotion).toBe('Peaceful');
    expect(result.modelUsed).toBe('gemini');
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.durationSeconds).toBeLessThanOrEqual(MAX_RECORDING_DURATION_SECONDS);
    expect(fetch).toHaveBeenCalledWith('/api/gemini/transcribe-voice', expect.objectContaining({ method: 'POST' }));
  });

  it('throws VoiceTranscriptionError for empty audio blob', async () => {
    const emptyBlob = new Blob([], { type: 'audio/webm' });
    await expect(transcribeAudioBlob(emptyBlob)).rejects.toThrow(VoiceTranscriptionError);
  });

  it('handles mock transcription failure option gracefully', async () => {
    const dummyBlob = new Blob(['sample-audio-data'], { type: 'audio/webm' });
    await expect(transcribeAudioBlob(dummyBlob, { mockFailure: true })).rejects.toThrow(
      /Transcription service encountered an error/
    );
  });

  it('checks audio recording browser support', () => {
    const supported = isAudioRecordingSupported();
    expect(typeof supported).toBe('boolean');
  });
});
