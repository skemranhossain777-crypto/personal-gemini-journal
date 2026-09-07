# JOURNAL∞ Production Deployment & CI/CD Documentation

> **Document Version**: 1.0.0
> **Status**: production-ready & VERIFIED
> **Target Environment**: GitHub Actions / Google Cloud Run / GCP Secret Manager
> **Last Verified**: September 6, 2026

---

## 1. Executive Summary

This document details the production CI/CD architecture and operational deployment guidelines for **JOURNAL∞**. The deployment pipeline enforces a strict 13-stage verification sequence via GitHub Actions. **Untested or failing builds are strictly blocked from reaching production.** Production deployments require mandatory manual review approval following successful deployment and automated smoke testing in the staging environment.

---

## 2. CI/CD Pipeline Architecture ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml))

The GitHub Actions workflow executes 13 mandatory pipeline steps across 4 isolated job stages:

```
[ Commit / PR to main ]
          │
          ▼
 ┌────────────────────────────────────────────────────────┐
 │ STAGE 1: Validation & Testing (Jobs 1-8)               │
 │  1. Install dependencies (npm ci)                      │
 │  2. Dependency validation (npm audit)                  │
 │  3. Codebase Linting (npm run lint)                    │
 │  4. TypeScript Typecheck (npm run typecheck)           │
 │  5. Unit Tests (vitest unit suite)                     │
 │  6. Integration Tests (vitest integration suite)       │
 │  7. Security Tests (vitest security matrix & AI tests)  │
 │  8. Production Application Build (npm run build)        │
 └────────────────────────────────────────────────────────┘
          │ (Passes)
          ▼
 ┌────────────────────────────────────────────────────────┐
 │ STAGE 2: Container Build & Vulnerability Scan (9-10)   │
 │  9. Multi-stage Docker Container Build                 │
 │ 10. Container Vulnerability Scan (Trivy CVE Scan)      │
 └────────────────────────────────────────────────────────┘
          │ (Passes)
          ▼
 ┌────────────────────────────────────────────────────────┐
 │ STAGE 3: Staging Deployment & Smoke Tests (11-12)      │
│ 11. Deploy Container to Cloud Run (gemini-journal-staging)    │
│ 12. Automated Staging Smoke Tests (npm run smoke)       │
 └────────────────────────────────────────────────────────┘
          │ (Passes)
          ▼
 ┌────────────────────────────────────────────────────────┐
 │ STAGE 4: Production Deployment Approval Gate (13)     │
 │ 🛑 MANUAL APPROVAL REQUIRED (GitHub Environment Gate)  │
 │  13. Deploy to Cloud Run Production & Prod Smoke Test  │
 └────────────────────────────────────────────────────────┘
```

---

## 3. Pipeline Step Specifications

### 3.1 Stage 1: Validation & Testing
1. **Install Dependencies (`npm ci`)**: Installs exact, reproducible package locks in a clean environment.
2. **Dependency Validation (`npm audit`)**: Audits package tree for known security vulnerabilities (`CRITICAL` and `HIGH` severity block build).
3. **Lint (`npm run lint`)**: Validates code style and static syntax.
4. **Typecheck (`npm run typecheck`)**: Executes `npx tsc --noEmit` to guarantee 0 TypeScript compilation errors.
5. **Unit Tests**: Executes isolated unit tests (`journal-crud-offline.test.ts`, `autosave-recovery.test.ts`).
6. **Integration Tests**: Executes end-to-end integration flows (`automated-suite.test.ts`, `timeline-goals-habits.test.ts`).
7. **Security Tests**: Runs security matrix and AI prompt injection test suites (`security-matrix.test.ts`, `ai-security.test.ts`).
8. **Production Build (`npm run build`)**: Compiles production frontend bundle and server bundle (`dist/server.cjs`).

### 3.2 Stage 2: Container Build & Vulnerability Scanning
9. **Container Build**: Builds non-root multi-stage Docker image tagged with `$GITHUB_SHA`.
10. **Container Vulnerability Scan**: Scans base OS packages and application dependencies using Trivy for OS/library vulnerabilities before pushing to GCP Artifact Registry / GCR.

### 3.3 Stage 3: Staging Deployment & Smoke Testing
11. **Deploy to Staging**: Deploys the built container to Cloud Run service `gemini-journal-staging` with Secret Manager bindings.
12. **Staging Smoke Tests**: Executes `npm run smoke` (`scripts/smoke-test.mjs`) against the live staging HTTP service (`/health`, `/api/health`, `/`).

### 3.4 Stage 4: Production Deployment Gate
13. **Production Deployment Approval**:
    - Enforces GitHub Environment Protection (`environment: production`).
    - Requires designated engineering leads to manually review staging smoke test logs and approve the deployment in GitHub UI.
    - Upon approval, tags container image as `latest` and deploys to Cloud Run service `gemini-journal` (the authoritative production service).

---

## 4. Production Protection Policy

> **CRITICAL RULE**: **NEVER AUTOMATICALLY DEPLOY AN UNTESTED BUILD TO PRODUCTION.**

1. Direct commits to production without passing Stages 1-3 are prohibited via GitHub branch protection rules.
2. Automatic deployment to `production` is strictly disabled. Production deployment triggers *only* after explicit approval in the GitHub Actions UI.
3. If any step (1-12) fails in CI, the pipeline halts immediately, preventing container push and deployment.

---

## 5. Rollback Procedures

In the event of a production issue, bug, or performance degradation following a deployment, perform one of the following rollback procedures depending on the incident scope.

### 5.1 Procedure A: Instant Cloud Run Traffic Rollback (Fastest - < 10 Seconds)
Cloud Run maintains an immutable history of all previous revisions. To instantly revert 100% of production traffic to a known healthy prior revision:

```bash
# 1. List past revisions to identify the previous healthy revision ID
gcloud run revisions list \
  --service=gemini-journal \
  --region=us-central1 \
  --project=gen-lang-client-0345619653

# Example output:
# REVISION                   ACTIVE  CREATED
# gemini-journal-00042-abc     YES     2026-09-06 11:40
# gemini-journal-00041-xyz             2026-09-06 09:15

# 2. Revert 100% of production traffic to the previous healthy revision (e.g., 00041-xyz)
gcloud run services update-traffic gemini-journal \
  --to-revisions=gemini-journal-00041-xyz=100 \
  --region=us-central1 \
  --project=gen-lang-client-0345619653
```

### 5.2 Procedure B: Re-deploying Previous Immutable Container Image
If a new revision needs to be explicitly created from a prior container SHA:

```bash
# Deploy previous git commit SHA image to Cloud Run production
PREVIOUS_GOOD_SHA="abc1234def5678"

gcloud run deploy gemini-journal \
  --image="gcr.io/gen-lang-client-0345619653/journal-app:${PREVIOUS_GOOD_SHA}" \
  --region="us-central1" \
  --platform="managed" \
  --project=gen-lang-client-0345619653
```

### 5.3 Procedure C: Secret Manager Secret Rollback
If a secret rotation caused API failures (e.g., corrupted `GEMINI_API_KEY` or Service Account key):

```bash
# 1. List versions of the target secret
gcloud secrets versions list journal-gemini-api-key --project=gen-lang-client-0345619653

# 2. Update Cloud Run service to pin secret to the prior working version ID (e.g., version 1)
gcloud run services update gemini-journal \
  --set-secrets="GEMINI_API_KEY=journal-gemini-api-key:1" \
  --region=us-central1 \
  --project=gen-lang-client-0345619653
```

### 5.4 Procedure D: Firestore Rules / Indexes Rollback
If a Firestore security rules update caused database authorization blocks:

```bash
# Re-deploy previous rule definition from git tag/commit
git checkout <previous-release-tag> -- firestore.rules
firebase deploy --only firestore:rules --project gen-lang-client-0345619653
```

---

## 5.5 Shell Quoting Hazards (PowerShell / Windows)

> **CRITICAL RULE**: When running `gcloud run deploy` from **Windows PowerShell**, the
> comma-separated `--set-env-vars` and `--set-secrets` arguments MUST be **single-quoted**
> (`'...'`). PowerShell parses an unquoted comma list as an array and silently flattens it into
> one giant environment-variable value.

**Correct (PowerShell):**
```powershell
gcloud run deploy gemini-journal-staging --image="gcr.io/gen-lang-client-0345619653/journal-app:latest" `
  --region=us-central1 --project=gen-lang-client-0345619653 --port=8080 `
  --set-env-vars='FIRESTORE_DATABASE_ID=ai-studio-geminijournalref-07d208be-ffdc-41ac-9ad4-a205122972b6,VITE_FIREBASE_PROJECT_ID=gen-lang-client-0345619653,NODE_ENV=production,APP_URL=https://gemini-journal-staging-s7hw7hui2q-uc.a.run.app' `
  --set-secrets='GEMINI_API_KEY=journal-gemini-api-key:latest,GOOGLE_MAPS_API_KEY=journal-maps-api-key:latest,ADMIN_EMAILS=journal-admin-emails:latest,FIREBASE_SERVICE_ACCOUNT_JSON=journal-firebase-sa-json:latest'
```

**Wrong (PowerShell) — created a malformed `FIRESTORE_DATABASE_ID` value on 2026-09-07:**
```powershell
gcloud run deploy ... --set-env-vars=FIRESTORE_DATABASE_ID=ai-...,VITE_FIREBASE_PROJECT_ID=... # DO NOT DO THIS
```

**Always preferred:** run deploys from **CI (GitHub Actions / bash)** or a POSIX shell where each
flag is a single already-quoted token. After any manual deploy, verify the revision's environment
with `gcloud run revisions describe <rev> --format='json'` and confirm each variable is its own
`name`/`value` pair, then run `npm run smoke` against the service URL.

---

## 6. GitHub Repository Secrets Setup

Configure the following secrets in GitHub Repository Settings (`Settings -> Secrets and variables -> Actions`):

| Secret Name | Description | Environment Scope |
| :--- | :--- | :--- |
| `GCP_SA_KEY_STAGING` | Service Account JSON for Staging deployment | `staging` |
| `STAGING_APP_URL` | Base URL of staging service (`https://gemini-journal-staging-s7hw7hui2q-uc.a.run.app`) | `staging` |
| `GCP_SA_KEY_PROD` | Service Account JSON for Production deployment | `production` |
| `PROD_APP_URL` | Base URL of production service (`https://gemini-journal-s7hw7hui2q-uc.a.run.app`) | `production` |

> Note: `GCP_PROJECT_STAGING` / `GCP_PROJECT_PROD` are **no longer required**. The pipeline
> hardcodes the single authoritative project `gen-lang-client-0345619653` so CI can never deploy
> to an unintended project, and never echoes a project value into command output.
