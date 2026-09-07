import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Timestamp } from 'firebase/firestore';
import { PrivacyCenterView } from '../PrivacyCenterView';
import {
  deleteAllJournalEntries,
  deleteAllMemories,
  deleteAllUserData,
} from '../../../services/privacyGovernance';
import type { JournalEntry, Memory, Goal } from '../../../data/models';
import type { JournalInteraction } from '../../../types';

vi.mock('../../../services/privacyGovernance', () => ({
  deleteAllJournalEntries: vi.fn(),
  deleteAllMemories: vi.fn(),
  deleteAllUserData: vi.fn(),
}));

describe('PrivacyCenterView component', () => {
  const mockEntry: JournalEntry = {
    id: 'entry_1',
    uid: 'user1',
    title: 'Personal Journal Entry',
    body: 'Reflecting on personal growth.',
    mode: 'free-write',
    mood: 4,
    energy: 80,
    tags: ['reflection'],
    location: null,
    attachments: [],
    favorite: false,
    archived: false,
    private: false,
    aiMetadata: null,
    createdAt: Timestamp.fromDate(new Date()),
    updatedAt: Timestamp.fromDate(new Date()),
  };

  const mockMemory: Memory = {
    id: 'mem_1',
    uid: 'user1',
    type: 'idea',
    title: 'App Idea',
    narrative: 'Create privacy-first AI journal',
    importance: 4,
    confidence: 0.9,
    sourceEntryIds: ['entry_1'],
    tags: ['app'],
    saved: true,
    occurredAt: Timestamp.fromDate(new Date()),
    createdAt: Timestamp.fromDate(new Date()),
    updatedAt: Timestamp.fromDate(new Date()),
  };

  const mockGoal: Goal = {
    id: 'goal_1',
    uid: 'user1',
    title: 'Master TypeScript',
    description: 'Learn advanced type patterns',
    status: 'active',
    progress: 70,
    targetDate: null,
    milestones: [],
    relatedEntryIds: ['entry_1'],
    tags: ['ts'],
    createdAt: Timestamp.fromDate(new Date()),
    updatedAt: Timestamp.fromDate(new Date()),
  };

  const mySession: JournalInteraction = {
    id: 'conv_1',
    userId: 'user1',
    title: 'Evening Reflection',
    mode: 'reflect',
    messages: [],
    summary: 'Calm wrap-up',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const foreignSession: JournalInteraction = { ...mySession, id: 'conv_2', userId: 'user2' };

  const renderView = (overrides: Partial<React.ComponentProps<typeof PrivacyCenterView>> = {}) =>
    render(
      <PrivacyCenterView
        entries={[mockEntry]}
        memories={[mockMemory]}
        goals={[mockGoal]}
        currentUserId="user1"
        aiSessions={[mySession, foreignSession]}
        {...overrides}
      />
    );

  it('renders data inventory metrics, counts only the owner\'s AI sessions, and shows honest copy', () => {
    renderView();

    expect(screen.getByText(/Privacy & Data Governance Center/i)).toBeInTheDocument();
    expect(screen.getByText(/Your Data Inventory/i)).toBeInTheDocument();
    expect(screen.getByText('AI Conversations', { exact: true })).toBeInTheDocument();

    const aiTile = screen
      .getByText('AI Conversations', { exact: true })
      .closest('div[class*="rounded-2xl"]');
    expect(aiTile).toHaveTextContent('1');
    expect(aiTile).not.toHaveTextContent('2');

    expect(screen.getByText(/How your data is used/i)).toBeInTheDocument();
    expect(screen.getByText(/Export My Data/i)).toBeInTheDocument();

    // The cosmetic, un-honored Gemini toggles must be gone.
    expect(screen.queryByText(/Gemini AI Privacy Controls/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/AI Writing & Reflection Assistance/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Exclude Private Entries from AI Context/i)).not.toBeInTheDocument();
  });

  it('opens the real multi-format export modal', async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole('button', { name: /Export My Data/i }));

    expect(await screen.findByText(/Export Personal Journal Archive/i)).toBeInTheDocument();
    expect(screen.getByText('JSON')).toBeInTheDocument();
    expect(screen.getByText('Markdown')).toBeInTheDocument();
    expect(screen.getByText('CSV')).toBeInTheDocument();
  });

  it('requires typing the exact word DELETE before journal deletion is confirmed', async () => {
    const user = userEvent.setup();
    vi.mocked(deleteAllJournalEntries).mockResolvedValueOnce({
      collection: 'journalEntries',
      deleted: 2,
      failed: 0,
    });
    renderView();

    await user.click(screen.getByRole('button', { name: /Delete Entries/i }));
    expect(await screen.findByText(/Delete all journal entries\?/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /Confirm Deletion/i });
    const confirmInput = screen.getByLabelText(/Type DELETE to confirm/i);
    expect(confirmBtn).toBeDisabled();

    await user.type(confirmInput, 'delete');
    expect(confirmBtn).toBeDisabled();

    await user.clear(confirmInput);
    await user.type(confirmInput, 'DELETE');
    expect(confirmBtn).toBeEnabled();

    await user.click(confirmBtn);

    expect(await screen.findByText(/2 journal entries permanently deleted/i)).toBeInTheDocument();
    expect(deleteAllJournalEntries).toHaveBeenCalledTimes(1);
  });

  it('reports when deletion partially fails instead of claiming success', async () => {
    const user = userEvent.setup();
    vi.mocked(deleteAllMemories).mockResolvedValueOnce({
      collection: 'memories',
      deleted: 1,
      failed: 1,
    });
    renderView();

    await user.click(screen.getByRole('button', { name: /Delete Memories/i }));
    await user.type(await screen.findByLabelText(/Type DELETE to confirm/i), 'DELETE');
    await user.click(screen.getByRole('button', { name: /Confirm Deletion/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Deletion incomplete — 1 item\(s\) could not be removed/i);
  });

  it('surfaces deletion failures with an error alert', async () => {
    const user = userEvent.setup();
    vi.mocked(deleteAllUserData).mockRejectedValueOnce(new Error('network down'));
    renderView();

    await user.click(screen.getByRole('button', { name: /Delete Everything/i }));
    await user.type(await screen.findByLabelText(/Type DELETE to confirm/i), 'DELETE');
    await user.click(screen.getByRole('button', { name: /Confirm Deletion/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Deletion failed: network down/i);
  });

  it('confirms full-delete copy states that the Google login is unaffected', async () => {
    const user = userEvent.setup();
    vi.mocked(deleteAllUserData).mockResolvedValueOnce([
      { collection: 'journalEntries', deleted: 1, failed: 0 },
      { collection: 'memories', deleted: 1, failed: 0 },
      { collection: 'interactions', deleted: 1, failed: 0 },
    ]);
    renderView();

    await user.click(screen.getByRole('button', { name: /Delete Everything/i }));
    expect(await screen.findByText(/It does NOT delete your Google login/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Type DELETE to confirm/i), 'DELETE');
    await user.click(screen.getByRole('button', { name: /Confirm Deletion/i }));

    expect(
      await screen.findByText(/3 across 3 collections\) was permanently deleted/i)
    ).toBeInTheDocument();
  });

  it('hides export and destructive actions entirely for demo sessions', () => {
    renderView({ isDemo: true, currentUserId: 'demo-local-user' });

    expect(screen.getByText(/You are exploring in demo mode/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Export My Data/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete Entries/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete Memories/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete Everything/i })).not.toBeInTheDocument();
  });
});