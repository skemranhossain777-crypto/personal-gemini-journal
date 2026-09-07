import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Timestamp } from 'firebase/firestore';
import { DataExportModal } from '../DataExportModal';
import * as dataExportService from '../../../services/dataExportService';
import type { JournalEntry } from '../../../data/models';
import type { JournalInteraction } from '../../../types';

const mockCsvResult: dataExportService.ExportResult = {
  filename: 'JOURNAL_LIFE_EXPORT_2026-09-07.csv',
  mimeType: 'text/csv',
  content:
    '"ID","Title","Date","Mode","Mood","Energy","Tags","Location","Body"\n"export_1","Export Test Entry",,,4,,"test","","Sample body text for export testing."\n',
  itemCount: 1,
  format: 'csv',
  exportedAt: '2026-09-07T00:00:00.000Z',
};

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

    expect(await screen.findByText(/Verified Data Integrity/i)).toBeInTheDocument();
  });

  it('surfaces failures with an inline alert instead of a silent download', async () => {
    const user = userEvent.setup();
    vi.spyOn(dataExportService, 'exportJournalDataAsync').mockRejectedValueOnce(
      new Error('Simulated backend failure')
    );

    render(
      <DataExportModal
        isOpen={true}
        onClose={vi.fn()}
        entries={[mockEntry]}
        currentUserId="user1"
      />
    );

    await user.click(screen.getByRole('button', { name: /Generate & Download/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Simulated backend failure/i);
  });

  it('passes the user\'s AI conversation sessions into the export request', async () => {
    const user = userEvent.setup();
    const conv: JournalInteraction = {
      id: 'conv_1',
      userId: 'user1',
      title: 'Evening Reflection',
      mode: 'reflect',
      messages: [],
      summary: 'Calm wrap-up',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const spy = vi.spyOn(dataExportService, 'exportJournalDataAsync').mockResolvedValueOnce({
      ...mockCsvResult,
      content: '{"schemaVersion":"1.0","userId":"user1","journalEntries":[]}',
      format: 'json',
      mimeType: 'application/json',
      filename: 'JOURNAL_LIFE_EXPORT_2026-09-07.json',
    });

    render(
      <DataExportModal
        isOpen={true}
        onClose={vi.fn()}
        entries={[mockEntry]}
        interactions={[conv]}
        currentUserId="user1"
      />
    );

    await user.click(screen.getByRole('button', { name: /Generate & Download/i }));

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        interactions: [conv],
        currentUserId: 'user1',
        format: 'json',
      })
    );
  });
});
