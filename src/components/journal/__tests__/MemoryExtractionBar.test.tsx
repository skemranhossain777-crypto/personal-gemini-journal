import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryExtractionBar } from '../MemoryExtractionBar';
import type { MemoryExtractionController } from '../../../journal/useMemoryExtraction';

function controller(overrides: Partial<MemoryExtractionController> = {}): MemoryExtractionController {
  return {
    phase: 'idle',
    candidatesCreated: 0,
    message: '',
    run: vi.fn(),
    isRunning: false,
    canRun: false,
    ...overrides,
  };
}

describe('MemoryExtractionBar UX states', () => {
  it('shows the running state while Gemini is reviewing', () => {
    render(<MemoryExtractionBar {...controller({ phase: 'running', isRunning: true })} />);
    expect(screen.getByTestId('memory-extraction-status')).toHaveTextContent(/reviewing this entry/i);
    expect(screen.queryByTestId('extract-memories-button')).not.toBeInTheDocument();
  });

  it('shows an optionality hint with the manual action for existing entries', async () => {
    const user = userEvent.setup();
    const run = vi.fn();
    render(
      <MemoryExtractionBar
        {...controller({ phase: 'idle', canRun: true, run })}
        hint="Memory extraction is optional and never changes your entry."
        onReviewCandidates={vi.fn()}
      />,
    );

    expect(screen.getByTestId('memory-extraction-hint')).toHaveTextContent(/optional/i);
    const extract = screen.getByTestId('extract-memories-button');
    await user.click(extract);
    expect(run).toHaveBeenCalledWith(true);
  });

  it('lands on the Memory Engine when "Review candidates" is clicked', async () => {
    const user = userEvent.setup();
    const onReviewCandidates = vi.fn();
    render(
      <MemoryExtractionBar
        {...controller({
          phase: 'success',
          candidatesCreated: 2,
          message: '2 memory candidates ready for your review.',
        })}
        onReviewCandidates={onReviewCandidates}
      />,
    );

    await user.click(screen.getByTestId('review-memory-candidates-button'));
    expect(onReviewCandidates).toHaveBeenCalledOnce();
  });

  it('does not offer the review shortcut when no candidates were found', () => {
    render(
      <MemoryExtractionBar
        {...controller({ phase: 'success', candidatesCreated: 0, message: 'No memory candidates found in this entry.' })}
        onReviewCandidates={vi.fn()}
      />,
    );

    expect(screen.getByTestId('memory-extraction-status')).toHaveTextContent(/No memory candidates/i);
    expect(screen.queryByTestId('review-memory-candidates-button')).not.toBeInTheDocument();
  });

  it('surfaces a safe failure message with a retry action', async () => {
    const user = userEvent.setup();
    const run = vi.fn();
    render(
      <MemoryExtractionBar
        {...controller({
          phase: 'error',
          canRun: true,
          message: 'Memory extraction failed. Please try again.',
          run,
        })}
      />,
    );

    expect(screen.getByTestId('memory-extraction-status')).toHaveTextContent(
      /Memory extraction failed. Please try again./,
    );
    const retry = screen.getByTestId('extract-memories-button');
    await user.click(retry);
    expect(run).toHaveBeenCalledWith(true);
  });
});