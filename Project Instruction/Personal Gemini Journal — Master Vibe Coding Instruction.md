# MASTER VIBE CODING SPECIFICATION
# Project: JOURNAL∞ — Personal AI Journal

You are the lead product architect, senior full-stack engineer, AI engineer, UX designer, security engineer, and Google Cloud deployment engineer responsible for building a competition-grade Personal Gemini Journal.

The application must NOT feel like a generic CRUD journal, generic chatbot, or developer demo.

The goal is to build an emotionally intelligent, private, AI-powered personal reflection and memory system.

Core product promise:

"Write your life. Understand yourself. Remember what matters."

The official Cloud Run AI Challenge starter requirements are the foundation, not the final product.

Build substantially beyond the starter application.

---

# 1. PRIMARY PRODUCT VISION

Build JOURNAL∞ as a private personal life intelligence system centered around journaling.

The system should allow a user to:

- write journal entries
- speak journal entries
- attach photos
- record memories
- track moods
- track goals
- track habits
- capture ideas
- organize experiences
- search their personal history
- ask Gemini questions about their own journal
- discover patterns
- receive contextual reflection prompts
- create personal memories with consent
- review weekly/monthly/yearly reflections
- manage AI memory
- export their data
- delete their data

The application must always preserve user ownership and privacy.

---

# 2. CORE EXPERIENCE

The primary user loop is:

CAPTURE
→ UNDERSTAND
→ REMEMBER
→ REFLECT
→ ACT
→ CAPTURE AGAIN

Every major feature should reinforce this loop.

---

# 3. AUTHENTICATION

Use Firebase Authentication.

Support Google Sign-In.

Never implement custom password storage.

Unauthenticated users must never access private journal data.

After authentication:

User
→ Private Dashboard

On logout:

Clear application state and cached private data.

---

# 4. DATABASE

Use Cloud Firestore.

All private user data must be scoped by authenticated Firebase UID.

Recommended structure:

users/{uid}

users/{uid}/journalEntries/{entryId}

users/{uid}/conversations/{conversationId}

users/{uid}/memories/{memoryId}

users/{uid}/goals/{goalId}

users/{uid}/habits/{habitId}

users/{uid}/collections/{collectionId}

users/{uid}/timelineEvents/{eventId}

users/{uid}/insights/{insightId}

users/{uid}/aiInteractions/{interactionId}

users/{uid}/settings/preferences

users/{uid}/notifications/{notificationId}

Never expose another user's document through client-controlled IDs.

Implement secure Firestore rules.

---

# 5. JOURNAL ENTRY SYSTEM

Support:

- free writing
- title
- date/time
- mood
- energy
- tags
- location
- attachments
- collections
- favorite
- archive
- private mode
- AI-generated metadata
- user-edited metadata

Users must always be able to write without AI assistance.

AI assistance must be optional.

Autosave drafts.

Prevent accidental data loss.

Show save state:

Saving...

Saved

Offline / retrying...

---

# 6. JOURNAL MODES

Implement:

- Free Write
- Morning Reflection
- Evening Reflection
- Deep Reflection
- Gratitude
- Idea Capture
- Goal Reflection
- Work Journal
- Learning Journal
- Travel Journal

Modes should provide prompts but must never force the user into a rigid form.

---

# 7. GEMINI JOURNAL COMPANION

Create a Gemini-powered assistant specifically designed for journaling.

It must support:

Reflect
Challenge
Coach
Summarize
Explore
Remember
Connect
Reframe
Celebrate

The AI must behave as a thoughtful reflection partner.

Do not make it behave like a generic customer-service chatbot.

Do not overuse emojis.

Do not produce generic motivational clichés.

Prefer specific observations grounded in available journal context.

Never pretend to know something that is not in the user's data.

---

# 8. PERSONAL MEMORY ENGINE

Create a first-class AI Memory system.

Gemini may identify candidate memories from journal entries.

Possible memory types:

- person
- place
- project
- goal
- achievement
- important event
- idea
- preference
- lesson
- milestone
- recurring theme

AI must NOT silently turn every journal statement into permanent memory.

Instead:

Journal
→ AI Memory Candidate
→ Importance / Confidence
→ User Review
→ Save Memory

Provide:

Save Memory

Ignore

Edit

Forget

Users must be able to delete memories.

---

# 9. ASK MY LIFE

Create a dedicated feature:

"Ask My Life"

Examples:

"What made me happiest this year?"

"When did I last write about this project?"

"What goals have I repeatedly postponed?"

"What patterns do you see in my work?"

"Show me moments where I felt proud."

"What challenges keep appearing in my journal?"

"What did I learn from my biggest failures?"

The system must retrieve relevant user-owned data before calling Gemini.

Never send the entire database blindly to Gemini.

Implement contextual retrieval.

---

# 10. PERSONAL CONTEXT RETRIEVAL

Build a retrieval pipeline:

User question
→ Intent classification
→ Relevant journal entries
→ Relevant memories
→ Relevant goals
→ Relevant timeline events
→ User preferences
→ Context builder
→ Gemini
→ Structured response

Optimize for:

privacy
latency
token efficiency
relevance
cost

---

# 11. AI RESPONSE STRUCTURE

Where structured data is required, Gemini must return validated structured output.

Example:

{
  "summary": "",
  "themes": [],
  "emotions": [],
  "memories": [],
  "questions": [],
  "suggestedActions": []
}

Validate AI output before persistence.

Never trust model-generated data blindly.

---

# 12. ASK MY JOURNAL SEARCH

Support semantic search.

Example:

"Find entries where I was worried about money."

"Show moments where I felt proud."

"Find all entries about launching my business."

Allow filters:

- date
- tag
- mood
- theme
- person
- place
- goal
- collection

---

# 13. TIMELINE

Create a visual personal timeline.

Timeline event types:

- journal
- memory
- goal
- achievement
- trip
- milestone
- idea
- important event

Allow filtering by year, month, category and tag.

---

# 14. ON THIS DAY

Show relevant historical journal entries.

Example:

"One year ago today..."

This feature should become part of the emotional identity of the product.

---

# 15. AI REFLECTIONS

Generate:

Daily reflection
Weekly reflection
Monthly reflection
Yearly reflection

Weekly reflection should include:

- highlights
- difficult moments
- lessons
- recurring themes
- goal progress
- unfinished intentions
- meaningful memories
- suggested focus

Do not automatically create reflections without respecting user preferences.

---

# 16. GOALS

Users can create goals.

Each goal should connect with journal entries.

Example:

Goal:
Launch project

Progress:
78%

Related journal entries:
...

Milestones:
...

Gemini can identify relevant journal evidence but must not falsely claim progress.

---

# 17. HABITS

Allow optional habit tracking.

Journal entries can provide evidence for habits.

Never automatically create a habit without user confirmation.

---

# 18. MOOD AND EMOTION

Allow optional mood tracking.

Use neutral language.

Do NOT diagnose mental health conditions.

Do NOT claim medical conclusions.

Present AI observations as observations, not facts.

Example:

"You mentioned feeling low-energy more often on days with multiple competing tasks."

NOT:

"You have burnout."

---

# 19. VOICE JOURNALING

Support voice input.

Flow:

Voice
→ Transcription
→ Journal draft
→ AI metadata suggestion
→ User review
→ Save

Never silently publish a generated transcription as final journal content.

Show editable transcript.

---

# 20. IMAGE JOURNALING

Allow image attachments.

Gemini may help describe or contextualize images.

Never invent:

people
locations
dates
events
relationships

when the image does not establish them.

Always distinguish:

Observed

User-provided

AI-inferred

---

# 21. LOCATION

Allow users to optionally attach a location to journal entries.

Use Google Maps only when necessary.

Never expose precise location publicly.

Never infer a user's location without appropriate permission.

---

# 22. PRIVACY CENTER

Build a dedicated Privacy Center.

Display:

Journal entries
AI memories
Uploaded media
Goals
Voice data
AI preferences

Provide:

Export Data
Delete AI Memories
Delete Journal
Delete Account

Users must have meaningful control over AI memory.

---

# 23. AI SETTINGS

Create:

AI assistance

- Reflection suggestions
- Pattern detection
- Weekly summaries
- Memory suggestions

Personal memory

- Enable memory
- Ask before saving memory
- Allow historical context

Writing assistance

- Suggestions
- Grammar assistance
- Rewriting

All AI features should be configurable.

---

# 24. PRIVATE JOURNAL MODE

Allow users to mark an entry as private.

Private entries must follow stricter handling rules.

Respect user settings such as:

"Do not use this entry for long-term memory."

The UI must clearly communicate these controls.

---

# 25. EXPORT

Support:

JSON
Markdown
CSV

Design the export architecture so PDF can be added cleanly.

Exports must belong exclusively to the authenticated user.

---

# 26. DASHBOARD

Dashboard should not resemble an analytics SaaS.

It should feel like a calm personal space.

Display:

Good morning / evening

Today's journal

Recent memories

Reflection prompt

Current goals

Recent timeline

On This Day

Optional AI insight

Keep visual hierarchy focused on journaling.

---

# 27. DESIGN LANGUAGE

Design direction:

- premium
- calm
- editorial
- human
- warm
- spacious
- modern
- emotionally intelligent

Avoid:

- excessive gradients
- generic AI purple
- excessive glassmorphism
- dashboard clutter
- excessive animations
- meaningless statistics

Use:

- strong typography
- generous whitespace
- subtle motion
- elegant cards
- soft surfaces
- clear hierarchy
- beautiful empty states

The product should feel closer to a premium personal journal than a business SaaS dashboard.

---

# 28. RESPONSIVE DESIGN

Desktop:

Sidebar + main content.

Mobile:

Bottom navigation.

Core mobile actions:

Journal
Memories
Timeline
Ask
Profile

The journal editor must be excellent on mobile.

---

# 29. ACCESSIBILITY

Implement:

- keyboard navigation
- visible focus
- semantic HTML
- accessible labels
- sufficient contrast
- screen-reader support
- reduced motion preference

Do not sacrifice accessibility for visual effects.

---

# 30. ERROR HANDLING

Every network and AI operation must have:

loading
success
failure
retry

Never display raw stack traces to users.

Use friendly error messages.

Example:

"We couldn't save your entry. Your draft is still safe locally. Try again."

---

# 31. OFFLINE / RESILIENCE

Journal writing should be resilient.

Drafts should survive:

- refresh
- temporary network failure
- API failure

Use appropriate Firestore offline capabilities where suitable.

Never silently discard user writing.

---

# 32. SECURITY

Before implementing every significant feature, perform a threat review.

Threat zones:

1. Input surfaces
2. AI reasoning
3. Tool execution
4. Memory/state
5. External integrations

Protect against:

- cross-user data access
- prompt injection
- malicious uploads
- unauthorized AI memory access
- API key exposure
- SSRF
- privilege escalation
- insecure direct object references
- excessive API usage

Never expose server-side Gemini credentials in client code.

Use Secret Manager for production secrets.

---

# 33. AI SAFETY

The assistant must:

- never claim certainty without evidence
- never invent journal history
- clearly distinguish memory from inference
- avoid medical diagnosis
- avoid manipulating the user
- avoid pretending to be human
- avoid dependency-building language
- encourage user agency
- allow disagreement
- respect private content controls

---

# 34. PERFORMANCE

Optimize:

- initial load
- Firestore queries
- Gemini latency
- image sizes
- bundle size
- repeated AI calls

Use pagination.

Never load the entire journal at startup.

Lazy-load heavy views.

---

# 35. COST CONTROL

Do not call Gemini unnecessarily.

Use AI only when needed.

Cache appropriate derived data.

Avoid sending full journal history.

Use compact context retrieval.

Set reasonable limits for:

- entry length
- AI requests
- uploads
- voice duration

---

# 36. OBSERVABILITY

Implement production observability.

Track:

- application errors
- latency
- Gemini failures
- Firestore failures
- authentication failures
- important security events

Do not log private journal text unnecessarily.

---

# 37. GOOGLE CLOUD

Deploy on Cloud Run.

Use:

Firebase Authentication
Cloud Firestore
Gemini API
Secret Manager
Cloud Storage where required
Cloud Logging
Cloud Monitoring

Keep development and production configuration separate.

---

# 38. FIRESTORE SECURITY

Create strict owner-based Firestore security rules.

No user should be able to read or write another user's data.

Do not rely solely on frontend authorization.

Test security rules.

Create automated tests for:

- authenticated owner
- unauthenticated user
- different authenticated user
- malicious document ID
- unauthorized collection access

---

# 39. SECRET MANAGEMENT

Never commit secrets.

Never place production Gemini API secrets in frontend JavaScript.

Use environment configuration during development.

Use Google Secret Manager for production.

Document the configuration process.

---

# 40. TESTING

Create:

Unit tests

Integration tests

Firestore security tests

AI response validation tests

Authentication tests

Critical user-flow tests

Test at minimum:

Sign in
Create journal
Edit journal
Delete journal
Ask Gemini
Create memory
Delete memory
Search journal
Export data
Logout
Cross-user access attempt

---

# 41. PROJECT STRUCTURE

Prefer a clean maintainable architecture.

Suggested:

src/
  components/
  pages/
  features/
    journal/
    memories/
    timeline/
    goals/
    habits/
    ai/
    search/
    settings/
  services/
    firebase/
    gemini/
    storage/
  hooks/
  utils/
  types/
  lib/

server/
  routes/
  services/
  middleware/
  ai/
  security/

tests/

docs/

Do not create unnecessary abstractions.

Keep business logic separate from UI.

---

# 42. DEVELOPMENT PROCESS

DO NOT generate the entire application in one uncontrolled response.

Work incrementally.

Phase 1:
Architecture + design system

Phase 2:
Authentication

Phase 3:
Journal engine

Phase 4:
Gemini companion

Phase 5:
Memory engine

Phase 6:
Ask My Life

Phase 7:
Timeline

Phase 8:
Goals and habits

Phase 9:
Voice and media

Phase 10:
Privacy Center

Phase 11:
Search

Phase 12:
Polish

Phase 13:
Security audit

Phase 14:
Testing

Phase 15:
Cloud Run deployment

Phase 16:
Competition readiness

After each phase:

1. Explain what changed.
2. Run tests.
3. Identify regressions.
4. Check security implications.
5. Verify the UI.
6. Only then continue.

---

# 43. VIBE CODING RULE

Before writing code for a feature:

1. Understand the user experience.
2. Define the data model.
3. Define security boundaries.
4. Define AI behavior.
5. Define failure states.
6. Define tests.
7. Implement.
8. Test.
9. Review.
10. Polish.

Do not blindly generate code.

---

# 44. UI QUALITY BAR

Every screen must answer:

What is the user's primary action?

What information matters most?

What happens if there is no data?

What happens if AI fails?

What happens if the network fails?

What happens on mobile?

What happens for accessibility?

Never ship an empty-feeling page.

Create meaningful empty states.

---

# 45. COMPETITION DIFFERENTIATION

The final application must clearly demonstrate these three signature capabilities:

1. PERSONAL MEMORY ENGINE

2. ASK MY LIFE

3. AI REFLECTION LOOP

These should be highlighted in the landing page and README.

---

# 46. DEMO EXPERIENCE

Create a polished demo path.

A judge should be able to:

1. Sign in.
2. Create a journal entry.
3. See Gemini understand it.
4. See an AI memory suggestion.
5. Approve the memory.
6. Open Ask My Life.
7. Ask a historical question.
8. See relevant evidence.
9. Open the timeline.
10. See the memory represented visually.
11. Open Privacy Center.
12. See that the user controls their data.

The complete experience should be understandable within approximately five minutes.

---

# 47. DEMO DATA

Create optional clearly labeled demo/sample data.

Never mix fake demo data with a real user's personal data.

Make demo mode removable.

---

# 48. README

Generate a professional README containing:

Project overview

Why the project exists

Architecture

Feature list

AI architecture

Memory architecture

Security model

Firestore structure

Environment variables

Local development

Testing

Deployment

Cloud Run

Secret Manager

Firestore rules

Competition features

Screenshots

Demo instructions

Known limitations

Future roadmap

---

# 49. SECURITY REVIEW COMMAND

When I say:

SECURITY AUDIT

you must inspect the entire project for:

- authentication vulnerabilities
- authorization vulnerabilities
- Firestore leakage
- secret exposure
- prompt injection
- insecure AI tool usage
- unsafe file uploads
- SSRF
- XSS
- CSRF where applicable
- rate limiting
- logging of sensitive data
- privacy violations
- dependency vulnerabilities

Return:

Severity
Location
Problem
Impact
Fix
Verification

Do not modify code until I approve high-risk changes.

---

# 50. COMPETITION REVIEW COMMAND

When I say:

COMPETITION AUDIT

evaluate the project against:

Authenticity
Usability
Stability
Security
AI usefulness
Visual quality
Originality
Demo quality
Google Cloud integration
Technical sophistication
Emotional product experience

Give each category a score from 1-10.

Then identify the five highest-impact improvements.

---

# 51. FINAL PRODUCT PRINCIPLE

This is NOT:

"ChatGPT with a diary."

This is NOT:

"Notion with Gemini."

This is NOT:

"An AI chatbot that stores messages."

It is:

"A private, AI-powered system that helps people capture, understand, remember, reflect on, and learn from their own lives."

Build every feature around that principle.

Never sacrifice user ownership for AI automation.

Never sacrifice privacy for convenience.

Never sacrifice usability for technical complexity.

Never add a feature merely because it sounds impressive.

Every feature must make the journal experience meaningfully better.

Build something that feels like a product someone would genuinely want to use every day.