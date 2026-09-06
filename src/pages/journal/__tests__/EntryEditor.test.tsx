import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createDemoJournalStore, emptyDraft, type JournalStore } from '../../../journal';
import type { Collection, JournalEntry } from '../../../data';
import { EntryEditor } from '../EntryEditor';
import { expectAxeClean } from '../../../test/a11y';

function renderEditor(options: {
  store?: JournalStore;
  entryId?: string | null;
  serverEntry?: JournalEntry | null;
  collections?: Collection[];
  canUseCollections?: boolean;
} = {}) {
  const store = options.store ?? createDemoJournalStore('test-user');
  const onToggleCollection = vi.fn(async () => {});
  const onNavigateHome = vi.fn();
  const onDeleted = vi.fn();
  const utils = render(
    <EntryEditor
      store={store}
      attachmentStore={null}
      entryId={options.entryId ?? null}
      serverEntry={options.serverEntry ?? null}
      loading={false}
      collections={options.collections ?? []}
      canUseCollections={options.canUseCollections ?? false}
      onToggleCollection={onToggleCollection}
      onNavigateHome={onNavigateHome}
      onDeleted={onDeleted}
      autosaveDebounceMs={0}
    />,
  );
  return { store, onToggleCollection, onNavigateHome, onDeleted, ...utils };
}

describe('EntryEditor', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('focuses the composer and autosaves typed text', async () => {
    const user = userEvent.setup();
    const { store } = renderEditor();

    const body = screen.getByTestId('entry-body');
    expect(body).toHaveFocus();

    await user.type(body, 'The river was quiet.');
    await waitFor(() => expect(screen.getByTestId('entry-body')).toHaveValue('The river was quiet.'));
    await waitFor(() => expect(screen.getAllByText(/Saved/i).length).toBeGreaterThan(0));

    const rows = await store.list();
    expect(rows).toHaveLength(1);
    expect(rows[0].body).toBe('The river was quiet.');
    expect(rows[0].title).toBe('The river was quiet.');
  });

  it('persists mood, energy, and tags from the details panel into the saved entry', async () => {
    const user = userEvent.setup();
    const { store } = renderEditor();

    await user.click(screen.getByText('Details'));
    await user.click(screen.getByRole('radio', { name: '3' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Energy' }), { target: { value: '70' } });
    await user.type(screen.getByPlaceholderText(/Add a tag/), 'focus{Enter}');
    await user.type(screen.getByTestId('entry-body'), 'A reflective day');

    await waitFor(() => expect(screen.getAllByText(/Saved/i).length).toBeGreaterThan(0));
    const rows = await store.list();
    expect(rows).toHaveLength(1);
    expect(rows[0].mood).toBe(3);
    expect(rows[0].energy).toBe(70);
    expect(rows[0].tags).toEqual(['focus']);
  });

  it('surfaces a save error with a retry affordance, then auto-recovers', async () => {
    const user = userEvent.setup();
    const store = createDemoJournalStore('test-user');
    const originalCreate = store.create.bind(store);
    let failNext = true;
    store.create = async (input) => {
      if (failNext) throw new Error('backend unreachable');
      return originalCreate(input);
    };
    renderEditor({ store });

    await user.type(screen.getByTestId('entry-body'), 'hold this thought');
    await screen.findAllByText(/backend unreachable/i);
    expect(screen.getAllByRole('button', { name: /Retry/i }).length).toBeGreaterThan(0);

    // The engine auto-retries with backoff once the store works again.
    failNext = false;
    await waitFor(
      () => expect(screen.getAllByText(/Saved/i).length).toBeGreaterThan(0),
      { timeout: 4000 },
    );
    const rows = await store.list();
    expect(rows).toHaveLength(1);
    expect(rows[0].body).toBe('hold this thought');
  });

  it('flushes, confirms, and deletes an existing entry', async () => {
    const user = userEvent.setup();
    const store = createDemoJournalStore('test-user');
    const entry = await store.create({ ...emptyDraft(), title: 'Doomed', body: 'so long' });
    const { onDeleted } = renderEditor({ store, entryId: entry.id, serverEntry: entry });

    await screen.findByText('Doomed');
    await user.click(screen.getByRole('button', { name: 'Delete entry' }));
    await screen.findByText('Delete entry?');
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    await waitFor(async () => expect((await store.list())).toHaveLength(0));
  });

  it('recovers an in-flight draft on remount and saves it automatically', async () => {
    const user = userEvent.setup();

    // First session: saves never land, but every keystroke is mirrored to
    // localStorage before the store write even starts.
    const hangingStore = createDemoJournalStore('test-user');
    const originalCreate = hangingStore.create.bind(hangingStore);
    let releaseCreate: (() => void) | undefined;
    hangingStore.create = (input) =>
      new Promise((resolve) => {
        releaseCreate = () => void resolve(originalCreate(input));
      });

    const first = renderEditor({ store: hangingStore });
    await user.type(screen.getByTestId('entry-body'), 'words that must survive');
    await waitFor(() => expect(releaseCreate).toBeDefined());
    first.unmount();

    // Second session (e.g. after a refresh): the draft is recovered from local
    // storage and flushed to a working store without extra input.
    const healthyStore = createDemoJournalStore('test-user');
    renderEditor({ store: healthyStore });

    expect(await screen.findByText(/recovered unsent changes/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText(/Saved/i).length).toBeGreaterThan(0));
    const rows = await healthyStore.list();
    expect(rows).toHaveLength(1);
    expect(rows[0].body).toBe('words that must survive');
  });

  it('allows switching journal modes, inserting optional prompts, and returning to Free Write without losing text', async () => {
    const user = userEvent.setup();
    const { store } = renderEditor();

    // Select Morning Reflection mode
    await user.click(screen.getByTestId('mode-chip-morning'));

    // Check that Morning prompts panel is rendered
    expect(await screen.findByRole('region', { name: /Morning Reflection Optional Prompts/i })).toBeInTheDocument();

    // Insert the first morning prompt
    const insertBtns = screen.getAllByRole('button', { name: /Insert prompt:/i });
    await user.click(insertBtns[0]);

    // Body should now contain the inserted prompt
    const body = screen.getByTestId('entry-body');
    expect((body as HTMLTextAreaElement).value).toContain('What is your main intention');

    // Type additional thoughts
    await user.type(body, '\nFocus on deep work.');

    await waitFor(() => expect(screen.getAllByText(/Saved/i).length).toBeGreaterThan(0));
    let rows = await store.list();
    expect(rows[0].mode).toBe('morning');
    expect(rows[0].body).toContain('Focus on deep work.');

    // Switch back to Free Write
    await user.click(screen.getByTestId('mode-chip-free-write'));

    // Verify text is preserved and mode updated
    await waitFor(() => expect(screen.getAllByText(/Saved/i).length).toBeGreaterThan(0));
    rows = await store.list();
    expect(rows[0].mode).toBe('free-write');
    expect(rows[0].body).toContain('Focus on deep work.');
  });

  it('has no axe accessibility violations while composing and saving', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.type(screen.getByTestId('entry-body'), 'Typing away, with metadata to come.');
    await waitFor(() => expect(screen.getAllByText(/Saved/i).length).toBeGreaterThan(0));
    await expectAxeClean(document.body);
  }, 15000);
});
