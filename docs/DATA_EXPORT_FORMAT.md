# User Data Export Specifications & Policy

## 1. Overview
The **JOURNAL∞** Data Export System enables users to export their complete personal journal history, memories, goals, habits, and preferences in open, standard formats.

---

## 2. Supported Formats

### 1. JSON (`.json`)
- **Use Case**: Full structured machine-readable backup and migration.
- **Fields Included**:
  - `schemaVersion`: Version tag (`1.0`)
  - `exportedAt`: ISO-8601 timestamp
  - `userId`: User identifier
  - `journalEntries`: Array of entries with title, body, mode, mood, energy, tags, location, attachments
  - `memories`: Array of extracted personal memories with provenance
  - `goals`: Array of personal goals and milestones
  - `habits`: Array of habits and completion logs
- **Security Safeguards**: User-scoped data strictly (`uid === currentUserId`). All server infrastructure keys, API tokens, and internal database metadata are excluded.

### 2. Markdown (`.md`)
- **Use Case**: Human-readable archive formatted for Obsidian, Notion, or text editors.
- **Formatting**:
  - `# JOURNAL∞ Personal Life Archive` header
  - Entry sections with titles, dates, reflection modes, mood scores, location labels, tags, and full body prose.
  - Formatted sections for Personal Memories and Goals.

### 3. CSV (`.csv`)
- **Use Case**: Spreadsheet analysis in Excel, Google Sheets, or Numbers.
- **Columns**: `ID, Title, Date, Mode, Mood, Energy, Tags, Location, Body`
- **Security & Injection Protection**:
  - All text cells are wrapped in double quotes with double-quote escaping.
  - Formula injection strings starting with `=, +, -, @` are prepended with a single quote `'` to prevent command execution in spreadsheet applications.

---

## 3. Security & Privacy Policy
- **Zero Leakage**: Exports never contain records from other users, system secrets, API keys, or infrastructure deployment metadata.
- **Asynchronous Chunking**: Large journals (> 50 items) are processed asynchronously in chunked streaming execution frames to maintain client responsiveness.
- **Integrity Verification**: Downloads are validated for schema structure and completeness before delivery.
