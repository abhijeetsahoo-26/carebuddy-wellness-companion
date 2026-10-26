# CareBuddy

A personal medication, meal and symptom companion. **Not** a doctor, pharmacist, diagnosis tool, medical device or emergency service.

## Setup
1. `bun install`
2. `bun run dev` — the backend (Lovable Cloud) is already connected through `.env`.
3. Sign up with email or Google. New users accept the privacy notice, then go through onboarding.

## Architecture
- TanStack Start (React 19, TypeScript strict), Tailwind v4 tokens in `src/styles.css`.
- `src/components/AppShell.tsx` — sign-in / consent / onboarding gate, bottom tabs, Emergency button, footer.
- `src/lib/validation.ts` — zod schemas shared by forms and server functions.
- `src/lib/carebuddy.functions.ts` — all writes, export and account deletion (server functions, `requireSupabaseAuth`).
- `src/lib/errors.ts` — central friendly error messages; `src/components/States.tsx` — loading/empty/error states.
- Reads use the browser client and are scoped by Row Level Security.

## Tables (all with RLS, `user_id`, `created_at`, `updated_at`)
| Table | Purpose |
|---|---|
| `consents` | consent version + timestamp. `has_consent()` gates inserts on health tables. |
| `profiles` | onboarding answers + saved progress (`onboarding_step`, `onboarding_done`). |
| `emergency_contacts` | name, phone, relationship, `is_demo`. |
| `medicines` | the user's own entries from their doctor's plan; `times` are India-time clock times; archive = `archived_at`. |
| `dose_logs` | one row per scheduled dose (UTC), unique per medicine+time; status pending/taken/skipped/late, `logged_at`, `snoozed_until`. |
| `water_logs` | one row per glass. |
| `reminder_settings` | on/off, quiet hours, last test sent/received. |
| `push_subscriptions` | one row per browser/device that allowed notifications. |
| `reminder_log` | every reminder attempt with status; unique `dedupe_key` stops double sends. |
| `audit_log` | append-only; written only by the `write_audit(entity)` trigger. Attach it to medicines and Doctor's Plan tables when they are added. |

## Reminders
- `generate_doses()` (SQL, idempotent) creates the next 2 days of doses; it runs on every reminder job and after medicine changes.
- A managed schedule calls `POST /api/public/jobs/reminders` every 5 minutes. It sends "Time for your medicine" for due doses, a second push after 15 minutes if still unmarked, and snoozed reminders when the snooze ends. Quiet hours delay sends.
- Notification buttons (Taken, Skip, Snooze 10/30) call `/api/public/push-action` with a signed, expiring token.
- Push uses VAPID keys derived from the `VAPID_SEED` secret; button tokens use `REMINDER_ACTION_SECRET`.
- `public/push-sw.js` is a push-only service worker (no offline caching). `public/manifest.webmanifest` makes the app installable.

## Demo data
"Try with sample data" (More tab) inserts sample contacts, sample medicines and a week of sample doses with `is_demo = true`, shown with a "Sample" badge, removed in one tap. SQL equivalent: `scripts/seed-demo.sql`.

## How to test
- `bunx vitest run` — routing, validation and reminder-rule tests.
- Reminders: open the published app on a phone, More → Reminders → turn on → Send test reminder → Reminder health.
- Manual: sign up → consent → onboarding (skip steps) → More → Try sample data → Activity shows entries → Download my data → Delete account.

## Doctor's Plan and meals
- Tables: `doctor_plan_versions` (one row per save), `doctor_plan_medicines`, `doctor_plan_diet`, `doctor_plan_limits` (children of a version), `meals` (soft delete via `deleted_at` for Undo), `ai_usage` (daily AI-call counter, cap 20/day).
- Prescription uploads: private `prescriptions` storage bucket, folder per user.
- AI note: `src/lib/meal-ai.server.ts` (Lovable AI, meal text only) → `checkMealNote()` in `src/lib/meal-note.ts`. Any failure, cap or blocked word shows "Note unavailable"; the meal is always kept.
- Tests: `bunx vitest run` (includes `src/test/plan-meals.test.tsx`).
