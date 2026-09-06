import type { JournalEntry, Memory, Goal, Habit } from '../data/models';

export type ExportFormat = 'json' | 'markdown' | 'csv';

export interface ExportOptions {
  format: ExportFormat;
  includeMemories?: boolean;
  includeGoals?: boolean;
  includeHabits?: boolean;
  chunkSize?: number;
}

export interface ExportResult {
  filename: string;
  mimeType: string;
  content: string;
  itemCount: number;
  format: ExportFormat;
  exportedAt: string;
}

export class ExportError extends Error {
  constructor(message: string, public readonly code: 'UNAUTHORIZED' | 'INVALID_FORMAT' | 'EXPORT_FAILED') {
    super(message);
    this.name = 'ExportError';
  }
}

/**
 * Sanitizes text content to prevent CSV formula injection attacks (e.g. =1+1 or @cmd).
 */
export function sanitizeCsvField(field: unknown): string {
  if (field === null || field === undefined) return '""';
  let str = String(field);

  // Escaping quotes
  str = str.replace(/"/g, '""');

  // Prevent CSV injection if field starts with =, +, -, @, or tab/CR
  if (/^[=+@\-\t\r]/.test(str)) {
    str = `'${str}`;
  }

  return `"${str}"`;
}

/**
 * Generates JSON format export.
 */
export function generateJsonExport(params: {
  entries: JournalEntry[];
  memories: Memory[];
  goals: Goal[];
  habits: Habit[];
  currentUserId: string;
}): string {
  const { entries, memories, goals, habits, currentUserId } = params;

  // Strict user ownership check & strip secrets
  const cleanEntries = entries
    .filter((e) => (e as any).uid === currentUserId)
    .map(({ uid, ...rest }) => rest);

  const cleanMemories = memories
    .filter((m) => (m as any).uid === currentUserId)
    .map(({ uid, ...rest }) => rest);

  const cleanGoals = goals
    .filter((g) => (g as any).uid === currentUserId)
    .map(({ uid, ...rest }) => rest);

  const cleanHabits = habits
    .filter((h) => (h as any).uid === currentUserId)
    .map(({ uid, ...rest }) => rest);

  const payload = {
    schemaVersion: '1.0',
    exportPolicy: 'User-Scoped Private Export — Contains no infrastructure credentials or foreign user records.',
    exportedAt: new Date().toISOString(),
    userId: currentUserId,
    counts: {
      journalEntries: cleanEntries.length,
      memories: cleanMemories.length,
      goals: cleanGoals.length,
      habits: cleanHabits.length,
    },
    journalEntries: cleanEntries,
    memories: cleanMemories,
    goals: cleanGoals,
    habits: cleanHabits,
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Generates Markdown format export bundle.
 */
export function generateMarkdownExport(params: {
  entries: JournalEntry[];
  memories: Memory[];
  goals: Goal[];
  currentUserId: string;
}): string {
  const { entries, memories, goals, currentUserId } = params;

  const userEntries = entries.filter((e) => (e as any).uid === currentUserId);
  const userMemories = memories.filter((m) => (m as any).uid === currentUserId);
  const userGoals = goals.filter((g) => (g as any).uid === currentUserId);

  let md = `# JOURNAL∞ Personal Life Archive\n`;
  md += `**Exported At:** ${new Date().toLocaleString()}\n`;
  md += `**Total Journal Entries:** ${userEntries.length}\n\n`;

  md += `---\n\n## 📝 Journal Entries\n\n`;

  userEntries.forEach((e, idx) => {
    const title = e.title || `Untitled Entry ${idx + 1}`;
    const dateStr = e.createdAt?.toDate ? e.createdAt.toDate().toLocaleString() : 'Undated';
    const mode = e.mode || 'free-write';
    const tagsStr = (e.tags || []).map((t) => `#${t}`).join(' ');

    md += `### ${idx + 1}. ${title}\n`;
    md += `- **Date:** ${dateStr}\n`;
    md += `- **Reflection Mode:** ${mode}\n`;
    if (e.mood) md += `- **Mood Score:** ${e.mood}/5\n`;
    if (e.location) md += `- **Location:** ${e.location.placeName}${e.location.address ? ` (${e.location.address})` : ''}\n`;
    if (tagsStr) md += `- **Tags:** ${tagsStr}\n`;
    md += `\n${e.body}\n\n---\n\n`;
  });

  if (userMemories.length > 0) {
    md += `## 🧠 Personal Memories\n\n`;
    userMemories.forEach((m) => {
      md += `- **[${m.type.toUpperCase()}] ${m.title}:** ${m.narrative} (Importance: ${m.importance}/5)\n`;
    });
    md += `\n---\n\n`;
  }

  if (userGoals.length > 0) {
    md += `## 🎯 Personal Goals\n\n`;
    userGoals.forEach((g) => {
      md += `- **${g.title}:** ${g.description} — Status: ${g.status} (${g.progress}% complete)\n`;
    });
    md += `\n`;
  }

  return md;
}

/**
 * Generates CSV format export.
 */
export function generateCsvExport(params: {
  entries: JournalEntry[];
  currentUserId: string;
}): string {
  const { entries, currentUserId } = params;
  const userEntries = entries.filter((e) => (e as any).uid === currentUserId);

  const headers = ['ID', 'Title', 'Date', 'Mode', 'Mood', 'Energy', 'Tags', 'Location', 'Body'];
  let csv = headers.map(sanitizeCsvField).join(',') + '\n';

  userEntries.forEach((e) => {
    const dateStr = e.createdAt?.toDate ? e.createdAt.toDate().toISOString() : '';
    const tagsStr = (e.tags || []).join('; ');
    const locStr = e.location ? e.location.placeName : '';

    const row = [
      e.id,
      e.title || 'Untitled',
      dateStr,
      e.mode || 'free-write',
      e.mood ?? '',
      e.energy ?? '',
      tagsStr,
      locStr,
      e.body || '',
    ];

    csv += row.map(sanitizeCsvField).join(',') + '\n';
  });

  return csv;
}

/**
 * Handles async chunked export processing for large journals.
 */
export async function exportJournalDataAsync(params: {
  entries: JournalEntry[];
  memories?: Memory[];
  goals?: Goal[];
  habits?: Habit[];
  currentUserId: string;
  format: ExportFormat;
  onProgress?: (progressPercent: number) => void;
}): Promise<ExportResult> {
  const {
    entries,
    memories = [],
    goals = [],
    habits = [],
    currentUserId,
    format,
    onProgress,
  } = params;

  if (!currentUserId) {
    throw new ExportError('Security Violation: Unauthorized export attempt.', 'UNAUTHORIZED');
  }

  const userEntries = entries.filter((e) => (e as any).uid === currentUserId);
  const totalItems = userEntries.length;

  // Simulate chunked streaming for large journals (> 50 items)
  const chunkSize = 25;
  for (let i = 0; i < totalItems; i += chunkSize) {
    if (onProgress) {
      const pct = Math.min(100, Math.round(((i + chunkSize) / Math.max(1, totalItems)) * 100));
      onProgress(pct);
    }
    // Yield execution frame for UI responsiveness
    await new Promise((r) => setTimeout(r, 10));
  }

  if (onProgress) onProgress(100);

  const dateTag = new Date().toISOString().slice(0, 10);
  let content = '';
  let filename = '';
  let mimeType = '';

  if (format === 'json') {
    content = generateJsonExport({ entries, memories, goals, habits, currentUserId });
    filename = `JOURNAL_LIFE_EXPORT_${dateTag}.json`;
    mimeType = 'application/json';
  } else if (format === 'markdown') {
    content = generateMarkdownExport({ entries, memories, goals, currentUserId });
    filename = `JOURNAL_LIFE_EXPORT_${dateTag}.md`;
    mimeType = 'text/markdown';
  } else if (format === 'csv') {
    content = generateCsvExport({ entries, currentUserId });
    filename = `JOURNAL_LIFE_EXPORT_${dateTag}.csv`;
    mimeType = 'text/csv';
  } else {
    throw new ExportError(`Unsupported export format: ${format}`, 'INVALID_FORMAT');
  }

  return {
    filename,
    mimeType,
    content,
    itemCount: totalItems,
    format,
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Verifies exported content integrity.
 */
export function verifyExportIntegrity(content: string, format: ExportFormat): boolean {
  if (!content || content.trim().length === 0) return false;

  if (format === 'json') {
    try {
      const parsed = JSON.parse(content);
      return Boolean(parsed.schemaVersion && parsed.userId && Array.isArray(parsed.journalEntries));
    } catch {
      return false;
    }
  }

  if (format === 'markdown') {
    return content.includes('# JOURNAL∞ Personal Life Archive') && content.includes('Journal Entries');
  }

  if (format === 'csv') {
    return content.startsWith('"ID","Title"') || content.includes('"ID"');
  }

  return false;
}
