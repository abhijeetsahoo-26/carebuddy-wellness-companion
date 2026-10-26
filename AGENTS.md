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
