# DESIGN SYSTEM — JOURNAL∞

- **Repo:** `D:\Apersonontherun\Google-Programmed\gemini-journal-reflections`
- **Date:** 2026-09-05
- **Sources of truth:** Master Vibe Coding Spec §27–§29 (design language, responsive, accessibility), §44 (UI quality bar); `docs/PROJECT_STATE.md` (current navy visual language); `docs/ARCHITECTURE.md` §2 (frontend decisions).
- **Status:** Tokens + primitives implemented. Adopted incrementally by existing screens during Phase 3+; existing components remain functional in parallel (additive rule).

---

## 1. Design Direction

From the spec's summary words: **premium · calm · editorial · human · warm · spacious · modern · emotionally intelligent**.

We translate this into:

1. **Editorial calm.** Serif display voice for headings/prose emphasis (`--font-display`, local-stack), hushed sans for UI. Generous whitespace, hairline borders, soft surfaces. Nothing shouts.
2. **A quiet navy world.** Deep ink blues are the *stage*; sky-accent and warm success tones are the *highlights*. No generic AI purple, no excessive gradients, no glass décor.
3. **Warmth through tone.** Off-white ink (`#EEF4FF`) on deep navy reads as paper on nightstand, not a dashboard. Radial glow + desk-lamp amber accents only in empty states/highlights.
4. **Emotional intelligence = restraint.** Motion is short, eased, purposeful. Every animation is disabled under `prefers-reduced-motion`. Data density is low; empty states are invitations, not voids.
5. **Typography hierarchy without decoration.** Eyebrow micro-labels → serif displays → readable body — the hierarchy *is* the decoration.

### Explicit anti-patterns (checked in review)

- ❌ generic AI-SaaS gradient headers / purple `#7C3AED` branding
- ❌ excessive glassmorphism / noise backdrops
- ❌ dashboard clutter / meaningless statistics
- ❌ excessive animation (bouncing, parallax, long loops)
- ❌ crying ffill fallback — fonts are local-first stacks (no network dependency, no FOUT risk)

---

## 2. Tokens

Defined in `src/index.css` via Tailwind v4 `@theme`. Utilities generated automatically: `bg-page`, `text-ink-hi`, `border-line`, `shadow-pop`, `font-display`, etc.

### 2.1 Color

| Token | Value | Usage |
|---|---|---|
| `--color-page` | `#070B16` | app background |
| `--color-surface-1` | `#0B1226` | base panel / canvas |
| `--color-surface-2` | `#0E1730` | elevated panel / bars |
| `--color-surface-3` | `#121E40` | inputs, inset chips |
| `--color-surface-4` | `#17254F` | active tabs, primary-skeleton |
| `--color-surface-5` | `#1C2C5E` | hover fills over 3/4 |
| `--color-surface-hover` | `#26376B` | hover over headers/rows |
| `--color-line` | `#223056` | hairlines, borders (default) |
| `--color-line-strong` | `#31447F` | emphasized borders |
| `--color-line-accent` | `#4A63A3` | hover borders |
| `--color-ink-hi` | `#EEF4FF` | primary text |
| `--color-ink-mid` | `#D9E2F5` | body text |
| `--color-ink-low` | `#9FB0D4` | secondary text |
| `--color-ink-faint` | `#888888` | captions, disabled |
| `--color-accent` | `#38BDF8` | sky-400 accent |
| `--color-accent-strong` | `#0EA5E9` | hover accent |
| `--color-accent-deep` | `#0284C7` | primary buttons |
| `--color-depth` | `#172554` | deep accent wash (blue-950) |
| `--color-success` | `#34D399` | success (saved / confirmed) |
| `--color-success-deep` | `#059669` | success button |
| `--color-danger` | `#F87171` | destructive text / warning |
| `--color-danger-deep` | `#DC2626` | destructive button |
| `--color-warning` | `#FBBF24` | amber highlights |

### 2.2 Typography

| Token | Stack |
|---|---|
| `--font-display` | `"New York", "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, ui-serif, serif` |
| `--font-body` | `"Inter", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif` |
| `--font-mono` | `ui-monospace, "Cascadia Code", "SF Mono", Consolas, "Liberation Mono", Menlo, monospace` |

Local-first stacks **by design**: zero network dependency, immediate render, no web-font bill. (A hosted display serif, e.g. Fraunces, is a staged later upgrade — swap the stack only.)

### 2.3 Shadow / Depth

| Token | Value | Usage |
|---|---|---|
| `--shadow-card` | `0 10px 34px -14px rgba(2,6,23,.55)` | resting card elevation |
| `--shadow-pop` | `0 24px 60px -18px rgba(2,6,23,.65)` | dialog/sheet/snackbar |
| `--shadow-glow` | `0 0 0 1px rgba(56,189,248,.28), 0 10px 34px -14px rgba(2,6,23,.55)` | focused/interactive |

### 2.4 Spacing

No new tokens — **one stack**: Tailwind's 4px base (`spacing`), used at fixed rhythm: `gap-2/3/4/6/8`, `p-4/6/8`, `px-4/6`, `space-y-*`. Cards: `p-5` (22px→20px) / `p-6` panels. The `<Stack>` primitive enforces the rhythm.

---

## 3. Typography Primitives

| Class / Component | Spec | Usage |
|---|---|---|
| `.text-eyebrow` | 11px, semibold, `0.14em` tracking, uppercase, ink-faint | micro-labels above displays |
| `.text-display` | serif 30px→36px, medium, tight, ink-hi | page hero / day greeting |
| `.text-display-sm` | serif 24px, medium, ink-hi | section heroes |
| `.text-title` | 18px semibold ink-hi | card titles, dialogs |
| `.text-body` | 14px regular ink-mid | UI body |
| `.text-prose` | 14px relaxed ink-low | journal/editorial prose |
| `.text-caption` | 12px ink-faint | captions, metadata |
| `.text-mono-label` | 11px mono ink-low | technical meta (model, ids) |

`<Text variant="display|title|body|prose|caption|eyebrow|mono" as="h1…p">` wraps these.

---

## 4. Component Inventory

All in `src/components/ui/`. Every component: semantic element, `aria-*` where relevant, backgrounds from tokens, `hover` affordances, and **no `console.*`** in render paths.

| Component | File | Key API | Notes |
|---|---|---|---|
| Button | `Button.tsx` | `variant: primary\|secondary\|subtle\|ghost\|outline\|danger`, `size: sm\|md\|lg`, `loading`, `icon` | loading swaps in `<Spinner>`; disabled semantics native |
| TextField | `TextField.tsx` | `label`, `hint`, `error`, `as: input\|textarea\|select` | error state changes border + `aria-invalid` |
| Switch | `Switch.tsx` | `checked`, `onCheckedChange`, `label` | `role="switch"` |
| Card | `Card.tsx` | `variant: flat\|elevated\|inset`, `interactive`, `CardHeader/Body/Footer` | interactive = `<button>` w/ hover |
| Text | `Text.tsx` | `variant`, `as` | §3 |
| Stack | `Stack.tsx` | `direction`, `gap: 2–12` (grid of 4px) | spacing rhythm |
| Badge | `Badge.tsx` | `tone: neutral\|accent\|success\|warning\|danger\|ink`, `size`, `dot` | statuses, modes |
| Avatar | `Avatar.tsx` | `name`, `src?`, `size`, `ring?` | initials fallback |
| Tooltip | `Tooltip.tsx` | `content`, `side: top\|bottom`, `children` | hover+focus, `role="tooltip"`, Esc dismiss |
| Spinner | `Spinner.tsx` | `size` | `aria-hidden`, ring + accent arc |
| Skeleton | `Skeleton.tsx` | `Skeleton`, `SkeletonText(lines)`, `SkeletonCard` | shimmer from tokens |
| EmptyState | `EmptyState.tsx` | `icon`, `title`, `description`, `actions?`, `compact?` | warm invitation, tonal icon |
| ErrorState | `ErrorState.tsx` | `InlineError`, `FullPageError`, `message`, `onRetry?` | friendly copy only |
| ConfirmDialog | `ConfirmDialog.tsx` | `title, message, confirmLabel, cancelLabel, onConfirm, onCancel, tone?` | built on Dialog |
| Dialog | `Dialog.tsx` | `size: sm\|md\|lg\|xl\|2xl`, `icon`, `footer`, `headerExtra`, focus-trap, Escape, backdrop | superset of legacy Modal |
| Sheet | `Sheet.tsx` | `side: right\|bottom`, `size`, focus-trap, Escape, backdrop | bottom sheet on mobile, side panel ≥md |
| Tabs | `Tabs.tsx` | `Tabs/Trigger/Panel`, `value/onValueChange`, arrow-key roving + Home/End | ARIA tabs pattern |
| Navigation | `Navigation.tsx` | `NavItem`, `BottomNavigation(items)` | mobile bottom nav (5 slots) per spec §28 |
| LoadingState | `LoadingState.tsx` | `label?`, `inline?` | centered/harness block |
| Kbd | `Kbd.tsx` | `children` | key hints (⌘K) |

### Dialog & Sheet (overlays)

- Both: `z-[70]`, backdrop `bg-black/70 backdrop-blur-sm`, motion variants from `src/lib/animations.ts`, focus trap + scroll lock + focus restore (`hooks/useFocusTrap.ts`), Escape closes, backdrop click closes (configurable).
- Dialog default `size=md` (max-w-lg) — visual-identical to the legacy Modal default.
- Sheet is responsive via `useMediaQuery('(min-width: 768px)')`: mobile = bottom sheet (`rounded-t-2xl`, `max-h-[88vh]`), desktop = right side panel.

### Tabs accessibility

`TabList` with `role="tablist"`, triggers `role="tab"`, panels `role="tabpanel"`, all labeled by auto-generated ids; ArrowLeft/Right/Home/End roves, Enter/Space activates (native button).

---

## 5. Responsive Behavior

| Breakpoint | Nav | Surfaces |
|---|---|---|
| **Mobile** (<640) | Bottom Navigation (Journal · Memories · Timeline · Ask · Profile) | stacked cards; Sheet = bottom; single-column gallery |
| **Tablet** (640–1024) | compact top bar; optional rail | 2-col grids; Sheet = side panel (md) |
| **Desktop** (≥1024) | Sidebar + top bar | 3-col grids; dialogs centered; Sheet = right panel |

Rules: text never smaller than 11px; touch targets ≥ 40px (`h-10` default buttons on mobile); horizontal scroll only for tables in dialogs; editor/stage areas stay `min-w-0` to avoid overflow.

---

## 6. Accessibility

- **Keyboard:** full sequential tab through primitives; dialogs trap + restore; tabs arrow-roving; tooltips appear on focus; skip-link already global (`App.tsx`).
- **Focus:** global `:focus-visible` = 2px sky outline + offset (defined in `index.css`); never remove it.
- **Labels:** all inputs pair with `<label>`; icon-only buttons carry `aria-label`.
- **Contrast:** ink-low `#9FB0D4` on page `#070B16` ≈ 8.9:1; ink-faint only for decorative/secondary artifacts; buttons use white-on-deep-navy accents.
- **Motion:** global `@media (prefers-reduced-motion: reduce)` zeroes durations; `MotionConfig reducedMotion="user"` in `App.tsx` covers `motion`/`AnimatePresence`.
- **Status:** toasts use `role="status"/"alert"` + `aria-live`; switches use `role="switch"` + `aria-checked`.

---

## 7. Motion

- Eases: `cubic-bezier(0.22, 1, 0.36, 1)` (expo-out) for entrances; short `0.16–0.3s`.
- Palette: `fadeUp`, `fadeUpSmall`, `backdrop`, `panel`, `toast` variants in `src/lib/animations.ts` (existing).
- Rule: motion communicates *state change*, never decorates idly. No continuous loops outside the ambient aurora (landing) and skeleton shimmer.

---

## 8. Usage Rules (additive contract)

1. New screens build on these primitives; existing screens migrate opportunistically during their phase — **never** a lock-step rewrite.
2. Do not introduce new hex colors ad hoc — add a token with a review note.
3. Do not disable the global `:focus-visible` outline.
4. Empty states, error states, and loading states are mandatory (spec §44) — never ship a silent void.

---

## 9. Verification Checklist (per component merge)

- [ ] `tsc --noEmit` passes
- [ ] `vite build` passes; bundle-size budget unchanged
- [ ] Reality check on **mobile viewport** (bottom nav/sheets/grids collapse)
- [ ] Tab through: focus visible, order sensible, dialogs trap, tooltips on focus
- [ ] `prefers-reduced-motion` kills animations (CSS guard + MotionConfig)
- [ ] No console errors (React strict-mode clean)