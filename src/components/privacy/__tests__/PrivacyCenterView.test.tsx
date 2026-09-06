import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Timestamp } from 'firebase/firestore';
import { PrivacyCenterView } from '../PrivacyCenterView';
import type { JournalEntry, Memory, Goal } from '../../../data/models';

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

  it('renders data inventory metrics and privacy controls', () => {
    render(
      <PrivacyCenterView
        entries={[mockEntry]}
        memories={[mockMemory]}
        goals={[mockGoal]}
        currentUserId="user1"
      />
    );

    expect(screen.getByText(/Privacy & Data Governance Center/i)).toBeInTheDocument();
    expect(screen.getByText(/Your Data Inventory/i)).toBeInTheDocument();
    expect(screen.getByText(/Export My Data \(JSON\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Gemini AI Privacy Controls/i)).toBeInTheDocument();
  });

  it('triggers data export payload download when export button is clicked', async () => {
    const user = userEvent.setup();

    // Mock URL.createObjectURL and click
    const createObjectURLMock = vi.fn().mockReturnValue('blob:http://localhost/export.json');
    const revokeObjectURLMock = vi.fn();
    global.URL.createObjectURL = createObjectURLMock; global.URL.revokeObjectURL = revokeObjectURLMock;

    render(
      <PrivacyCenterView
        entries={[mockEntry]}
        memories={[mockMemory]}
        goals={[mockGoal]}
        currentUserId="user1"
      />
    );

    const exportBtn = screen.getByRole('button', { name: /Export My Data \(JSON\)/i });
    await user.click(exportBtn);

    expect(screen.getByText(/Your personal data export has been downloaded successfully/i)).toBeInTheDocument();
  });

  it('opens confirmation modal and executes memory deletion upon confirmation', async () => {
    const user = userEvent.setup();
    const handleUpdateMemories = vi.fn();

    render(
      <PrivacyCenterView
        entries={[mockEntry]}
        memories={[mockMemory]}
        goals={[mockGoal]}
        currentUserId="user1"
        onUpdateMemories={handleUpdateMemories}
      />
    );

    const deleteMemoriesBtn = screen.getByRole('button', { name: /Delete AI Memories/i });
    await user.click(deleteMemoriesBtn);

    expect(screen.getByText(/Confirm Delete AI Memories/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /Permanently Delete/i });
    await user.click(confirmBtn);

    expect(handleUpdateMemories).toHaveBeenCalledWith([]);
    expect(screen.getByText(/All AI memories have been permanently deleted/i)).toBeInTheDocument();
  });

  it('requires typing "DELETE" to execute full account deletion', async () => {
    const user = userEvent.setup();
    const handleAccountDeleted = vi.fn();

    render(
      <PrivacyCenterView
        entries={[mockEntry]}
        memories={[mockMemory]}
        goals={[mockGoal]}
        currentUserId="user1"
        onAccountDeleted={handleAccountDeleted}
      />
    );

    const deleteAccountBtn = screen.getByRole('button', { name: /Wipe Account Data Permanently/i });
    await user.click(deleteAccountBtn);

    expect(screen.getByText(/Permanently Delete Account Data/i)).toBeInTheDocument();

    const confirmInput = screen.getByPlaceholderText(/Type "DELETE" to confirm/i);
    await user.type(confirmInput, 'DELETE');

    const confirmBtn = screen.getByRole('button', { name: /Permanently Delete/i });
    await user.click(confirmBtn);

    expect(handleAccountDeleted).toHaveBeenCalled();
  });
});
