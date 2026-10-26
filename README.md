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

## Unwell check, symptom diary, emergency directory
- `/unwell`: 13 steps, then `decide()` (`src/lib/unwell.ts`) picks Emergency / See a doctor soon / Self-care. High fever = 102 °F or more; repeated vomiting/diarrhoea = 3+ times today. Saved to `unwell_sessions` and `symptom_entries`.
- `/diary`: timeline, manual entries, notes edits, delete with Undo (soft delete); shows that day's meals and taken doses.
- `/emergency` and `/settings/emergency-numbers`: numbers from `emergency_directory`; dialer only, never auto-dial.
- Tests: `src/test/unwell-decision.test.tsx` covers every red flag.

## Tracking (refills, appointments, vitals, water/sleep, insights, emergency card)
- Tables: `appointments`, `vitals`, `hydration_logs` (daily water goal), `sleep_logs`, `emergency_card_tokens`; new medicine columns `tablets_remaining`, `tablets_per_dose`, `missed_dose_instruction`.
- Screens: `/appointments`, `/vitals`, `/water-sleep`, `/insights`, `/card`, public `/c/<token>`.
- Tests: `src/test/tracking.test.tsx` (refill count, streak, insights, diary questions).

## Doctor summary, sharing and export
- `/summary` (More → Summary for my doctor, and the "See a doctor soon" result): pick a date range (default 30 days), sections and editable questions (prefilled from the next appointment). Preview, Make PDF, or Create link.
- `src/lib/summary.ts` is a pure builder (`buildSummary`) used by the preview, the PDF (`summary-pdf.ts`, jsPDF, browser-only) and the shared page, so all three match. Lists and counts only — no interpretation, scoring or advice. Every value carries a source label ("entered by you" / "calculated"); ISO dates, India time, temperatures shown in °F.
- Tables: `doctor_summaries` (each PDF/link generated), `share_links` (token hash only, range, sections, questions, expiry 1/7/30 days, revoked_at, view_count, first/last opened), `share_link_views` (each open).
- Public page `/s/$token` calls `public.open_share_link(token)`, which checks hash, expiry and revocation and records the view; then the server reads only that owner's rows for that range. Bad/expired/revoked → "This link is not available."
- Download my data is a ZIP: `carebuddy-data.json`, one CSV per kind of data, `README.txt`. Delete my account also removes share links, their view logs and summaries.
- Tests: `src/test/summary.test.tsx`.

## Sick-day mode, meal ideas, caregivers
- Sick-day mode (`/sick-day`, `sick_day_sessions`): started only by the user from a self-care result. Rules in `src/lib/sickday.ts` (pure, tested): water push every 2 h while awake (07:00–22:00 India time and outside quiet hours), check-in push every 6 h with Better / Same / Worse; red flags always show EMERGENCY. Check-ins are stored on the session and in the symptom diary (`source = 'sick_day'`). Doctor's Plan symptom medicines are shown as text only.
- Meal ideas (`getMealIdeas` in `plan.functions.ts`): sends only diet rules, foods to avoid and allergies; reply must pass `checkMealIdeas()`; cap 10/day via `claim_meal_idea_call()`. No diet rules → fixed general tips, no AI call.
- Caregivers: `caregiver_grants` (single-use 3-day invite, hashed; categories adherence / not-marked alerts / appointments), `caregiver_access_log`. Caregivers read only through `get_caregiver_dashboard(grant)` (active grant for the caller, switched-on categories only, logs each view). Pause/revoke takes effect on the next read. Missed-dose alerts run in the reminder job (2 h after the dose time, dedupe key per grant+dose). Activity records invite/grant/edit/pause/resume/revoke/cancel.
- Tests: `src/test/sickday-caregiver.test.tsx`.

## Known limitations
- CareBuddy is **not a medical device**, a doctor, a pharmacist or an emergency service. It never diagnoses or recommends medicines; it only repeats the plan you enter from your doctor.
- Reminders are checked every 5 minutes, so a reminder **can arrive up to 5 minutes late** (second reminders 15–20 minutes after the first).
- **Push on iPhone/iPad needs the Home Screen**: open in Safari, Share → Add to Home Screen, then turn on reminders from the installed app (iOS 16.4+).
- Notifications depend on the phone and browser; battery savers or blocked permissions can stop them. Use Reminder health to check.
- AI meal notes and meal ideas can be unavailable or rejected by the safety filter; meals still save and no other feature uses AI.
- The emergency number list is for India; numbers can differ by area. The app only opens the phone dialer and never calls anyone itself.
- Open share / emergency card pages already loaded in a browser keep showing what was loaded until refreshed; new loads stop at once after revoke or expiry.
