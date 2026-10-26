-- 1. Sick-day mode
CREATE TABLE public.sick_day_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  unwell_session_id uuid REFERENCES public.unwell_sessions(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  checkins jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sick_day_sessions TO authenticated;
GRANT ALL ON public.sick_day_sessions TO service_role;
ALTER TABLE public.sick_day_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sick days read" ON public.sick_day_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own sick days insert" ON public.sick_day_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.has_consent(auth.uid()));
CREATE POLICY "own sick days update" ON public.sick_day_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own sick days delete" ON public.sick_day_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE UNIQUE INDEX sick_day_one_active_idx ON public.sick_day_sessions(user_id) WHERE ended_at IS NULL;
CREATE INDEX sick_day_user_idx ON public.sick_day_sessions(user_id, started_at DESC);
CREATE INDEX sick_day_active_idx ON public.sick_day_sessions(started_at) WHERE ended_at IS NULL;
CREATE TRIGGER sick_day_sessions_updated BEFORE UPDATE ON public.sick_day_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.symptom_entries DROP CONSTRAINT IF EXISTS symptom_entries_source_check;
ALTER TABLE public.symptom_entries ADD CONSTRAINT symptom_entries_source_check CHECK (source IN ('check','manual','sick_day'));

ALTER TABLE public.reminder_log DROP CONSTRAINT IF EXISTS reminder_log_kind_check;
ALTER TABLE public.reminder_log ADD CONSTRAINT reminder_log_kind_check CHECK (kind IN ('first','second','snooze','test','refill','appt_day','appt_2h','sick_water','sick_checkin','caregiver_missed'));

-- 2. Meal ideas: own daily counter (cap set by the app, hard ceiling 10)
ALTER TABLE public.ai_usage ADD COLUMN idea_calls integer NOT NULL DEFAULT 0;
CREATE OR REPLACE FUNCTION public.claim_meal_idea_call(_cap integer) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); d date := (now() AT TIME ZONE 'Asia/Kolkata')::date; n int;
BEGIN
  IF uid IS NULL OR NOT public.has_consent(uid) THEN RETURN false; END IF;
  INSERT INTO public.ai_usage(user_id, day, calls, idea_calls) VALUES (uid, d, 0, 1)
  ON CONFLICT (user_id, day) DO UPDATE SET idea_calls = ai_usage.idea_calls + 1, updated_at = now()
  WHERE ai_usage.idea_calls < least(_cap, 10)
  RETURNING idea_calls INTO n;
  RETURN n IS NOT NULL;
END; $$;
REVOKE ALL ON FUNCTION public.claim_meal_idea_call(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_meal_idea_call(integer) TO authenticated;

-- 3. Caregivers
CREATE TABLE public.caregiver_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,              -- the person who shares
  caregiver_id uuid,                  -- set when the invite is accepted
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 60),
  invite_hash text UNIQUE,
  invite_expires_at timestamptz,
  accepted_at timestamptz,
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','active','paused','revoked','cancelled')),
  can_adherence boolean NOT NULL DEFAULT false,
  can_missed_alerts boolean NOT NULL DEFAULT false,
  can_appointments boolean NOT NULL DEFAULT false,
  alerts_enabled boolean NOT NULL DEFAULT true, -- the caregiver's own on/off for alerts
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (caregiver_id IS NULL OR caregiver_id <> user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.caregiver_grants TO authenticated;
GRANT ALL ON public.caregiver_grants TO service_role;
ALTER TABLE public.caregiver_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads grants" ON public.caregiver_grants FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "caregiver reads live grants" ON public.caregiver_grants FOR SELECT TO authenticated USING (auth.uid() = caregiver_id AND status IN ('active','paused'));
CREATE POLICY "owner creates grants" ON public.caregiver_grants FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND caregiver_id IS NULL AND public.has_consent(auth.uid()));
CREATE POLICY "owner updates grants" ON public.caregiver_grants FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner deletes grants" ON public.caregiver_grants FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX caregiver_grants_user_idx ON public.caregiver_grants(user_id, created_at DESC);
CREATE INDEX caregiver_grants_caregiver_idx ON public.caregiver_grants(caregiver_id) WHERE caregiver_id IS NOT NULL;
CREATE TRIGGER caregiver_grants_updated BEFORE UPDATE ON public.caregiver_grants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Owner cannot change who the caregiver is; the caregiver can only change alerts_enabled (via function).
CREATE OR REPLACE FUNCTION public.caregiver_grants_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_setting('carebuddy.accepting', true) = 'on' THEN RETURN NEW; END IF;
  IF NEW.caregiver_id IS DISTINCT FROM OLD.caregiver_id OR NEW.user_id <> OLD.user_id OR NEW.accepted_at IS DISTINCT FROM OLD.accepted_at THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  IF OLD.status IN ('revoked','cancelled') AND NEW.status <> OLD.status THEN RAISE EXCEPTION 'access already ended'; END IF;
  IF NEW.status = 'active' AND OLD.status = 'invited' THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF NEW.status IN ('revoked','cancelled') THEN NEW.invite_hash := NULL; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER caregiver_grants_guard BEFORE UPDATE ON public.caregiver_grants FOR EACH ROW EXECUTE FUNCTION public.caregiver_grants_guard();

-- Activity entries for invites, grants, changes, pauses and revocations.
CREATE OR REPLACE FUNCTION public.write_caregiver_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE act text; r record;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; act := 'delete';
  ELSIF TG_OP = 'INSERT' THEN r := NEW; act := 'invite';
  ELSE
    r := NEW;
    IF NEW.status <> OLD.status THEN
      act := CASE NEW.status WHEN 'active' THEN (CASE WHEN OLD.status = 'paused' THEN 'resume' ELSE 'grant' END)
        WHEN 'paused' THEN 'pause' WHEN 'revoked' THEN 'revoke' WHEN 'cancelled' THEN 'cancel' ELSE 'edit' END;
    ELSIF (NEW.can_adherence, NEW.can_missed_alerts, NEW.can_appointments) IS DISTINCT FROM (OLD.can_adherence, OLD.can_missed_alerts, OLD.can_appointments) THEN act := 'edit';
    ELSE RETURN NULL; END IF;
  END IF;
  INSERT INTO public.audit_log(user_id, actor_id, entity, entity_id, action, summary)
  VALUES (r.user_id, auth.uid(), 'caregiver', r.id, act, r.label);
  RETURN NULL;
END; $$;
CREATE TRIGGER caregiver_grants_audit AFTER INSERT OR UPDATE OR DELETE ON public.caregiver_grants FOR EACH ROW EXECUTE FUNCTION public.write_caregiver_audit();

CREATE TABLE public.caregiver_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,          -- whose data was viewed
  caregiver_id uuid NOT NULL,
  grant_id uuid REFERENCES public.caregiver_grants(id) ON DELETE CASCADE,
  categories text[] NOT NULL DEFAULT '{}',
  viewed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, DELETE ON public.caregiver_access_log TO authenticated;
GRANT ALL ON public.caregiver_access_log TO service_role;
ALTER TABLE public.caregiver_access_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads access log" ON public.caregiver_access_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owner deletes access log" ON public.caregiver_access_log FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX caregiver_access_log_user_idx ON public.caregiver_access_log(user_id, viewed_at DESC);
CREATE INDEX caregiver_access_log_grant_idx ON public.caregiver_access_log(grant_id);

-- Accept a single-use, 3-day invite as the signed-in caregiver.
CREATE OR REPLACE FUNCTION public.accept_caregiver_invite(_token text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE g record; uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR _token IS NULL OR length(_token) < 32 OR length(_token) > 128 THEN RETURN NULL; END IF;
  SELECT * INTO g FROM public.caregiver_grants
   WHERE invite_hash = encode(extensions.digest(_token, 'sha256'), 'hex')
     AND status = 'invited' AND invite_expires_at > now() FOR UPDATE;
  IF g.id IS NULL OR g.user_id = uid THEN RETURN NULL; END IF;
  PERFORM set_config('carebuddy.accepting', 'on', true);
  UPDATE public.caregiver_grants SET caregiver_id = uid, accepted_at = now(), status = 'active', invite_hash = NULL WHERE id = g.id;
  PERFORM set_config('carebuddy.accepting', 'off', true);
  RETURN g.id;
END; $$;
REVOKE ALL ON FUNCTION public.accept_caregiver_invite(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.accept_caregiver_invite(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_caregiver_alerts(_grant uuid, _on boolean) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.caregiver_grants SET alerts_enabled = _on WHERE id = _grant AND caregiver_id = auth.uid() AND status IN ('active','paused');
  RETURN FOUND;
END; $$;
REVOKE ALL ON FUNCTION public.set_caregiver_alerts(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_caregiver_alerts(uuid, boolean) TO authenticated;

-- Caregiver leaves on their own (ends the link, keeps their account).
CREATE OR REPLACE FUNCTION public.leave_caregiver_grant(_grant uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.caregiver_grants SET status = 'revoked' WHERE id = _grant AND caregiver_id = auth.uid() AND status IN ('active','paused');
  RETURN FOUND;
END; $$;
REVOKE ALL ON FUNCTION public.leave_caregiver_grant(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.leave_caregiver_grant(uuid) TO authenticated;

-- Read-only dashboard: only an ACTIVE grant for the calling caregiver, only switched-on categories.
-- Never returns medicine names, diary, meals, numbers or the Doctor's Plan. Every call is logged.
CREATE OR REPLACE FUNCTION public.get_caregiver_dashboard(_grant uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE g record; out jsonb; cats text[] := '{}'; fname text;
  since timestamptz := now() - interval '7 days';
BEGIN
  SELECT * INTO g FROM public.caregiver_grants WHERE id = _grant AND caregiver_id = auth.uid() AND status = 'active';
  IF g.id IS NULL THEN RETURN NULL; END IF;
  SELECT split_part(coalesce(nullif(trim(full_name), ''), 'Your person'), ' ', 1) INTO fname FROM public.profiles WHERE user_id = g.user_id;
  out := jsonb_build_object('first_name', coalesce(fname, 'Your person'));
  IF g.can_adherence THEN
    cats := cats || 'adherence';
    out := out || jsonb_build_object('adherence', (
      SELECT jsonb_build_object('due', count(*), 'taken', count(*) FILTER (WHERE status IN ('taken','late')),
        'skipped', count(*) FILTER (WHERE status = 'skipped'), 'not_marked', count(*) FILTER (WHERE status = 'pending'))
      FROM public.dose_logs WHERE user_id = g.user_id AND scheduled_at >= since AND scheduled_at <= now()));
  END IF;
  IF g.can_missed_alerts THEN
    cats := cats || 'missed';
    out := out || jsonb_build_object('not_marked', coalesce((
      SELECT jsonb_agg(scheduled_at ORDER BY scheduled_at DESC) FROM (
        SELECT scheduled_at FROM public.dose_logs WHERE user_id = g.user_id AND status = 'pending'
          AND scheduled_at >= now() - interval '48 hours' AND scheduled_at <= now() - interval '2 hours'
        ORDER BY scheduled_at DESC LIMIT 20) x), '[]'::jsonb));
  END IF;
  IF g.can_appointments THEN
    cats := cats || 'appointments';
    out := out || jsonb_build_object('appointments', coalesce((
      SELECT jsonb_agg(jsonb_build_object('starts_at', starts_at, 'doctor', doctor, 'location', location) ORDER BY starts_at) FROM (
        SELECT starts_at, doctor, location FROM public.appointments WHERE user_id = g.user_id AND starts_at >= now() ORDER BY starts_at LIMIT 10) a), '[]'::jsonb));
  END IF;
  INSERT INTO public.caregiver_access_log(user_id, caregiver_id, grant_id, categories) VALUES (g.user_id, auth.uid(), g.id, cats);
  RETURN out;
END; $$;
REVOKE ALL ON FUNCTION public.get_caregiver_dashboard(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_caregiver_dashboard(uuid) TO authenticated;