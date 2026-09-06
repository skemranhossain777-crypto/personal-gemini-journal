import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JournalModeSelector } from '../JournalModeSelector';
import { JournalPromptsPanel } from '../JournalPromptsPanel';
import { expectAxeClean } from '../../../test/a11y';
import type { ReflectionMode } from '../../../data';

describe('JournalModeSelector & JournalPromptsPanel', () => {
  it('renders all 10 mode chips and calls onSelectMode when a chip is clicked', async () => {
    const user = userEvent.setup();
    const onSelectMode = vi.fn();

    render(<JournalModeSelector currentMode="free-write" onSelectMode={onSelectMode} />);

    expect(screen.getByRole('radiogroup', { name: /Journal Mode Selection/i })).toBeInTheDocument();

    const expectedModes: { id: ReflectionMode; name: string }[] = [
      { id: 'free-write', name: 'Free Write' },
      { id: 'morning', name: 'Morning Reflection' },
      { id: 'evening', name: 'Evening Reflection' },
      { id: 'deep', name: 'Deep Reflection' },
      { id: 'gratitude', name: 'Gratitude' },
      { id: 'idea', name: 'Idea Capture' },
      { id: 'goal', name: 'Goal Reflection' },
      { id: 'work', name: 'Work Journal' },
      { id: 'learning', name: 'Learning Journal' },
      { id: 'travel', name: 'Travel Journal' },
    ];

    for (const m of expectedModes) {
      expect(screen.getByTestId(`mode-chip-${m.id}`)).toBeInTheDocument();
    }

    await user.click(screen.getByTestId('mode-chip-morning'));
    expect(onSelectMode).toHaveBeenCalledWith('morning');
  });

  it('renders optional prompts panel for morning mode and handles prompt insertion', async () => {
    const user = userEvent.setup();
    const onInsertPrompt = vi.fn();
    const onSwitchToFreeWrite = vi.fn();

    render(
      <JournalPromptsPanel
        mode="morning"
        onInsertPrompt={onInsertPrompt}
        onSwitchToFreeWrite={onSwitchToFreeWrite}
      />,
    );

    expect(screen.getByRole('region', { name: /Morning Reflection Optional Prompts/i })).toBeInTheDocument();

    const insertButtons = screen.getAllByRole('button', { name: /Insert prompt:/i });
    expect(insertButtons.length).toBeGreaterThan(0);

    await user.click(insertButtons[0]);
    expect(onInsertPrompt).toHaveBeenCalled();

    const freeWriteButtons = screen.getAllByRole('button', { name: /Free Write/i });
    await user.click(freeWriteButtons[0]);
    expect(onSwitchToFreeWrite).toHaveBeenCalled();
  });

  it('collapses and expands the prompts panel when toggled', async () => {
    const user = userEvent.setup();
    render(<JournalPromptsPanel mode="evening" onInsertPrompt={vi.fn()} />);

    const toggleBtn = screen.getByRole('button', { name: /Toggle Evening Reflection optional prompts/i });
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');

    await user.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: /Insert prompt:/i })).not.toBeInTheDocument();

    await user.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('button', { name: /Insert prompt:/i }).length).toBeGreaterThan(0);
  });

  it('passes accessibility audits with zero axe violations', async () => {
    const { container } = render(
      <div>
        <JournalModeSelector currentMode="work" onSelectMode={vi.fn()} />
        <JournalPromptsPanel mode="work" onInsertPrompt={vi.fn()} onSwitchToFreeWrite={vi.fn()} />
      </div>,
    );

    await expectAxeClean(container);
  });
});
