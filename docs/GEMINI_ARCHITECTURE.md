# GEMINI INTEGRATION ARCHITECTURE

## 1. Overview & Product Alignment

JOURNAL∞ implements a clean, competition-grade **Gemini Integration Layer** designed in full alignment with the *Master Vibe Coding Specification*. 

The system provides an emotionally intelligent, private, and resilient reflection partner. AI functionality runs strictly server-side, protecting user data and credentials while enforcing robust validation, rate limiting, and model fallback mechanics.

---

## 2. Server-Side Security & Secret Management

### Key Security Commitments
1. **Zero Client Secrets**: `GEMINI_API_KEY` is never bundled into or exposed to client-side code.
2. **Environment & GCP Secret Manager Compatibility**: Secrets are injected via process environment variables (`process.env.GEMINI_API_KEY` or `process.env.GEMINI_API_KEY_SECRET`), seamlessly compatible with Google Cloud Run and GCP Secret Manager.
3. **Safe Logging**: The execution engine uses `safeLog()` to log timestamps, latency, and model metrics without printing raw user PII or API tokens.

---

## 3. Resilience, Rate Limiting & Execution Engine

### Model Fallback Ladder
To ensure reliability during peak AI Studio / Gemini API demand, the system utilizes a 5-tier fallback ladder:
1. `gemini-3.7-flash` (Primary stable frontier model)
2. `gemini-3.6-flash`
3. `gemini-3.6-flash`
4. `gemini-flash-latest`
5. `gemini-3.1-flash-lite`

### Retry Policy & Timeout Handling
- **Hard Timeout Deadline**: Every AI request is wrapped in a hard deadline (`30,000ms`). Requests exceeding this deadline reject with a `TIMEOUT` error (`504 Gateway Timeout`).
- **Exponential Backoff**: Transient errors (e.g., HTTP `503 Service Unavailable` or `429 Too Many Requests`) trigger automatic retries per model tier with exponential backoff before advancing to the next model in the fallback ladder.

### Rate Limiting Architecture
- **In-Memory Windowed Rate Limiter**: Express middleware (`rateLimiter`) tracks client IP address hit rates (`30 requests per minute`).
- **Upstream Protection**: Prevents quota exhaustion and protects against abuse.

---

## 4. Input Sanitization & Response Validation

### Request Validation
- **Empty Check**: Rejects blank or whitespace-only prompts (`INVALID_INPUT`, `400 Bad Request`).
- **Oversized Input Protection**: Enforces a strict `12,000` character limit per prompt (`OVERSIZED_INPUT`, `400 Bad Request`).
- **Prompt Injection Defense**: Evaluates inputs against adversarial pattern signatures (e.g., `"ignore previous instructions"`, `"system prompt override"`, `"jailbreak mode"`, `"reveal system prompt"`) and rejects malicious requests (`PROMPT_INJECTION`, `400 Bad Request`).

### Response Validation & JSON Parsing
- `parseAndValidateJson<T>(rawText, validator, fallback)` extracts structured JSON payloads from markdown code fences (````json ... ````) or raw text.
- Validates field types, numerical ranges, and enum values.
- If model output is truncated or malformed, the engine gracefully logs a warning and returns a safe fallback payload rather than throwing an unhandled exception or crashing the application.

---

## 5. The 7 Modular AI Operations

The service provides 7 dedicated AI operations:

### 1. Reflection (`reflect`)
- **Purpose**: Compassionate, grounded reflection partner for journal entries and multi-turn dialogue.
- **Output**: `{ reply: string, summary: string, tags: string[], modelUsed: string }`.

### 2. Summarization (`summarize`)
- **Purpose**: Generates executive summaries, key takeaways, and emotional tone assessments.
- **Output**: `{ summary: string, keyTakeaways: string[], emotionalTone: string, modelUsed: string }`.

### 3. Theme Extraction (`extractThemes`)
- **Purpose**: Identifies core life themes, dominant emotions, and recurring topics across entries.
- **Output**: `{ themes: string[], dominantEmotions: string[], recurringTopics: string[], modelUsed: string }`.

### 4. Memory Candidate Extraction (`extractMemoryCandidates`)
- **Purpose**: Extracts candidate memories for user review without silent auto-persistence.
- **Output**: Array of `{ type, title, narrative, importance (1..5), confidence (0..1) }`.
- **Memory Types**: `person`, `place`, `project`, `goal`, `achievement`, `important-event`, `idea`, `preference`, `lesson`, `milestone`, `recurring-theme`.

### 5. Contextual Questions (`generateContextualQuestions`)
- **Purpose**: Generates open-ended, probing questions grounded in journal text and historical context.
- **Output**: `{ questions: string[], contextRelevance: string, modelUsed: string }`.

### 6. Coaching (`provideCoaching`)
- **Purpose**: Delivers non-judgmental guidance, actionable micro-steps, and constructive mindset shifts.
- **Output**: `{ guidance: string, actionableSteps: string[], perspectiveShift: string, modelUsed: string }`.

### 7. Reframing (`reframePerspective`)
- **Purpose**: Cognitive reframing of negative automatic thoughts and distortion identification without toxic positivity.
- **Output**: `{ originalThought: string, reframedPerspectives: string[], cognitiveDistortionsIdentified: string[], empoweringTakeaway: string, modelUsed: string }`.

---

## 6. Testing Strategy

The service includes comprehensive mock-driven unit tests in `server/gemini/__tests__/geminiService.test.ts` covering all required failure modes:

| Test Case | Description | Verification |
| :--- | :--- | :--- |
| **Valid Response** | Standard AI payload across all 7 operations | Correct output formatting, schema compliance, and model tracking |
| **Malformed Response** | Invalid non-JSON payload for structured operations | Gracefully falls back without throwing or crashing |
| **Timeout** | Network or generation latency exceeding `30s` | Throws `GeminiError` with code `TIMEOUT` (`504`) |
| **API Error** | Invalid API keys or backend failures | Throws `GeminiError` with code `API_ERROR` (`401/500`) |
| **Empty Response** | Model returning blank or whitespace output | Throws `GeminiError` with code `EMPTY_RESPONSE` (`500`) |
| **Oversized Input** | Prompt exceeding `12,000` characters | Rejects request with code `OVERSIZED_INPUT` (`400`) |
| **Malicious Prompt** | System prompt override / prompt injection attempt | Rejects request with code `PROMPT_INJECTION` (`400`) |

---

## 7. API Endpoint Reference

| Endpoint | Method | Operation | Rate Limit |
| :--- | :--- | :--- | :--- |
| `/api/gemini/reflect` | `POST` | Reflection & companion dialogue | 30 req/min |
| `/api/gemini/summarize` | `POST` | Executive summarization | 30 req/min |
| `/api/gemini/extract-themes` | `POST` | Theme & emotion extraction | 30 req/min |
| `/api/gemini/extract-memories` | `POST` | Memory candidate extraction | 30 req/min |
| `/api/gemini/contextual-questions` | `POST` | Contextual question generation | 30 req/min |
| `/api/gemini/coach` | `POST` | Actionable coaching | 30 req/min |
| `/api/gemini/reframe` | `POST` | Cognitive reframing | 30 req/min |
