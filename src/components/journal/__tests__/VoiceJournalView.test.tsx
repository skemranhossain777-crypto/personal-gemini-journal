import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VoiceJournalView } from '../VoiceJournalView';

vi.mock('../../../services/auth', () => ({
  authService: {
    currentUser: {},
    getIdToken: vi.fn(async () => 'id-token-abc'),
  },
}));

function installMediaMocks() {
  const availableHandler = vi.fn((e) => {
    e.data = new Blob(['sample-voice-bytes'], { type: 'audio/webm' });
  });
  (window as any).MediaRecorder = class {
    static isTypeSupported() {
      return true;
    }
    mimeType = 'audio/webm';
    state: 'inactive' | 'recording' | 'paused' = 'inactive';
    ondataavailable: ((e: any) => void) | null = null;
    onstop: ((e: any) => void) | null = null;
    start() {
      this.state = 'recording';
      if (this.ondataavailable) availableHandler(this);
      this.ondataavailable?.({ data: new Blob(['sample-voice-bytes'], { type: 'audio/webm' }) });
    }
    pause() {
      this.state = 'paused';
    }
    resume() {
      this.state = 'recording';
    }
    stop() {
      this.state = 'inactive';
      if (this.onstop) (this.onstop as any)({});
    }
  };
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })),
    },
  });
}

describe('VoiceJournalView component', () => {
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
    installMediaMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders idle state with start recording button', () => {
    render(<VoiceJournalView />);

    expect(screen.getByText(/Voice Journal Reflection/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start Voice Recording/i })).toBeInTheDocument();
  });

  it('handles recording flow, stop, transcription review, and saving draft', async () => {
    const user = userEvent.setup();
    const onSaveDraft = vi.fn();

    render(<VoiceJournalView onSaveDraft={onSaveDraft} />);

    // 1. Click start recording (uses real MediaRecorder mock)
    const startBtn = screen.getByRole('button', { name: /Start Voice Recording/i });
    await user.click(startBtn);

    expect(screen.getByText(/Recording Voice.../i)).toBeInTheDocument();

    // 2. Click Done & Transcribe
    const doneBtn = screen.getByRole('button', { name: /Done & Transcribe/i });
    await user.click(doneBtn);

    // 3. Review state: displays editable transcript draft
    expect(await screen.findByText(/Review & Edit Your Voice Entry/i)).toBeInTheDocument();
    const bodyTextarea = screen.getByDisplayValue(/Today I took a long walk/i);
    expect(bodyTextarea).toBeInTheDocument();

    // Edit transcript body
    await user.clear(bodyTextarea);
    await user.type(bodyTextarea, 'Updated transcript note.');

    // Toggle audio attachment
    const keepAudioCheckbox = screen.getByRole('checkbox', { name: /Attach raw audio file/i });
    await user.click(keepAudioCheckbox);

    // Click Save Entry
    const saveBtn = screen.getByRole('button', { name: /Save Journal Entry/i });
    await user.click(saveBtn);

    expect(onSaveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'Updated transcript note.',
        keepAudioAttachment: true,
        aiMetadata: expect.objectContaining({
          modality: 'voice',
          transcript: 'Today I took a long walk through the park and reflected on my goals.',
          summary: 'A peaceful reflection.',
          emotion: 'Peaceful',
          suggestedTags: ['nature'],
          modelUsed: 'gemini',
        }),
      })
    );
  }, 15000);

  it('allows canceling and discarding draft without saving', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(<VoiceJournalView onCancel={onCancel} />);

    // Start recording
    await user.click(screen.getByRole('button', { name: /Start Voice Recording/i }));

    // Click cancel
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    await user.click(cancelBtn);

    expect(onCancel).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Start Voice Recording/i })).toBeInTheDocument();
  });
});
