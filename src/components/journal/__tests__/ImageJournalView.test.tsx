import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Timestamp } from 'firebase/firestore';
import { ImageJournalView } from '../ImageJournalView';
import type { Attachment } from '../../../data/models';

describe('ImageJournalView component', () => {
  const mockAttachment: Attachment = {
    id: 'att_1',
    kind: 'image',
    url: 'blob:http://localhost/sample-image-url',
    caption: 'Sunset in Kyoto',
    createdAt: Timestamp.fromDate(new Date()),
  };

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

  it('triggers Gemini image context analysis when analyze button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <ImageJournalView
        attachments={[mockAttachment]}
        currentUserId="user1"
      />
    );

    const analyzeBtn = screen.getByTitle(/Analyze Visual Context with Gemini AI/i);
    await user.click(analyzeBtn);

    expect(screen.getByText(/GEMINI VISUAL CONTEXT ASSISTANT/i)).toBeInTheDocument();
    expect(screen.getByText(/Observed Visuals/i)).toBeInTheDocument();
    expect(screen.getByText(/User Provided/i)).toBeInTheDocument();
    expect(screen.getByText(/AI Inferred Reflections/i)).toBeInTheDocument();
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
