import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Timestamp } from 'firebase/firestore';
import { DataExportModal } from '../DataExportModal';
import type { JournalEntry } from '../../../data/models';

describe('DataExportModal component', () => {
  const mockEntry: JournalEntry = {
    id: 'entry_1',
    uid: 'user1',
    title: 'Export Test Entry',
    body: 'Sample body text for export testing.',
    mode: 'free-write',
    mood: 4,
    energy: 80,
    tags: ['test'],
    location: null,
    attachments: [],
    favorite: false,
    archived: false,
    private: false,
    aiMetadata: null,
    createdAt: Timestamp.fromDate(new Date()),
    updatedAt: Timestamp.fromDate(new Date()),
  };

  it('renders modal with JSON, Markdown, and CSV format cards when open', () => {
    render(
      <DataExportModal
        isOpen={true}
        onClose={vi.fn()}
        entries={[mockEntry]}
        currentUserId="user1"
      />
    );

    expect(screen.getByText(/Export Personal Journal Archive/i)).toBeInTheDocument();
    expect(screen.getByText('JSON')).toBeInTheDocument();
    expect(screen.getByText('Markdown')).toBeInTheDocument();
    expect(screen.getByText('CSV')).toBeInTheDocument();
  });

  it('allows format selection and triggers export with content verification badge', async () => {
    const user = userEvent.setup();

    // Mock URL.createObjectURL
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/export.csv');
    global.URL.revokeObjectURL = vi.fn();

    render(
      <DataExportModal
        isOpen={true}
        onClose={vi.fn()}
        entries={[mockEntry]}
        currentUserId="user1"
      />
    );

    const csvBtn = screen.getByRole('button', { name: /CSV/i });
    await user.click(csvBtn);

    const downloadBtn = screen.getByRole('button', { name: /Generate & Download/i });
    await user.click(downloadBtn);

    expect(screen.getByText(/Verified Data Integrity/i)).toBeInTheDocument();
  });
});
