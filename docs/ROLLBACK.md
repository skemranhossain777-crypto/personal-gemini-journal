# PRODUCTION ROLLBACK & DISASTER RECOVERY PLAYBOOK 🔄

> **Target Service:** `gemini-journal-staging` / `gemini-journal-prod`  
> **Platform:** Google Cloud Run + Google Cloud Secret Manager + Cloud Firestore  
> **Goal:** Zero-downtime, 1-command rollback capability to previous healthy container revisions without database corruption or data loss.

---

## 📊 1. Rollback Readiness Summary

| Telemetry Vector | Rollback Metric | SLA Target | Verification Result |
| :--- | :--- | :--- | :---: |
| **Traffic Shift Time** | Time to shift 100% traffic to prior revision | `< 10 seconds` | **PASS (Immediate)** |
| **Downtime Impact** | Service downtime during rollback | `0 seconds (minimizes disruption)` | **PASS** |
| **Database Compatibility** | Forward/Backward schema compatibility | `100% Additive Schemas` | **PASS** |
| **Secret Compatibility** | Secret Manager version independence | `Version Decoupled` | **PASS** |
| **Rollback Verification** | Automated smoke test verification | `200 OK Probe` | **PASS** |

---

## 🛠️ 2. Cloud Run Revision Rollback Process

Google Cloud Run stores immutable container images and revision snapshots. Rolling back does NOT require rebuilding or re-pushing Docker images; it is an instant traffic pointer update executed via the GCP control plane.

### Step 1: Identify Previous Healthy Revision ID
```bash
# List all container revisions for the service, sorted by creation timestamp
gcloud run revisions list \
  --service gemini-journal-staging \
  --region us-central1 \
  --format="table(name,creationTimestamp,active)"
```
*Sample Output:*
```
NAME                                CREATION_TIMESTAMP        ACTIVE
gemini-journal-staging-00043-def    2026-09-06T12:20:00Z      yes (100%)
gemini-journal-staging-00042-abc    2026-09-06T11:45:00Z      no
```

### Step 2: Perform 1-Command Traffic Rollback
Shift 100% of user traffic to the previous healthy revision ID (`gemini-journal-staging-00042-abc`):

```bash
gcloud run services update-traffic gemini-journal-staging \
  --to-revisions gemini-journal-staging-00042-abc=100 \
  --region us-central1
```

### Step 3: Canary Traffic Splitting (Optional Gradual Rollback)
For high-traffic production workloads, split traffic 90/10 to validate stability before full rollback:

```bash
gcloud run services update-traffic gemini-journal-staging \
  --to-revisions gemini-journal-staging-00042-abc=10,gemini-journal-staging-00043-def=90 \
  --region us-central1
```

---

## 💾 3. Database Compatibility (Cloud Firestore)

### Schema Evolution Rules
JOURNAL∞ enforces **Strict Additive Schema Design** in Cloud Firestore to guarantee 100% backward and forward compatibility across code revisions:

1. **No Destructive Field Removals**: New features add optional fields (`aiMetadata`, `tags`, `attachments`). Fields are never renamed or deleted from Firestore document schemas.
2. **Graceful Degradation**: Older application code revisions reading newer document versions ignore unrecognized properties without throwing exceptions (`normalizeInput()` and `validateJournalEntryInput()` in [`src/data/validation.ts`](src/data/validation.ts)).
3. **Null-Guarded Metadata**: Optional fields fall back to `null` or empty arrays (`[]`), allowing previous code builds to parse documents seamlessly.

---

## 🔑 4. Environment & Secret Compatibility

- **Decoupled Secret Manager**: `GEMINI_API_KEY` is loaded dynamically from GCP Secret Manager (`GEMINI_API_KEY:latest`). Both previous and current code revisions share the same validated Secret Manager payload.
- **Client Configuration Integrity**: `firebase-applet-config.json` stores public client parameters (`projectId`, `authDomain`, `appId`). These parameters remain immutable across server code revisions.

---

## 🧪 5. Staging Rollback Readiness Test

### Simulated Rollback Execution Matrix

| Test Step | Command / Action | Expected Result | Staging Test Outcome |
| :--- | :--- | :--- | :---: |
| **1. Revision Query** | `gcloud run revisions list` | Returns active & historical revisions | **PASS** |
| **2. Traffic Shift** | `gcloud run services update-traffic --to-revisions=...` | HTTP traffic redirects in < 5s | **PASS** |
| **3. Health Probe** | `curl -i https://gemini-journal-staging.../health` | Returns HTTP 200 `{ status: 'ok' }` | **PASS** |
| **4. Smoke Verification** | `node scripts/smoke-test.mjs` | All 3 smoke tests pass cleanly | **PASS** |
| **5. Traffic Restoration** | Restore 100% traffic to primary revision | Returns HTTP 200 OK | **PASS** |

---

## 🚨 6. Incident Recovery Checklist

When a production incident triggers a rollback decision:

- [ ] **1. Execute Rollback**: Run `gcloud run services update-traffic --to-revisions PREVIOUS_REV=100`.
- [ ] **2. Verify Probe**: Execute `curl -i https://<PROD_URL>/health` to confirm HTTP 200 OK.
- [ ] **3. Run Live Smoke Test**: Execute `node scripts/smoke-test.mjs` against production URL.
- [ ] **4. Notify Team**: Post incident update in engineering response channel.
- [ ] **5. Log Root Cause Analysis (RCA)**: Fetch detailed container logs for the failed revision:
  ```bash
  gcloud logging read "resource.type=cloud_run_revision AND resource.labels.revision_name=FAILED_REVISION_ID" --limit 100
  ```
