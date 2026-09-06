import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Timestamp } from 'firebase/firestore';
import { ReflectionReportsView } from '../ReflectionReportsView';
import type { JournalEntry } from '../../../data/models';

describe('ReflectionReportsView component', () => {
  const mockEntry: JournalEntry = {
    id: 'entry_1',
    uid: 'user1',
    title: 'Great Achievement',
    body: 'Felt so happy and proud after completing the marathon! Realized training works.',
    mode: 'free-write',
    mood: 5,
    energy: 95,
    tags: ['fitness'],
    location: null,
    attachments: [],
    favorite: true,
    archived: false,
    private: false,
    aiMetadata: null,
    createdAt: Timestamp.fromDate(new Date()),
    updatedAt: Timestamp.fromDate(new Date()),
  };

  it('renders report header, stats bar, and all 8 structured sections', () => {
    render(
      <ReflectionReportsView
        entries={[mockEntry]}
        currentUserId="user1"
      />
    );

    expect(screen.getByText(/AI Reflection Reports/i)).toBeInTheDocument();
    expect(screen.getByText(/Entries Analyzed/i)).toBeInTheDocument();
    expect(screen.getByText(/Highlights/i)).toBeInTheDocument();
    expect(screen.getByText(/Difficult Moments/i)).toBeInTheDocument();
    expect(screen.getByText(/Lessons Learned/i)).toBeInTheDocument();
    expect(screen.getByText(/Recurring Themes/i)).toBeInTheDocument();
    expect(screen.getByText(/Goal Progress/i)).toBeInTheDocument();
    expect(screen.getByText(/Unfinished Intentions/i)).toBeInTheDocument();
    expect(screen.getByText(/Meaningful Memories/i)).toBeInTheDocument();
    expect(screen.getByText(/Suggested Focus/i)).toBeInTheDocument();
  });

  it('allows switching report period kinds (Daily, Weekly, Monthly, Yearly)', async () => {
    const user = userEvent.setup();

    render(
      <ReflectionReportsView
        entries={[mockEntry]}
        currentUserId="user1"
      />
    );

    const monthlyBtn = screen.getByRole('button', { name: /monthly/i });
    await user.click(monthlyBtn);

    expect(screen.getByText(/MONTHLY REFLECTION REPORT/i)).toBeInTheDocument();
  });

  it('triggers source entry callback when source link is clicked', async () => {
    const user = userEvent.setup();
    const handleSelectEntry = vi.fn();

    render(
      <ReflectionReportsView
        entries={[mockEntry]}
        currentUserId="user1"
        onSelectEntry={handleSelectEntry}
      />
    );

    const sourceBtn = screen.getAllByTitle('View Source Journal Entry')[0];
    await user.click(sourceBtn);

    expect(handleSelectEntry).toHaveBeenCalledWith('entry_1');
  });

  it('allows regenerating the report when requested by user', async () => {
    const user = userEvent.setup();

    render(
      <ReflectionReportsView
        entries={[mockEntry]}
        currentUserId="user1"
      />
    );

    const regenBtn = screen.getByRole('button', { name: /Regenerate Report/i });
    await user.click(regenBtn);

    expect(screen.getByText(/AI Reflection Reports/i)).toBeInTheDocument();
  });
});
