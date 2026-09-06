import { describe, expect, it, vi } from 'vitest';
import { GeminiService } from '../service';

function createMockGenAI(generateImpl: (params: any) => Promise<{ text: string }>) {
  return {
    models: {
      generateContent: vi.fn(generateImpl),
    },
  };
}

describe('Personal Memory Engine — AI Candidate Extraction & Validation', () => {
  // 1. Valid Candidate Extraction Test
  it('extracts memory candidates with valid JSON structure, importance, and confidence', async () => {
    const mockClient = createMockGenAI(async () => ({
      text: JSON.stringify({
        candidates: [
          {
            type: 'project',
            title: 'JOURNAL∞ Personal Memory Engine',
            narrative: 'Designed and implemented candidate extraction with user approval workflow.',
            importance: 5,
            confidence: 0.95,
          },
          {
            type: 'person',
            title: 'Team Lead Alex',
            narrative: 'Collaborated with Alex on memory architecture specification.',
            importance: 4,
            confidence: 0.88,
          },
        ],
      }),
    }));

    const service = new GeminiService({ apiKey: 'test-key' }, mockClient);
    const result = await service.extractMemoryCandidates({
      text: 'Today I launched the Personal Memory Engine with Alex.',
    });

    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0].type).toBe('project');
    expect(result.candidates[0].title).toBe('JOURNAL∞ Personal Memory Engine');
    expect(result.candidates[0].importance).toBe(5);
    expect(result.candidates[0].confidence).toBe(0.95);

    expect(result.candidates[1].type).toBe('person');
    expect(result.candidates[1].title).toBe('Team Lead Alex');
  });

  // 2. Critical Safety Rule: No Silent Auto-Save
  it('CRITICAL RULE: Candidate extraction returns un-saved proposals and NEVER auto-saves', async () => {
    const mockClient = createMockGenAI(async () => ({
      text: JSON.stringify({
        candidates: [
          {
            type: 'milestone',
            title: 'Architecture Upgrade Complete',
            narrative: 'Shipped Gemini integration.',
            importance: 4,
            confidence: 0.9,
          },
        ],
      }),
    }));

    const service = new GeminiService({ apiKey: 'test-key' }, mockClient);
    const result = await service.extractMemoryCandidates({
      text: 'Shipped architecture upgrade.',
    });

    // Candidates output from AI service are proposals only. They do not have saved=true.
    expect(result.candidates).toHaveLength(1);
    const candidate = result.candidates[0];

    // Verify candidate is an uncommitted object (no database ID, no saved flag)
    expect((candidate as any).saved).toBeUndefined();
    expect((candidate as any).id).toBeUndefined();
  });

  // 3. Normalization of Out-of-Bounds Values
  it('normalizes out-of-bounds importance (1..5) and confidence (0..1)', async () => {
    const mockClient = createMockGenAI(async () => ({
      text: JSON.stringify({
        candidates: [
          {
            type: 'goal',
            title: 'Over-rated Goal',
            narrative: 'Testing bounds',
            importance: 10, // Exceeds 5
            confidence: 1.5, // Exceeds 1.0
          },
          {
            type: 'lesson',
            title: 'Under-rated Lesson',
            narrative: 'Testing lower bounds',
            importance: -2, // Below 1
            confidence: -0.5, // Below 0.0
          },
        ],
      }),
    }));

    const service = new GeminiService({ apiKey: 'test-key' }, mockClient);
    const result = await service.extractMemoryCandidates({
      text: 'Testing boundary values.',
    });

    expect(result.candidates).toHaveLength(2);
    // 10 clamped to 5; 1.5 clamped to 1.0
    expect(result.candidates[0].importance).toBe(5);
    expect(result.candidates[0].confidence).toBe(1.0);

    // -2 clamped to 1; -0.5 clamped to 0.0
    expect(result.candidates[1].importance).toBe(1);
    expect(result.candidates[1].confidence).toBe(0.0);
  });

  // 4. Invalid Memory Type Fallback
  it('falls back to "idea" for unrecognized or invalid memory types', async () => {
    const mockClient = createMockGenAI(async () => ({
      text: JSON.stringify({
        candidates: [
          {
            type: 'unrecognized_magic_type',
            title: 'Unknown Type Memory',
            narrative: 'Testing invalid type mapping',
            importance: 3,
            confidence: 0.8,
          },
        ],
      }),
    }));

    const service = new GeminiService({ apiKey: 'test-key' }, mockClient);
    const result = await service.extractMemoryCandidates({
      text: 'Testing invalid memory type.',
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].type).toBe('idea');
  });

  // 5. All 11 Memory Types Support Test
  it('supports candidate extraction across all 11 valid memory types', async () => {
    const allTypes = [
      'person',
      'place',
      'project',
      'goal',
      'achievement',
      'important-event',
      'idea',
      'preference',
      'lesson',
      'milestone',
      'recurring-theme',
    ] as const;

    const mockCandidates = allTypes.map((t) => ({
      type: t,
      title: `Memory of type ${t}`,
      narrative: `Narrative for ${t}`,
      importance: 3,
      confidence: 0.85,
    }));

    const mockClient = createMockGenAI(async () => ({
      text: JSON.stringify({ candidates: mockCandidates }),
    }));

    const service = new GeminiService({ apiKey: 'test-key' }, mockClient);
    const result = await service.extractMemoryCandidates({
      text: 'Entry mentioning all 11 memory types.',
    });

    expect(result.candidates).toHaveLength(11);
    result.candidates.forEach((c, idx) => {
      expect(c.type).toBe(allTypes[idx]);
    });
  });
});
