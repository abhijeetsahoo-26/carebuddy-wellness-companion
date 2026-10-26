<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- All writes go through server functions in `src/lib/carebuddy.functions.ts` with `requireSupabaseAuth`; reads may use the browser client under RLS. Why: one validated write path.
- Input rules live in `src/lib/validation.ts` and are used by both client and server. Why: identical validation.
- Signed-in screens wrap in `AppShell` (gate: sign-in → consent → onboarding). Why: no health data before consent; RLS `has_consent()` enforces it server-side too.
- Audit entries are written only by the `public.write_audit(entity)` trigger; attach it to every medicine / Doctor's Plan / contact table. Why: users cannot forge or edit history.
- Demo rows carry `is_demo = true`. Why: one-tap removal and clear labelling.
- AI is never used for alerts, SOS or red-flag screening (`/unwell` uses a fixed list).
- Doses come only from `public.generate_doses()` (idempotent, ON CONFLICT DO NOTHING); never insert scheduled doses from app code except demo history. Why: no duplicates.
- Every push is claimed by inserting `reminder_log.dedupe_key` before sending. Why: a reminder is never sent twice, even if the job overlaps.
- Notification payloads never contain medicine names or health data; the shown title is fixed. Why: lock-screen privacy.
- `public/push-sw.js` is push-only; do not add page caching to it. Why: avoid stale previews and app versions.
- Doctor's Plan versions are immutable: save only via `public.save_doctor_plan(jsonb)` (one atomic new version); never UPDATE plan rows. Why: read-only history.
- Plan and meal server functions live in `src/lib/plan.functions.ts`. Why: keep the core functions file small.
- AI meal notes send only the meal text, are capped per user per day via `public.claim_ai_call()`, and must pass `checkMealNote()` server-side before being stored. Why: no medical claims reach the user.
- Prescription files live in the private `prescriptions` bucket under `<user_id>/`; never extract or interpret them. Why: user reference only.
- Unwell triage is the pure `decide()` in `src/lib/unwell.ts` (no AI); the server re-decides from the answers before saving. Emergency checks run first and always win. Why: deterministic, tested safety logic.
- Diary, unwell-check and emergency-number server functions live in `src/lib/diary.functions.ts`. Why: grouped by feature.
- `emergency_directory` rows with `user_id IS NULL` are shared defaults; a user's row with the same `key` overrides it for them only. `src/lib/directory.ts` keeps a built-in copy so Emergency works even if loading fails. Why: emergency numbers must always show.
- Tablet counts change only in the `dose_logs_stock` trigger (Taken/Late deducts, going back restores `stock_deducted`); `applyDoseToStock()` in `src/lib/tracking.ts` mirrors it for tests. Why: every path (app, notification button, undo) stays consistent.
- Refill/appointment pushes run in the reminder job, are claimed via `reminder_log.dedupe_key`, and use fixed titles from `PUSH_TITLES` / `push-sw.js`. Why: no duplicates, no health data on lock screen.
- Streak, weekly insights and diary-question prefill are pure functions in `src/lib/tracking.ts`; insight wording states counts only, never causes or advice. Why: deterministic, tested, non-diagnostic.
- Tracking server functions live in `src/lib/tracking.functions.ts`. Public emergency card reads go only through `public.get_emergency_card(token)` (hashed, revocable tokens, switched-on items only). Why: no-login access without exposing other data.
