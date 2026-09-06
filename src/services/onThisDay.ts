import type { JournalEntry } from '../data/models';
import { toDate } from '../journal/format';

export interface OnThisDayGroup {
  yearsAgo: number;
  yearsAgoLabel: string;
  year: number;
  entries: JournalEntry[];
}

export interface ZonedDateParts {
  year: number;
  month: number; // 0..11
  day: number; // 1..31
}

/**
 * Checks if a given year is a leap year.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Extracts year, month (0..11), and day of month in specified timeZone (or local system timezone).
 */
export function getZonedDateParts(date: Date, timeZone?: string): ZonedDateParts {
  if (!timeZone) {
    return {
      year: date.getFullYear(),
      month: date.getMonth(),
      day: date.getDate(),
    };
  }

  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
    const parts = dtf.formatToParts(date);
    let year = date.getFullYear();
    let month = date.getMonth();
    let day = date.getDate();

    for (const p of parts) {
      if (p.type === 'year') year = parseInt(p.value, 10);
      if (p.type === 'month') month = parseInt(p.value, 10) - 1;
      if (p.type === 'day') day = parseInt(p.value, 10);
    }
    return { year, month, day };
  } catch {
    return {
      year: date.getFullYear(),
      month: date.getMonth(),
      day: date.getDate(),
    };
  }
}

/**
 * Returns human-readable emotional label for years ago.
 * e.g. 1 -> "One year ago today...", 2 -> "Two years ago..."
 */
export function getYearsAgoLabel(yearsAgo: number): string {
  switch (yearsAgo) {
    case 1:
      return 'One year ago today...';
    case 2:
      return 'Two years ago...';
    case 3:
      return 'Three years ago...';
    case 4:
      return 'Four years ago...';
    case 5:
      return 'Five years ago...';
    default:
      return `${yearsAgo} years ago...`;
  }
}

/**
 * Filters and groups historical journal entries matching the target date (month & day).
 *
 * Rules:
 * 1. Strictly enforces `entry.uid === currentUserId` to prevent cross-user data leakage.
 * 2. Excludes archived entries.
 * 3. Compares calendar month and day in target timezone.
 * 4. Handles leap year edge cases:
 *    - On Feb 28 in a non-leap year, includes Feb 29 entries from prior leap years.
 *    - On Feb 29 in a leap year, matches Feb 29 entries from prior leap years.
 */
export function getOnThisDayEntries(params: {
  entries: JournalEntry[];
  currentUserId: string;
  targetDate?: Date;
  timeZone?: string;
}): OnThisDayGroup[] {
  const { entries, currentUserId, targetDate = new Date(), timeZone } = params;

  const targetParts = getZonedDateParts(targetDate, timeZone);
  const groupsMap = new Map<number, JournalEntry[]>();

  for (const entry of entries) {
    // 1. Strict multi-user authorization check
    if (!entry.uid || entry.uid !== currentUserId) continue;

    // 2. Ignore archived entries
    if (entry.archived) continue;

    const entryDate = toDate(entry.createdAt);
    if (!entryDate) continue;

    const entryParts = getZonedDateParts(entryDate, timeZone);

    // Only historical entries (from previous years)
    if (entryParts.year >= targetParts.year) continue;

    // Check month and day match
    let isMatch = false;

    if (entryParts.month === targetParts.month && entryParts.day === targetParts.day) {
      isMatch = true;
    } else if (
      // Leap year fallback: Feb 29 entry matched on Feb 28 in a non-leap year
      targetParts.month === 1 &&
      targetParts.day === 28 &&
      !isLeapYear(targetParts.year) &&
      entryParts.month === 1 &&
      entryParts.day === 29
    ) {
      isMatch = true;
    }

    if (isMatch) {
      const yearsAgo = targetParts.year - entryParts.year;
      if (!groupsMap.has(yearsAgo)) {
        groupsMap.set(yearsAgo, []);
      }
      groupsMap.get(yearsAgo)!.push(entry);
    }
  }

  // Sort groups by yearsAgo ascending (1 year ago, 2 years ago, 3 years ago...)
  const sortedYearsAgo = Array.from(groupsMap.keys()).sort((a, b) => a - b);

  return sortedYearsAgo.map((yearsAgo) => {
    const groupEntries = groupsMap.get(yearsAgo)!;
    // Sort entries within group by createdAt descending
    groupEntries.sort((a, b) => {
      const ta = toDate(a.createdAt)?.getTime() || 0;
      const tb = toDate(b.createdAt)?.getTime() || 0;
      return tb - ta;
    });

    const entryYear = targetParts.year - yearsAgo;
    return {
      yearsAgo,
      yearsAgoLabel: getYearsAgoLabel(yearsAgo),
      year: entryYear,
      entries: groupEntries,
    };
  });
}
