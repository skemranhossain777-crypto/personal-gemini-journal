import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';
import { MemoryEngineView } from '../MemoryEngineView';
import type { Memory } from '../../../data/models';

function memory(overrides: Partial<Memory> = {}): Memory {
  return {
    id: 'mem_1',
    uid: 'user1',
    type: 'idea',
    title: 'The river was quiet',
    narrative: 'A quiet afternoon by the river.',
    importance: 3,
    confidence: 0.8,
    sourceEntryIds: ['entry_1'],
    tags: ['nature'],
    saved: true,
    status: 'saved',
    occurredAt: null,
    createdAt: Timestamp.fromDate(new Date()),
    updatedAt: Timestamp.fromDate(new Date()),
    ...overrides,
  };
}

function renderEngine(initialTab?: 'candidates' | 'saved' | 'ignored_forgotten' | 'all') {
  return render(
    <MemoryEngineView
      userId="user1"
      memories={[
        memory({ id: 'cand_1', title: 'Candidate memory title', saved: false, status: 'candidate' }),
        memory({ id: 'saved_1', title: 'Saved memory title' }),
        memory({ id: 'ignored_1', title: 'Ignored memory title', saved: false, status: 'ignored' }),
      ]}
      initialTab={initialTab}
    />,
  );
}

describe('MemoryEngineView tab selection', () => {
  it('defaults to the Saved Memories tab when no initialTab is provided', () => {
    renderEngine();

    expect(screen.getByText('Saved memory title')).toBeInTheDocument();
    expect(screen.queryByText('Candidate memory title')).not.toBeInTheDocument();
    expect(screen.queryByText('Ignored memory title')).not.toBeInTheDocument();
  });

  it('lands directly on the Candidates for Review tab when initialTab is provided', () => {
    renderEngine('candidates');

    expect(screen.getByText('Candidate memory title')).toBeInTheDocument();
    expect(screen.queryByText('Saved memory title')).not.toBeInTheDocument();
    expect(screen.queryByText('Ignored memory title')).not.toBeInTheDocument();
  });
});