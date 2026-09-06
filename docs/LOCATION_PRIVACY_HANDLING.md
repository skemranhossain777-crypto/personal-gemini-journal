# Location Data Handling & Privacy Policy

## 1. Overview
The **JOURNAL∞** system supports optional location tagging for journal entries. Location data adds temporal and spatial context to personal reflections without compromising user privacy.

---

## 2. Core Privacy Principles

### Rule 1: Strictly Optional
- Location is never required to create or save a journal entry.
- The `location` field defaults to `null`.

### Rule 2: Zero Silent Collection
- The application **NEVER** silently queries or background-tracks user location (e.g. via automatic `navigator.geolocation` calls on page mount or background services).
- Acquiring current location strictly requires an explicit user action (clicking the "Use My Current Location" button).

### Rule 3: Precise Location Protection & Coarse Privacy Mode
- Users can enable **Coarse Precision Mode** (obfuscation), which rounds geographic coordinates to 2 decimal places (~1.1 km area resolution).
- When coarse precision is enabled or data is exported for non-private display, exact house numbers and street addresses are stripped.

### Rule 4: Data Storage & Authorization Boundaries
- Location objects (`placeName`, `address`, `lat`, `lng`) are stored exclusively inside the user's private Firestore subcollection document:
  `users/{uid}/journalEntries/{entryId}`
- Firestore security rules restrict reading and writing location data strictly to the authenticated `uid` owner (`request.auth.uid == uid`).

---

## 3. Google Maps Integration & Data Flow
- **Preview Integration**: Google Maps Embed / Search previews are loaded via standard HTTPS embeds (`https://www.google.com/maps?q=...&output=embed`).
- **No Third-Party Tracking**: Location search and coordinates are never broadcast to third-party telemetry or ad-tracking networks.
- **Third-Party Key Security**: API parameters are sanitized and query strings are HTML/URL encoded to prevent token leakage.

---

## 4. User Control Operations
Users maintain 100% control over location metadata:
- **Search & Select**: Search landmarks or custom places.
- **Edit**: Update place labels or addresses anytime.
- **Remove**: One-click deletion permanently sets `location` to `null` on the entry.
- **Coarse Obfuscation Toggle**: Toggle between exact coordinates and coarse area privacy mode at any time.
