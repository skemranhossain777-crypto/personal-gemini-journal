import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Timestamp } from 'firebase/firestore';
import { SemanticSearchView, SAMPLE_SEMANTIC_QUERIES } from '../SemanticSearchView';
import type { JournalEntry } from '../../../data/models';

describe('SemanticSearchView component', () => {
  const mockTimestamp = (isoString: string): Timestamp =>
    Timestamp.fromDate(new Date(isoString));

  const createEntry = (
    id: string,
    uid: string,
    title: string,
    body: string,
    tags: string[] = [],
    mood: number | null = null,
    isoString = '2026-09-01T10:00:00Z',
  ): JournalEntry => ({
    id,
    uid,
    title,
    body,
    mode: 'free-write',
    mood,
    energy: 80,
    tags,
    location: null,
    attachments: [],
    favorite: false,
    archived: false,
    private: false,
    aiMetadata: null,
    createdAt: mockTimestamp(isoString),
    updatedAt: mockTimestamp(isoString),
  });

  const entries = [
    createEntry('e1', 'user1', 'Morning Gratitude', 'Grateful for the sunrise and fresh coffee today.', ['gratitude', 'morning'], 5, '2026-09-01T10:00:00Z'),
    createEntry('e2', 'user1', 'Worried About Money', 'Feeling anxious about finances and the upcoming bill.', ['finance', 'worry'], 2, '2026-08-15T14:00:00Z'),
    createEntry('e3', 'user1', 'Productive Workday', 'Shipped the new feature and felt accomplished.', ['work', 'coding'], 4, '2026-09-05T09:00:00Z'),
  ];

  const onOpenEntry = vi.fn();

  it('renders the initial state with search input and sample queries', () => {
    render(
      <SemanticSearchView entries={[]} onOpenEntry={onOpenEntry} />
    );

    expect(screen.getByTestId('semantic-search-input')).toBeInTheDocument();
    expect(screen.getByText(/Semantic Journal Search/i)).toBeInTheDocument();
    const view = screen.getByTestId('semantic-search-view');
    expect(view.textContent).toContain('0');
    expect(view.textContent).toContain('matching entries');

    SAMPLE_SEMANTIC_QUERIES.forEach((q) => {
      expect(screen.getByText(`"${q}"`)).toBeInTheDocument();
    });
  });

  it('search input accepts typed text', async () => {
    const user = userEvent.setup();
    render(
      <SemanticSearchView entries={entries} onOpenEntry={onOpenEntry} />
    );

    const input = screen.getByTestId('semantic-search-input');
    await user.type(input, 'money');

    expect(input).toHaveValue('money');
  });

  it('displays matching results for a relevant query', async () => {
    const user = userEvent.setup();
    render(
      <SemanticSearchView entries={entries} onOpenEntry={onOpenEntry} />
    );

    const input = screen.getByTestId('semantic-search-input');
    await user.type(input, 'money');

    expect(screen.getByText('Worried About Money')).toBeInTheDocument();
    expect(screen.queryByText('Morning Gratitude')).not.toBeInTheDocument();
  });

  it('shows no-result state for non-matching query', async () => {
    const user = userEvent.setup();
    render(
      <SemanticSearchView entries={entries} onOpenEntry={onOpenEntry} />
    );

    const input = screen.getByTestId('semantic-search-input');
    await user.type(input, 'xyznonexistent');

    expect(screen.getByText(/No Matching Entries Found/i)).toBeInTheDocument();
  });

  it('filters by tag when a tag is selected via filters panel', async () => {
    const user = userEvent.setup();
    render(
      <SemanticSearchView entries={entries} onOpenEntry={onOpenEntry} />
    );

    // Open filters panel
    const filterBtn = screen.getAllByRole('button', { name: /Filters/i })[0];
    await user.click(filterBtn);

    // The Tag select is in the filter panel; find via the label text and then select sibling
    const selects = screen.getAllByRole('combobox');
    // selects order: Tag, Mood, Theme, Goal, Collection (5 selects)
    await user.selectOptions(selects[0], 'gratitude');

    expect(screen.getByText('Morning Gratitude')).toBeInTheDocument();
    expect(screen.queryByText('Worried About Money')).not.toBeInTheDocument();
    expect(screen.queryByText('Productive Workday')).not.toBeInTheDocument();
  });

  it('filters by mood when a mood is selected', async () => {
    const user = userEvent.setup();
    render(
      <SemanticSearchView entries={entries} onOpenEntry={onOpenEntry} />
    );

    const filterBtn = screen.getAllByRole('button', { name: /Filters/i })[0];
    await user.click(filterBtn);

    // Mood select is the 2nd combobox in the filter panel
    const selects = screen.getAllByRole('combobox');
    await user.selectOptions(selects[1], '5');

    expect(screen.getByText('Morning Gratitude')).toBeInTheDocument();
    expect(screen.queryByText('Worried About Money')).not.toBeInTheDocument();
  });

  it('filters by date range', async () => {
    const user = userEvent.setup();
    render(
      <SemanticSearchView entries={entries} onOpenEntry={onOpenEntry} />
    );

    const filterBtn = screen.getAllByRole('button', { name: /Filters/i })[0];
    await user.click(filterBtn);

    // Date inputs are not queryable by role — use the rendered DOM
    const dateInputs = document.querySelectorAll('input[type="date"]');
    const startDateInput = dateInputs[0] as HTMLInputElement;
    await user.type(startDateInput, '2026-09-01');

    expect(screen.getByText('Morning Gratitude')).toBeInTheDocument();
    expect(screen.getByText('Productive Workday')).toBeInTheDocument();
    expect(screen.queryByText('Worried About Money')).not.toBeInTheDocument();
  });

  it('clicking a sample query fills the search input', async () => {
    const user = userEvent.setup();
    render(
      <SemanticSearchView entries={entries} onOpenEntry={onOpenEntry} />
    );

    const sampleBtn = screen.getByText(`"${SAMPLE_SEMANTIC_QUERIES[1]}"`);
    await user.click(sampleBtn);

    const input = screen.getByTestId('semantic-search-input');
    expect(input).toHaveValue(SAMPLE_SEMANTIC_QUERIES[1]);
  });

  it('clicking a result calls onOpenEntry with the correct entry id', async () => {
    const user = userEvent.setup();
    render(
      <SemanticSearchView entries={entries} onOpenEntry={onOpenEntry} />
    );

    const input = screen.getByTestId('semantic-search-input');
    await user.type(input, 'money');

    const resultCard = screen.getByText('Worried About Money');
    await user.click(resultCard.closest('[class*="cursor-pointer"]')!);

    expect(onOpenEntry).toHaveBeenCalledWith('e2');
  });

  it('clear all filters resets the search', async () => {
    const user = userEvent.setup();
    render(
      <SemanticSearchView entries={entries} onOpenEntry={onOpenEntry} />
    );

    const input = screen.getByTestId('semantic-search-input');
    await user.type(input, 'money');

    // Verify result exists before clearing
    expect(screen.getByText('Worried About Money')).toBeInTheDocument();

    const clearBtn = screen.getByRole('button', { name: /Clear All Filters/i });
    await user.click(clearBtn);

    expect(input).toHaveValue('');
    expect(screen.getByText('Morning Gratitude')).toBeInTheDocument();
    expect(screen.getByText('Worried About Money')).toBeInTheDocument();
    expect(screen.getByText('Productive Workday')).toBeInTheDocument();
  });

  it('paginates when more than 6 results exist', async () => {
    const user = userEvent.setup();
    const manyEntries = Array.from({ length: 8 }, (_, i) =>
      createEntry(
        `e_${i}`,
        'user1',
        `Entry ${i}`,
        `Body text for entry ${i} about coding and work.`,
        ['work'],
        3,
        `2026-09-0${i + 1}T10:00:00Z`,
      ),
    );

    render(
      <SemanticSearchView entries={manyEntries} onOpenEntry={onOpenEntry} />
    );

    const input = screen.getByTestId('semantic-search-input');
    await user.type(input, 'work');

    // Page text appears in both summary and pagination — use getAllByText
    const pageTexts = screen.getAllByText(/Page 1 of 2/i);
    expect(pageTexts.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /Next/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Next/i }));
    const page2Texts = screen.getAllByText(/Page 2 of 2/i);
    expect(page2Texts.length).toBeGreaterThanOrEqual(1);
  });
});
