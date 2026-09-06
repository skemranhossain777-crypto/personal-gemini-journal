# JOURNAL∞ — Personal Memory & AI Reflection Engine 🏆

> **Google Cloud & Gemini Hackathon Competition Candidate**  
> **Live Staging URL:** [https://gemini-journal-staging-s7hw7hui2q-uc.a.run.app](https://gemini-journal-staging-s7hw7hui2q-uc.a.run.app)  
> **Documentation Hub:** [`/docs/`](docs/) · **5-Minute Demo Script:** [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) · **Judge Tour:** Interactive 5-tab tour available directly on the landing page header.

---

## 📌 Executive Summary & Product Vision

### The Problem
Traditional journaling apps are passive data graveyards. People write daily thoughts, goal commitments, emotional struggles, and key life milestones—only for those entries to sink into forgotten archives. Existing AI note tools either treat notes as disposable search indexes or use invasive background LLMs that automatically mutate user memories, risk prompt injection attacks, or suffer from severe AI hallucinations.

### The Solution: JOURNAL∞
**JOURNAL∞** is a secure, personal wisdom engine powered by **Google Gemini 2.5 Flash** and **Google Cloud Run**. It transforms raw daily reflections into a structured personal knowledge graph—extracting memory candidates across 11 typed domains, enabling conversational multi-document RAG over years of journal history (*Ask My Life*), and providing an empathetic 8-dimension reflection loop (*AI Reflection Loop*).

### Fundamental Design Principle: Zero Untrusted AI Mutations
Unlike other AI systems, **JOURNAL∞** enforces strict human agency: **the AI *proposes* memory candidates, but only the user can approve, edit, or commit them to permanent storage.**

---

## 🌟 The Three Signature Experiences

### 1. Personal Memory Engine 🧠
- **11 Typed Memory Domains**: Automatically extracts structured candidates for `goal`, `habit`, `preference`, `relationship`, `insight`, `emotion`, `location`, `skill`, `value`, `milestone`, and `idea`.
- **Normalized Scores**: Scores every extraction on a 1–5 importance scale and 0–1 confidence rating.
- **Human-in-the-Loop Approval**: Extracted memories land as un-saved proposals (`saved: false`). Write operations require explicit user approval.

### 2. Ask My Life RAG Retrieval 💬
- **Conversational RAG**: Query your personal life history naturally (e.g., *"What recurring obstacles held me back last month?"* or *"How has my energy shifted since starting morning walk habits?"*).
- **Context Compression**: RAG pipeline compresses entry reflections under 12,000 characters to optimize token context and response latency.
- **Grounded Evidence & Quotes**: Returns answers backed by explicit quote citations and entry timestamps. Reports *Insufficient Evidence* if a fact is absent from the journal rather than hallucinating.

### 3. AI Reflection Loop 🔄
- **8 Structured Dimensions**: Generates deep reflections covering *Emotional Tone*, *Key Themes*, *Victories*, *Obstacles*, *Habit Signals*, *Goal Progress*, *Unconscious Patterns*, and *Actionable Advice*.
- **10 Journaling Modes**: Specialized prompts for *Free Write*, *Morning Clarity*, *Evening Unwind*, *Gratitude*, *Problem Solving*, *Goal Review*, *Habit Audit*, *Emotional Processing*, *Decision Making*, and *Weekly Reflection*.
- **Multimodal Journaling**: Supports native audio voice transcription and image context analysis via Gemini.

---

## 🏛️ System Architecture

```
                                  [ Browser / Client SPA ]
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       ▼                                           ▼
             [ Firebase Hosting ]                         [ Express Server ]
           (Vite Built React SPA)                       (Google Cloud Run)
                       │                                           │
                       ▼                                           ▼
             [ Cloud Firestore ]                        [ Secret Manager ]
         (Row-Level Security Rules)                 (GEMINI_API_KEY / Credentials)
         `request.auth.uid == userId`                              │
                       │                                           ▼
                       └─────────────────────────────────► [ Gemini 2.5 Flash ]
                                                    (5-Model Fallback Ladder)
```

### Technology Stack
- **Frontend**: React 18, TypeScript, TailwindCSS, Motion (Framer Motion), Lucide Icons, Vite.
- **Backend API**: Node 22, Express, Google Cloud Client Libraries (`@google/genai`, `@google-cloud/secret-manager`, `@google-cloud/logging`).
- **Database & Auth**: Google Cloud Firestore, Firebase Authentication (Google Sign-In, RS256 JWT tokens).
- **Deployment**: Google Cloud Run (Containerized Docker microservice), Firebase Hosting CDN.

---

## 🤖 Gemini 2.5 Integration & Fallback Ladder

JOURNAL∞ utilizes **Gemini 2.5 Flash** for high-speed, structured multimodal generation and 1M context window capability.

### 5-Model Automated Fallback Ladder
To guarantee 99.99% availability during peak LLM API traffic, the server implements an automated fallback ladder:
1. `gemini-3.7-flash` (Primary high-performance reasoning)
2. `gemini-3.6-flash` (Secondary fallback)
3. `gemini-3.5-flash` (Tertiary fallback)
4. `gemini-flash-latest` (Quaternary fallback)
5. `gemini-3.1-flash-lite` (Final lightweight contingency)

### 9 Companion AI Skills
The backend exposes 9 specialized companion capabilities:
`reflect` · `challenge` · `coach` · `summarize` · `explore` · `remember` · `connect` · `reframe` · `celebrate`

---

## 🛡️ Security, Privacy, & OWASP Defenses

JOURNAL∞ adheres to strict agentic security engineering principles:

| Threat Vector | Defense Implementation | Verification |
| :--- | :--- | :--- |
| **Indirect Prompt Injection** | Retrieved journal context is wrapped in explicit `<RETRIEVED_CONTENT>` XML tags and marked as untrusted data in system instructions. System role prompts prohibit instruction overrides. | Tested via [`aiSecurityAdversarial.test.ts`](file:///D:/Apersonontherun/Google-Programmed/gemini-journal-reflections/server/gemini/__tests__/aiSecurityAdversarial.test.ts) |
| **Cross-User Data Leakage** | Firestore security rules enforce `request.auth.uid == userId` on all document paths (`/users/{uid}/journalEntries/{id}`). | Verified via [`memoriesSecurity.test.ts`](file:///D:/Apersonontherun/Google-Programmed/gemini-journal-reflections/src/data/__tests__/memoriesSecurity.test.ts) |
| **Unauthorized Memory Creation** | Candidate extractions return un-saved proposals (`saved: false`, `status: 'candidate'`). Write access to `/memories/{id}` requires explicit user confirmation. | Verified via [`memoryAiValidation.test.ts`](file:///D:/Apersonontherun/Google-Programmed/gemini-journal-reflections/server/gemini/__tests__/memoryAiValidation.test.ts) |
| **Secret Protection** | `GEMINI_API_KEY` and server credentials reside exclusively in **Google Cloud Secret Manager**. Zero client-side API keys. | Verified via Secret Manager Integration Audit |
| **Data Ownership & Export** | 1-click complete data export in JSON and Markdown formats, plus 1-click full account data wipe. | Verified via [`PrivacyCenterView.test.tsx`](file:///D:/Apersonontherun/Google-Programmed/gemini-journal-reflections/src/components/privacy/__tests__/PrivacyCenterView.test.tsx) |

---

## ⚙️ Local Development Setup

### Prerequisites
- Node.js `20.x` or `22.x`
- npm `10.x`
- Google Cloud Project with Gemini API & Cloud Run enabled

### Installation Steps

1. **Clone the repository**:
   ```bash
   git clone https://github.com/skemranhossain777-crypto/personal-gemini-journal.git
   cd personal-gemini-journal
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env.local` and add your development keys:
   ```bash
   cp .env.example .env.local
   ```
   *Note: In production environments, server secrets are loaded directly from Google Cloud Secret Manager.*

4. **Run the local development server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` to explore the SPA.

---

## 🧪 Comprehensive Automated Test Suite

JOURNAL∞ features 100% test passing across **303 automated tests** in **45 test files**:

```bash
# Execute full Vitest test suite
npm test -- --run

# Execute TypeScript typecheck
npx tsc --noEmit
```

### Test Coverage Highlights
- **Auth Boundary**: Sign-in, token validation, redirect handling, session persistence.
- **Journal CRUD & Draft Engine**: Autosave debouncing, crash recovery, tag filtering, attachment management.
- **Memory Engine & Validation**: Domain categorization, candidate approval, out-of-bounds normalization.
- **Ask My Life & AI RAG**: Citation parsing, context compression, hallucination defenses.
- **Adversarial Security Suite**: Indirect prompt injection, context poisoning, model failure recovery.

---

## 🚀 Cloud Run Production Deployment

The application is fully containerized and ready for Google Cloud Run deployment.

### 1. Build Production Container Locally
```bash
docker build -t gcr.io/YOUR_PROJECT_ID/gemini-journal:latest .
```

### 2. Run Container Locally for Verification
```bash
docker run -p 8080:8080 -e PORT=8080 -e NODE_ENV=production gcr.io/YOUR_PROJECT_ID/gemini-journal:latest
```

### 3. Deploy Container to Cloud Run
```bash
gcloud run deploy gemini-journal-staging \
  --image gcr.io/YOUR_PROJECT_ID/gemini-journal:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest
```

For complete deployment details and rollback procedures, consult [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## 🎬 5-Minute Competition Demo

Judges can evaluate JOURNAL∞ in five minutes using the predictable demonstration path:

1. **Instant Demo Launch**: Click **🏆 Try Instant Demo (5-Min Tour)** on the landing page header.
2. **Create Entry**: Write or choose a sample entry in the editor.
3. **AI Reflection**: Trigger real-time Gemini AI Reflection.
4. **Memory Candidate**: Review proposed un-saved memory candidates.
5. **Approve Memory**: Approve candidate into personal memory store.
6. **Ask My Life**: Ask *"What milestone did we achieve today with Gemini?"*.
7. **Evidence Answer**: Review grounded citations and quotes.
8. **Timeline**: Explore the chronological Life Timeline.
9. **Privacy Center**: Review OWASP security defenses and export options.

*For complete speaking points and presenter instructions, see [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md).*

---

## 📚 Complete Documentation Sitemap

- [**`docs/ARCHITECTURE.md`**](docs/ARCHITECTURE.md) — Technical System Architecture & System Topology
- [**`docs/GEMINI_ARCHITECTURE.md`**](docs/GEMINI_ARCHITECTURE.md) — Gemini 2.5 Integration, RAG Pipeline, & Fallback Ladder
- [**`docs/SECURITY_AUDIT.md`**](docs/SECURITY_AUDIT.md) — Comprehensive Security Audit & OWASP Defense Report
- [**`docs/AI_SECURITY_AUDIT.md`**](docs/AI_SECURITY_AUDIT.md) — Adversarial AI Threat Vectors & Prompt Injection Immunity
- [**`docs/TESTING.md`**](docs/TESTING.md) — Automated Test Suite & Accessibility Verification
- [**`docs/DEPLOYMENT.md`**](docs/DEPLOYMENT.md) — Cloud Run Containerization & Staging CI/CD Pipeline
- [**`docs/DEMO_SCRIPT.md`**](docs/DEMO_SCRIPT.md) — Predictable 5-Minute Hackathon Demo Script
- [**`docs/DESIGN_SYSTEM.md`**](docs/DESIGN_SYSTEM.md) — UI Component Tokens & Aesthetic Guidelines
- [**`docs/AUTHENTICATION.md`**](docs/AUTHENTICATION.md) — Firebase Auth Boundary & JWT Public Key Rules
- [**`docs/RELEASE_CANDIDATE.md`**](docs/RELEASE_CANDIDATE.md) — Release Candidate Readiness Matrix & Evaluation

---

<p center>
Built with ❤️ using <strong>Google Cloud Run</strong> and <strong>Google Gemini 2.5</strong>.
</p>
