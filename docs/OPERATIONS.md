# PRODUCTION OPERATIONS, MONITORING, & ALERTING PLAYBOOK 🚨

> **Target Service:** `gemini-journal-staging` / `gemini-journal-prod`  
> **Platform:** Google Cloud Run + Google Cloud Logging + Google Cloud Monitoring  
> **Privacy Mandate:** **Zero Unnecessary PII Logging**. Journal entry content, body text, and session tokens MUST NEVER be printed to application stdout/stderr or log sinks.

---

## 📊 1. Core Production Monitoring Metrics

JOURNAL∞ monitors 8 core operational telemetry vectors via Google Cloud Monitoring and Cloud Logging metrics:

```
[ Incoming Requests ] ──► [ Cloud Run Container ] ──► [ Cloud Logging (safeLog) ]
                               │                               │
                               ▼                               ▼
                     [ Cloud Monitoring ] ──────────► [ Alert Policy Engine ]
                   (Latency / Error Rate / CPU)       (Slack / PagerDuty / Email)
```

| Metric Vector | Target Metric Path | Normal Threshold | Critical Alert Threshold |
| :--- | :--- | :--- | :--- |
| **1. Cloud Run Errors** | `run.googleapis.com/request_count` (5xx status) | `< 0.1%` 5xx responses | `> 1.0%` 5xx over 5-minute window |
| **2. Request Latency** | `run.googleapis.com/request_latencies` (p95) | `< 800ms` for API / RAG | `> 3,000ms` (p95) over 5 minutes |
| **3. Container Crashes** | `run.googleapis.com/container/instance_count` restarts | `0` unexpected exits | `≥ 2` container restarts in 10 mins |
| **4. Auth Failures** | `logging.googleapis.com/user/auth_failures` | `< 5` failures / min | `> 20` invalid JWTs / min |
| **5. Gemini Failures** | `logging.googleapis.com/user/gemini_fallback_count` | `< 2%` model fallback | `> 10%` model fallbacks or 503s |
| **6. Firestore Failures** | `firestore.googleapis.com/document/write_count` errors | `0` rule rejections | `> 10` permission denied / min |
| **7. Abnormal Traffic** | `run.googleapis.com/request_count` (total RPS) | `10 - 100` req / sec | `> 500` req / sec (potential DDoS) |
| **8. Resource Utilization** | `run.googleapis.com/container/cpu/utilization` | `< 65%` CPU, `< 70%` RAM | `> 85%` CPU or `> 85%` RAM |

---

## 🔒 2. Privacy & Logging Discipline

To comply with global data privacy regulations and OWASP AI guidelines:

- **Strict `safeLog()` Requirement**: All server logging calls MUST pass through `safeLog()` in [`server/gemini/geminiService.ts`](server/gemini/geminiService.ts).
- **Redacted Information**:
  - ❌ **NEVER LOGGED:** Raw journal body text, title strings, user reflection notes, audio transcriptions, session JWT tokens, or `GEMINI_API_KEY` values.
  - ✅ **PERMITTED METRICS:** ISO Timestamps, anonymized user UID hashes (`uid.slice(0, 6)`), HTTP status codes, latency in milliseconds, model tier used (`gemini-3.7-flash`), and error category keys (`TIMEOUT`, `API_ERROR`).

---

## 🚨 3. Alert Policy Definitions & Severities

### Alert 1: `CRITICAL_HTTP_5XX_SPIKE`
- **Severity:** `P1 - CRITICAL`
- **Condition:** Cloud Run HTTP 5xx error rate exceeds `1.0%` of total requests over 5 minutes.
- **Meaning:** Server container is crashing, unhandled runtime exceptions are occurring, or upstream cloud services are failing.
- **Response Procedure:**
  1. Inspect Cloud Logging: `resource.type="cloud_run_revision" AND severity>=ERROR`.
  2. Check recent deployment revisions (`gcloud run revisions list`).
  3. If exception is tied to a new code release, trigger **Immediate Revision Rollback** (Section 4).

### Alert 2: `HIGH_LATENCY_P95_DEGRADATION`
- **Severity:** `P2 - HIGH`
- **Condition:** 95th percentile request latency exceeds `3,000ms` over 5 minutes.
- **Meaning:** Gemini 3.6 Flash API calls are timing out, context compression limit is overloaded, or Firestore cold starts are degrading performance.
- **Response Procedure:**
  1. Check Gemini fallback metrics in Cloud Logging (`"Model attempt failed"`).
  2. Verify Gemini API quota status in Google Cloud Console.
  3. Verify context payload capping (`12,000` char cap in `askMyLife.ts`).

### Alert 3: `CONTAINER_MEMORY_EXHAUSTION_OOM`
- **Severity:** `P1 - CRITICAL`
- **Condition:** Container memory utilization exceeds `85%` or container terminates with `OOMKilled`.
- **Meaning:** Node.js process heap memory leak or oversized response buffers.
- **Response Procedure:**
  1. Increase Cloud Run container memory allocation to `1024Mi` or `2048Mi`:
     ```bash
     gcloud run services update gemini-journal-staging --memory 1024Mi --region us-central1
     ```
  2. Inspect memory leak traces via Cloud Monitoring Heap Profiler.

### Alert 4: `GEMINI_FALLBACK_LADDER_ENGAGED`
- **Severity:** `P3 - MODERATE`
- **Condition:** Primary model `gemini-3.7-flash` fails > 5% of requests, triggering fallback to `gemini-3.6-flash`.
- **Meaning:** Upstream Gemini API experiencing high demand or transient 503 errors.
- **Response Procedure:**
  1. Automated fallback ladder is active; zero user impact expected.
  2. Monitor fallback metrics until primary model tier stabilizes.

### Alert 5: `ABNORMAL_AUTH_FAILURE_SPIKE`
- **Severity:** `P2 - HIGH`
- **Condition:** Authentication verification failures exceed `20` per minute.
- **Meaning:** Potential credential stuffing attack, expired JWT key rotation, or domain mismatch.
- **Response Procedure:**
  1. Check Express rate-limiter logs (`"Rate limit exceeded"`).
  2. Confirm RS256 JWKS public key endpoint `https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com` is reachable.

---

## 🔄 4. Emergency Procedures & Revision Rollback

### Step-by-Step Cloud Run Traffic Rollback

If a critical issue occurs after a new deployment, immediately route traffic back to the previous healthy revision:

```bash
# 1. List active container revisions
gcloud run revisions list --service gemini-journal-staging --region us-central1

# 2. Shift 100% of traffic back to the previous stable revision ID
gcloud run services update-traffic gemini-journal-staging \
  --to-revisions gemini-journal-staging-00042-xyz=100 \
  --region us-central1

# 3. Verify traffic shift
gcloud run services describe gemini-journal-staging --region us-central1
```

### Secret Manager Key Rotation Procedure

If `GEMINI_API_KEY` is compromised or needs routine rotation:

```bash
# 1. Add new secret version to Secret Manager
gcloud secrets versions add GEMINI_API_KEY --data-file="new_key.txt"

# 2. Update Cloud Run service to reference the latest secret version
gcloud run services update gemini-journal-staging \
  --update-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest \
  --region us-central1

# 3. Destroy old secret version
gcloud secrets versions destroy 1 --secret GEMINI_API_KEY
```

---

## 🛠️ 5. Operational Verification Commands

```bash
# Check Cloud Run service health
gcloud run services describe gemini-journal-staging --region us-central1

# Tail live application logs (redacted)
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=gemini-journal-staging" --limit 50 --format json

# Execute HTTP health check probe
curl -i https://gemini-journal-staging-618285014094.us-central1.run.app/health
```
