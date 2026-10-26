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
| `audit_log` | append-only; written only by the `write_audit(entity)` trigger. Attach it to medicines and Doctor's Plan tables when they are added. |

## Demo data
"Try with sample data" (More tab) inserts rows with `is_demo = true`, shown with a "Sample" badge, removed in one tap. SQL equivalent: `scripts/seed-demo.sql`.

## How to test
- `bunx vitest run` — routing and validation tests.
- Manual: sign up → consent → onboarding (skip steps) → More → Try sample data → Activity shows entries → Download my data → Delete account.
