import { useCallback, useEffect, useRef, useState } from 'react';
import type { JournalEntry } from '../data';
import {
  runMemoryExtraction,
  type MemoryPipelineDeps,
} from '../services/memoryPipeline';

/**
 * React adapter over the memory extraction pipeline.
 *
 * Drives the UI states required by the lifecycle: idle (no candidates yet),
 * running (loading), success (candidates available / none found), and error
 * (extraction failed, retry available). Auto-triggers once per new saved entry
 * (`autoExtract`), and exposes a manual `run(force)` for retries and for
 * existing entries that predate the feature.
 */
export type MemoryExtractionPhase = 'idle' | 'running' | 'success' | 'error';

export interface MemoryExtractionController {
  phase: MemoryExtractionPhase;
  candidatesCreated: number;
  modelUsed?: string;
  message: string;
  run: (force?: boolean) => void;
  isRunning: boolean;
  canRun: boolean;
}

export function useMemoryExtraction(
  entry: JournalEntry | null,
  options: { autoExtract?: boolean; deps?: MemoryPipelineDeps } = {}
): MemoryExtractionController {
  const { autoExtract = false, deps } = options;
  const [phase, setPhase] = useState<MemoryExtractionPhase>('idle');
  const [candidatesCreated, setCandidatesCreated] = useState(0);
  const [modelUsed, setModelUsed] = useState<string | undefined>(undefined);
  const [message, setMessage] = useState('');

  const entryRef = useRef(entry);
  entryRef.current = entry;
  const autoRanRef = useRef<string | null>(null);

  const run = useCallback(
    async (force = false) => {
      const current = entryRef.current;
      if (!current) return;
      setPhase('running');
      setMessage('');
      const report = await runMemoryExtraction(current, { force, deps });
      if (report.status === 'done') {
        setCandidatesCreated(report.created.length);
        setModelUsed(report.modelUsed);
        setPhase('success');
        setMessage(
          report.created.length > 0
            ? `${report.created.length} memory candidate${report.created.length === 1 ? '' : 's'} ready for your review.`
            : 'No memory candidates found in this entry.'
        );
      } else if (report.status === 'duplicate' || report.status === 'empty' || report.status === 'demo') {
        setCandidatesCreated(0);
        setPhase('idle');
        setMessage('');
      } else {
        setCandidatesCreated(0);
        setPhase('error');
        setMessage(report.message);
      }
    },
    [deps]
  );

  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    if (!entry || !autoExtract || autoRanRef.current === entry.id) return;
    autoRanRef.current = entry.id;
    void runRef.current();
  }, [entry, autoExtract]);

  return {
    phase,
    candidatesCreated,
    modelUsed,
    message,
    run,
    isRunning: phase === 'running',
    canRun: !!entry && phase !== 'running',
  };
}