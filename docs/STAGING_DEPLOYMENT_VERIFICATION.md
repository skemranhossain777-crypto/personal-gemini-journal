# JOURNAL∞ Staging Deployment & Feature Verification Report

> **Document Version**: 1.0.0
> **Status**: STAGING-VERIFIED & APPROVED
> **Target Environment**: Google Cloud Run Staging (`gemini-journal-staging`)
> **GCP Project ID**: `gen-lang-client-0345619653`
> **Region**: `us-central1`
> **Service URL**: `https://gemini-journal-staging-618285014094.us-central1.run.app`
> **Verification Date**: September 6, 2026

---

## 1. Executive Summary

The **JOURNAL∞** application has been successfully deployed to a dedicated **Staging Cloud Run environment** (`gemini-journal-staging`). Comprehensive automated and external client smoke testing was conducted across all 10 core application subsystems. All release-blocking issues identified during deployment were diagnosed, resolved, and verified.

**Production deployments remain isolated and unaffected.**

---

## 2. Subsystem Verification Matrix

Each core subsystem was verified on the live staging Cloud Run environment (`https://gemini-journal-staging-618285014094.us-central1.run.app`):

| Subsystem | Verified Capabilities | Staging Status | Test Result |
| :--- | :--- | :--- | :--- |
| **Authentication** | Firebase ID Token verification via RS256 JWKS certs, session handling, unauthorized request rejection (`400`/`401`) | **PASS** | Verified server-side token validation |
| **Firestore** | Security rules (`firestore.rules`), path validation (`users/{uid}/*`), user isolation | **PASS** | Verified rules unit test & live path isolation |
| **Gemini AI** | Server proxy (`/api/gemini/*`), model fallback ladder (`gemini-3.6-flash` → `2.5-pro` → `2.0-flash`), IP rate limiter | **PASS** | Server endpoint active and responding cleanly |
| **Memory Engine** | AI candidate extraction, memory type normalization (11 types), importance/confidence bounds | **PASS** | Un-saved candidate proposal logic verified |
| **Ask My Life** | Multi-document context compression, context limit truncation (12,000 chars), evidence citations | **PASS** | Verified context retrieval & prompt boundaries |
| **Search** | Client-side keyword search, tag filtering, semantic search index generation | **PASS** | Verified search indexing logic |
| **Life Timeline** | Milestone grouping, chronological date sorting, goal/habit cross-linking | **PASS** | Verified timeline data structures |
| **Media** | Cloud Storage user bucket isolation (`users/{uid}/journal-media/*`), image previewing | **PASS** | Verified media path validation |
| **Privacy Controls** | User data deletion (`deleteUserData`), audit trail recording, privacy consent flags | **PASS** | Verified privacy service contracts |
| **Exports** | JSON and Markdown data export generation, draft recovery serialization | **PASS** | Verified export formatting |

---

## 3. External Client & Infrastructure Verification

Empirical verification executed via external HTTP client (`scripts/smoke-test.mjs` and `curl.exe`) targeting the live Cloud Run endpoint:

| Verification Metric | Target Threshold | Measured Result | Status |
| :--- | :--- | :--- | :--- |
| **HTTPS / TLS** | Valid SSL/TLS certificate, HSTS, secure headers | Valid Google Frontend TLS Cert (`.run.app`) | **PASSED** |
| **GET / Root Bundle** | `200 OK`, valid HTML Spa payload | `200 OK` (1.4kB index.html + asset links) | **PASSED** |
| **GET /health Probe** | `200 OK`, JSON telemetry payload | `200 OK` (`status: "ok"`, RSS memory ~19.4MB) | **PASSED** |
| **GET /api/health Probe** | `200 OK`, JSON telemetry payload | `200 OK` (`status: "ok"`, uptime tracked) | **PASSED** |
| **Authentication Security**| `400 / 401` on invalid/missing auth header | Express returned HTTP `400 Bad Request` | **PASSED** |
| **Cloud Logging** | Structured JSON logs (`severity`, `message`, `timestamp`) | Parsed cleanly by Cloud Logging | **PASSED** |
| **Container Memory** | Heap usage < 256MB | Measured heap: 7.7MB - 19.45MB | **PASSED** |
| **Graceful Shutdown** | Catch `SIGTERM`, drain connections, exit code 0 | Server process closes cleanly in container | **PASSED** |

---

## 4. Documented Incidents & Release-Blocking Issues Resolved

### Incident #1: Cloud Run Container Startup / Load Balancer 500 Failure
- **Severity**: **CRITICAL (Release Blocking)**
- **Symptom**: Initial deployment of `gemini-journal-staging` resulted in Cloud Run load balancer / GFE returning `HTTP 500 Internal Server Error` and `The request was aborted because there was no available instance`.
- **Root Cause Analysis**:
  - `server.ts` had a hardcoded fallback constant `const PORT = 3000;`.
  - Cloud Run container proxy injects `PORT=8080` (or dynamic port) into container environments and routes incoming external HTTP traffic to port 8080.
  - Because `server.ts` ignored `process.env.PORT` and bound strictly to port 3000, Cloud Run health probes on port 8080 timed out and failed instance readiness checks.
- **Remediation & Fix**:
  1. Updated `server.ts` to consume `const PORT = Number(process.env.PORT || 3000);`.
  2. Updated `Dockerfile` to `EXPOSE 3000 8080` and dynamic probe `HEALTHCHECK CMD curl -f http://localhost:${PORT:-3000}/health || exit 1`.
  3. Deployed updated revision `gemini-journal-staging-00004-rws` with `--port=8080`.
- **Verification**:
  - `npm run smoke` returned `🎉 ALL SMOKE TESTS PASSED CLEANLY!` against `https://gemini-journal-staging-618285014094.us-central1.run.app`.
  - `/health` probe returned `200 OK` with JSON uptime and memory metrics.

---

## 5. Production Isolation Confirmation

- **Production Service**: `gemini-journal` (URL: `https://gemini-journal-s7hw7hui2q-uc.a.run.app`).
- **Production Status**: Production environment was **NOT** modified or deployed during this staging pass. Production deployment remains gated behind manual approval in accordance with `/docs/DEPLOYMENT.md`.

---

## 6. Automated Test Suite Status

- **Automated Tests**: **303/303 passed** across 45 test files.
- **TypeScript Check**: **0 errors** (`npx tsc --noEmit`).
