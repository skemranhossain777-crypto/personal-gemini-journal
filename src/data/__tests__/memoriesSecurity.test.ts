import { describe, expect, it } from 'vitest';
import { validateMemoryInput } from '../validation';
import { assertSafeId } from '../paths';

describe('Personal Memory Engine — Security & Ownership Audits', () => {
  // 1. Valid Input Validation
  it('accepts valid memory inputs and validates schema integrity', () => {
    const validMemory = {
      type: 'project',
      title: 'Personal Memory Engine',
      narrative: 'Architected memory extraction pipeline with user review.',
      importance: 5,
      confidence: 0.95,
      sourceEntryIds: ['entry_12345'],
      tags: ['Architecture', 'Memory', 'AI'],
      saved: true,
      status: 'saved',
      occurredAt: { seconds: 1770000000, nanoseconds: 0 },
    };

    const result = validateMemoryInput(validMemory);
    expect(result.ok).toBe(true);
  });

  // 2. Reject Disallowed Extra Fields
  it('rejects memory objects containing unexpected or malicious injected fields', () => {
    const maliciousInput = {
      type: 'idea',
      title: 'Malicious Memory',
      narrative: 'Attempting field injection',
      importance: 3,
      confidence: 0.8,
      sourceEntryIds: ['entry_1'],
      tags: ['test'],
      saved: false,
      status: 'candidate',
      occurredAt: null,
      adminOverride: true, // Injected field
    };

    const result = validateMemoryInput(maliciousInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('fields that are not allowed');
    }
  });

  // 3. Document ID & Path Escapes Verification
  it('enforces strict document ID validation and blocks path traversal attempts', () => {
    expect(() => assertSafeId('valid_doc_123')).not.toThrow();
    expect(() => assertSafeId('../other_user_doc')).toThrow();
    expect(() => assertSafeId('users/victim/memories')).toThrow();
    expect(() => assertSafeId('__proto__')).toThrow();
  });

  // 4. Invalid Memory Type Enforcement
  it('rejects memories with invalid memory types outside the 11 allowed types', () => {
    const invalidTypeInput = {
      type: 'superpower', // Not an allowed MemoryType
      title: 'Invalid Type',
      narrative: 'Testing invalid type',
      importance: 3,
      confidence: 0.8,
      sourceEntryIds: ['entry_1'],
      tags: ['test'],
      saved: false,
      occurredAt: null,
    };

    const result = validateMemoryInput(invalidTypeInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('type is not a valid memory type');
    }
  });

  // 5. Bounds Validation for Importance and Confidence
  it('enforces numerical bounds for importance (1..5) and confidence (0..1)', () => {
    const invalidImportance = {
      type: 'goal',
      title: 'Out of Bounds Importance',
      narrative: 'Testing importance = 10',
      importance: 10,
      confidence: 0.8,
      sourceEntryIds: ['entry_1'],
      tags: ['test'],
      saved: false,
      occurredAt: null,
    };

    expect(validateMemoryInput(invalidImportance).ok).toBe(false);

    const invalidConfidence = {
      type: 'goal',
      title: 'Out of Bounds Confidence',
      narrative: 'Testing confidence = 2.5',
      importance: 3,
      confidence: 2.5,
      sourceEntryIds: ['entry_1'],
      tags: ['test'],
      saved: false,
      occurredAt: null,
    };

    expect(validateMemoryInput(invalidConfidence).ok).toBe(false);
  });
});
