ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_action_check CHECK (action IN ('create','edit','delete','archive','restore'));

CREATE TABLE public.medicines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  generic_name text CHECK (char_length(generic_name) <= 100),
  strength text CHECK (char_length(strength) <= 50),
  form text CHECK (char_length(form) <= 30),
  dose_amount text CHECK (char_length(dose_amount) <= 50),
  times text[] NOT NULL DEFAULT '{}',
  food text NOT NULL DEFAULT 'any' CHECK (food IN ('with','without','any')),
  start_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata')::date),
  end_date date,
  prescribed_by text CHECK (char_length(prescribed_by) <= 100),
  notes text CHECK (char_length(notes) <= 1000),
  archived_at timestamptz,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medicines TO authenticated;
GRANT ALL ON public.medicines TO service_role;
ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own medicines read" ON public.medicines FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own medicines insert" ON public.medicines FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.has_consent(auth.uid()));
CREATE POLICY "own medicines update" ON public.medicines FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own medicines delete" ON public.medicines FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX medicines_user_idx ON public.medicines(user_id);
CREATE TRIGGER medicines_updated BEFORE UPDATE ON public.medicines FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.audit_medicine() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; act text;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; act := 'delete';
  ELSIF TG_OP = 'INSERT' THEN r := NEW; act := 'create';
  ELSE r := NEW;
    IF OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL THEN act := 'archive';
    ELSIF OLD.archived_at IS NOT NULL AND NEW.archived_at IS NULL THEN act := 'restore';
    ELSE act := 'edit'; END IF;
  END IF;
  INSERT INTO public.audit_log(user_id, actor_id, entity, entity_id, action, summary)
  VALUES (r.user_id, auth.uid(), 'medicine', r.id, act, r.name);
  RETURN NULL;
END; $$;
CREATE TRIGGER medicines_audit AFTER INSERT OR UPDATE OR DELETE ON public.medicines FOR EACH ROW EXECUTE FUNCTION public.audit_medicine();

CREATE TABLE public.dose_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  medicine_id uuid NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','taken','skipped','late')),
  logged_at timestamptz,
  snoozed_until timestamptz,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (medicine_id, scheduled_at)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dose_logs TO authenticated;
GRANT ALL ON public.dose_logs TO service_role;
ALTER TABLE public.dose_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own doses read" ON public.dose_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own doses update" ON public.dose_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own doses delete" ON public.dose_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX dose_logs_user_time_idx ON public.dose_logs(user_id, scheduled_at);
CREATE INDEX dose_logs_pending_time_idx ON public.dose_logs(scheduled_at) WHERE status = 'pending';
CREATE TRIGGER dose_logs_updated BEFORE UPDATE ON public.dose_logs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Idempotent dose generation: one row per medicine per clock time (India time), never duplicated.
CREATE OR REPLACE FUNCTION public.generate_doses(_user uuid, _days int DEFAULT 2) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int; today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  INSERT INTO public.dose_logs(user_id, medicine_id, scheduled_at, is_demo)
  SELECT m.user_id, m.id, ((d::date + t::time) AT TIME ZONE 'Asia/Kolkata'), m.is_demo
  FROM public.medicines m
  CROSS JOIN LATERAL unnest(m.times) AS t
  CROSS JOIN LATERAL generate_series(greatest(m.start_date, today), today + _days, interval '1 day') AS d
  WHERE m.archived_at IS NULL
    AND (_user IS NULL OR m.user_id = _user)
    AND (m.end_date IS NULL OR d::date <= m.end_date)
  ON CONFLICT (medicine_id, scheduled_at) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END; $$;
REVOKE EXECUTE ON FUNCTION public.generate_doses(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_doses(uuid, int) TO service_role;

CREATE OR REPLACE FUNCTION public.generate_my_doses() RETURNS int
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public.generate_doses(auth.uid(), 2) WHERE auth.uid() IS NOT NULL
$$;
REVOKE EXECUTE ON FUNCTION public.generate_my_doses() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_my_doses() TO authenticated;

CREATE TABLE public.water_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  logged_at timestamptz NOT NULL DEFAULT now(),
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.water_logs TO authenticated;
GRANT ALL ON public.water_logs TO service_role;
ALTER TABLE public.water_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own water read" ON public.water_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own water insert" ON public.water_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.has_consent(auth.uid()));
CREATE POLICY "own water delete" ON public.water_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX water_logs_user_time_idx ON public.water_logs(user_id, logged_at);

CREATE TABLE public.reminder_settings (
  user_id uuid PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  quiet_start time,
  quiet_end time,
  last_test_sent_at timestamptz,
  last_test_received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminder_settings TO authenticated;
GRANT ALL ON public.reminder_settings TO service_role;
ALTER TABLE public.reminder_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own settings read" ON public.reminder_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own settings insert" ON public.reminder_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own settings update" ON public.reminder_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own settings delete" ON public.reminder_settings FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER reminder_settings_updated BEFORE UPDATE ON public.reminder_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE CHECK (char_length(endpoint) <= 1000),
  p256dh text NOT NULL CHECK (char_length(p256dh) <= 200),
  auth text NOT NULL CHECK (char_length(auth) <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own subs read" ON public.push_subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own subs insert" ON public.push_subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own subs update" ON public.push_subscriptions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own subs delete" ON public.push_subscriptions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX push_subscriptions_user_idx ON public.push_subscriptions(user_id);
CREATE TRIGGER push_subscriptions_updated BEFORE UPDATE ON public.push_subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Every reminder attempt. dedupe_key is unique so the same reminder is never sent twice.
CREATE TABLE public.reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  dose_id uuid REFERENCES public.dose_logs(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('first','second','snooze','test')),
  dedupe_key text NOT NULL UNIQUE,
  scheduled_for timestamptz,
  status text NOT NULL DEFAULT 'sending' CHECK (status IN ('sending','sent','failed','no_device')),
  detail text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reminder_log TO authenticated;
GRANT ALL ON public.reminder_log TO service_role;
ALTER TABLE public.reminder_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reminder log read" ON public.reminder_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX reminder_log_user_time_idx ON public.reminder_log(user_id, created_at DESC);
CREATE INDEX reminder_log_scheduled_idx ON public.reminder_log(scheduled_for);
CREATE TRIGGER reminder_log_updated BEFORE UPDATE ON public.reminder_log FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();