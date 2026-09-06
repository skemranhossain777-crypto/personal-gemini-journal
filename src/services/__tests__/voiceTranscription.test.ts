import { describe, it, expect } from 'vitest';
import {
  cleanTranscriptText,
  transcribeAudioBlob,
  isAudioRecordingSupported,
  VoiceTranscriptionError,
  MAX_RECORDING_DURATION_SECONDS,
} from '../voiceTranscription';

describe('voiceTranscription service', () => {
  it('cleans transcript text and collapses extra whitespace', () => {
    const raw = 'Today um I took a ah long walk er in the park.';
    const cleaned = cleanTranscriptText(raw);
    expect(cleaned).toBe('Today I took a long walk in the park.');
  });

  it('transcribes valid audio blob', async () => {
    const dummyBlob = new Blob(['sample-audio-data'], { type: 'audio/webm' });
    const result = await transcribeAudioBlob(dummyBlob);

    expect(result.transcript).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.durationSeconds).toBeLessThanOrEqual(MAX_RECORDING_DURATION_SECONDS);
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
