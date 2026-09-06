import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  getOnThisDayEntries,
  getYearsAgoLabel,
  isLeapYear,
} from '../onThisDay';
import type { JournalEntry } from '../../data/models';

describe('onThisDay service', () => {
  const mockTimestamp = (isoString: string): Timestamp => {
    return Timestamp.fromDate(new Date(isoString));
  };

  const createEntry = (id: string, uid: string, isoString: string, title = 'Test Entry'): JournalEntry => ({
    id,
    uid,
    title,
    body: 'Sample journal body text.',
    mode: 'free-write',
    mood: 4,
    energy: 75,
    tags: ['test'],
    location: null,
    attachments: [],
    favorite: false,
    archived: false,
    private: false,
    aiMetadata: null,
    createdAt: mockTimestamp(isoString),
    updatedAt: mockTimestamp(isoString),
  });

  it('correctly identifies leap years', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2020)).toBe(true);
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(2025)).toBe(false);
    expect(isLeapYear(2026)).toBe(false);
    expect(isLeapYear(1900)).toBe(false);
  });

  it('generates emotional years-ago labels', () => {
    expect(getYearsAgoLabel(1)).toBe('One year ago today...');
    expect(getYearsAgoLabel(2)).toBe('Two years ago...');
    expect(getYearsAgoLabel(3)).toBe('Three years ago...');
    expect(getYearsAgoLabel(4)).toBe('Four years ago...');
    expect(getYearsAgoLabel(5)).toBe('Five years ago...');
    expect(getYearsAgoLabel(7)).toBe('7 years ago...');
  });

  it('handles leap year edge cases (Feb 29 entry matched on Feb 28 in non-leap year)', () => {
    // Entry created on Feb 29, 2024 (Leap Year)
    const feb29Entry = createEntry('e_leap', 'user1', '2024-02-29T12:00:00Z', 'Leap Day Memory');

    // 1. Target date: Feb 28, 2025 (Non-leap year)
    const targetFeb28_2025 = new Date('2025-02-28T12:00:00Z');
    const resultNonLeap = getOnThisDayEntries({
      entries: [feb29Entry],
      currentUserId: 'user1',
      targetDate: targetFeb28_2025,
      timeZone: 'UTC',
    });

    expect(resultNonLeap.length).toBe(1);
    expect(resultNonLeap[0].yearsAgo).toBe(1);
    expect(resultNonLeap[0].yearsAgoLabel).toBe('One year ago today...');
    expect(resultNonLeap[0].entries[0].id).toBe('e_leap');

    // 2. Target date: Feb 29, 2028 (Next leap year)
    const targetFeb29_2028 = new Date('2028-02-29T12:00:00Z');
    const resultLeap = getOnThisDayEntries({
      entries: [feb29Entry],
      currentUserId: 'user1',
      targetDate: targetFeb29_2028,
      timeZone: 'UTC',
    });

    expect(resultLeap.length).toBe(1);
    expect(resultLeap[0].yearsAgo).toBe(4);
    expect(resultLeap[0].yearsAgoLabel).toBe('Four years ago...');

    // 3. Target date: March 1, 2025 -> Should NOT match Feb 29 entry
    const targetMarch1_2025 = new Date('2025-03-01T12:00:00Z');
    const resultMarch1 = getOnThisDayEntries({
      entries: [feb29Entry],
      currentUserId: 'user1',
      targetDate: targetMarch1_2025,
      timeZone: 'UTC',
    });

    expect(resultMarch1.length).toBe(0);
  });

  it('handles timezone boundaries correctly', () => {
    // Entry created at 2025-09-05T23:30:00Z
    // In Tokyo (Asia/Tokyo, UTC+9), this is 2025-09-06 08:30:00 AM!
    // In New York (America/New_York, UTC-4), this is 2025-09-05 07:30:00 PM.
    const borderEntry = createEntry('e_tz', 'user1', '2025-09-05T23:30:00Z', 'Late Night Entry');

    // In Asia/Tokyo timezone, target date is 2026-09-06
    const targetTokyo = new Date('2026-09-06T00:00:00Z');
    const resultTokyo = getOnThisDayEntries({
      entries: [borderEntry],
      currentUserId: 'user1',
      targetDate: targetTokyo,
      timeZone: 'Asia/Tokyo',
    });

    expect(resultTokyo.length).toBe(1);
    expect(resultTokyo[0].entries[0].id).toBe('e_tz');

    // In America/New_York timezone, target date is 2026-09-05 (matching Sep 5)
    const targetNY = new Date('2026-09-05T12:00:00Z');
    const resultNY = getOnThisDayEntries({
      entries: [borderEntry],
      currentUserId: 'user1',
      targetDate: targetNY,
      timeZone: 'America/New_York',
    });

    expect(resultNY.length).toBe(1);
    expect(resultNY[0].entries[0].id).toBe('e_tz');
  });

  it('handles missing historical entries gracefully', () => {
    const entries = [
      createEntry('e1', 'user1', '2026-09-06T10:00:00Z'), // Today's entry (same year, not historical)
      createEntry('e2', 'user1', '2025-01-01T10:00:00Z'), // Different date
    ];

    const targetDate = new Date('2026-09-06T12:00:00Z');
    const result = getOnThisDayEntries({
      entries,
      currentUserId: 'user1',
      targetDate,
      timeZone: 'UTC',
    });

    expect(result.length).toBe(0);
  });

  it('handles multiple historical entries across years and within the same year', () => {
    const entries = [
      createEntry('e_2025_1', 'user1', '2025-09-06T08:00:00Z', 'Morning 2025'),
      createEntry('e_2025_2', 'user1', '2025-09-06T20:00:00Z', 'Evening 2025'),
      createEntry('e_2024_1', 'user1', '2024-09-06T14:00:00Z', 'Afternoon 2024'),
      createEntry('e_2023_1', 'user1', '2023-09-06T11:00:00Z', 'Morning 2023'),
    ];

    const targetDate = new Date('2026-09-06T12:00:00Z');
    const result = getOnThisDayEntries({
      entries,
      currentUserId: 'user1',
      targetDate,
      timeZone: 'UTC',
    });

    expect(result.length).toBe(3);

    // Group 1: 1 year ago (2025)
    expect(result[0].yearsAgo).toBe(1);
    expect(result[0].yearsAgoLabel).toBe('One year ago today...');
    expect(result[0].entries.length).toBe(2);

    // Group 2: 2 years ago (2024)
    expect(result[1].yearsAgo).toBe(2);
    expect(result[1].yearsAgoLabel).toBe('Two years ago...');

    // Group 3: 3 years ago (2023)
    expect(result[2].yearsAgo).toBe(3);
    expect(result[2].yearsAgoLabel).toBe('Three years ago...');
  });

  it('NEVER reveals entries belonging to another user (multi-user privacy)', () => {
    const entries = [
      createEntry('e_user1', 'user1', '2025-09-06T10:00:00Z', 'User 1 Memory'),
      createEntry('e_user2', 'user2', '2025-09-06T10:00:00Z', 'User 2 Secret Memory'),
    ];

    const targetDate = new Date('2026-09-06T12:00:00Z');
    const result = getOnThisDayEntries({
      entries,
      currentUserId: 'user1',
      targetDate,
      timeZone: 'UTC',
    });

    expect(result.length).toBe(1);
    expect(result[0].entries.length).toBe(1);
    expect(result[0].entries[0].id).toBe('e_user1');
  });
});
