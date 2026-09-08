import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Timestamp } from 'firebase/firestore';
import { ImageJournalView } from '../ImageJournalView';
import type { Attachment } from '../../../data/models';

vi.mock('../../../services/auth', () => ({
  authService: {
    currentUser: {},
    getIdToken: vi.fn(async () => 'id-token-abc'),
  },
}));

describe('ImageJournalView component', () => {
  const mockAttachment: Attachment = {
    id: 'att_1',
    kind: 'image',
    url: 'blob:http://localhost/sample-image-url',
    caption: 'Sunset in Kyoto',
    createdAt: Timestamp.fromDate(new Date()),
  };

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          result: {
            body: 'A reflective entry.',
            summary: 'Summary.',
            tags: ['nature'],
            emotion: 'Calm',
            visualAnalysis: {
              observed: ['A sunset skyline is visible.'],
              userProvided: [],
              aiInferred: ['The image supports a calm reflective mood.'],
            },
          },
        }),
      }))
    );
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders image upload dropzone and existing image thumbnail', () => {
    render(
      <ImageJournalView
        attachments={[mockAttachment]}
        currentUserId="user1"
      />
    );

    expect(screen.getByText(/Image Journaling & Attachments/i)).toBeInTheDocument();
    expect(screen.getByText(/\(1 images\)/i)).toBeInTheDocument();
    expect(screen.getByAltText('Sunset in Kyoto')).toBeInTheDocument();
  });

  it('triggers Gemini image context analysis for an uploaded image', async () => {
    const user = userEvent.setup();

    const onAdd = vi.fn();
    const onUseDraft = vi.fn();
    const { rerender } = render(
      <ImageJournalView
        attachments={[]}
        currentUserId="user1"
        onAddAttachment={onAdd}
      />
    );

    // Upload a real file through the input so the component retains it for analysis.
    const file = new File(['fake-image-bytes'], 'sunset.jpg', { type: 'image/jpeg' });
    await user.click(screen.getByText(/Click or drop an image here to attach/i));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);

    const uploadedAttachment = onAdd.mock.calls[0][0] as Attachment;
    rerender(
      <ImageJournalView
        attachments={[uploadedAttachment]}
        currentUserId="user1"
        onAddAttachment={onAdd}
        onUseDraft={onUseDraft}
      />
    );

    const analyzeBtn = screen.getByTitle(/Analyze Visual Context with Gemini AI/i);
    await user.click(analyzeBtn);

    expect(screen.getByText(/GEMINI VISUAL CONTEXT ASSISTANT/i)).toBeInTheDocument();
    expect(screen.getByText(/Observed Visuals/i)).toBeInTheDocument();
    expect(screen.getByText(/User Provided/i)).toBeInTheDocument();
    expect(screen.getByText(/AI Inferred Reflections/i)).toBeInTheDocument();

    // Structured reflection surfaced for review + apply-as-draft flow.
    expect(screen.getByText(/GEMINI REFLECTION/i)).toBeInTheDocument();
    expect(screen.getByText(/A reflective entry\./i)).toBeInTheDocument();
    expect(screen.getByText(/Summary\./i)).toBeInTheDocument();
    expect(screen.getByText('Calm')).toBeInTheDocument();

    const useDraftBtn = screen.getByRole('button', { name: /Use as Journal Draft/i });
    await user.click(useDraftBtn);

    expect(onUseDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'A reflective entry.',
        summary: 'Summary.',
        emotion: 'Calm',
        suggestedTags: ['nature'],
        modelUsed: 'gemini',
      })
    );
  });

  it('opens lightbox modal when thumbnail view button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <ImageJournalView
        attachments={[mockAttachment]}
        currentUserId="user1"
      />
    );

    const viewBtn = screen.getByTitle(/View Full Preview/i);
    await user.click(viewBtn);

    expect(screen.getAllByAltText('Sunset in Kyoto')).toHaveLength(2);
  });
});
