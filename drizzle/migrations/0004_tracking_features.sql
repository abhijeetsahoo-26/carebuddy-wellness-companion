-- 1. Refills and missed-dose instruction (nullable / defaulted, so existing medicines keep working)
ALTER TABLE public.medicines ADD COLUMN tablets_remaining numeric CHECK (tablets_remaining IS NULL OR tablets_remaining >= 0);
ALTER TABLE public.medicines ADD COLUMN tablets_per_dose numeric NOT NULL DEFAULT 1 CHECK (tablets_per_dose > 0 AND tablets_per_dose <= 100);
ALTER TABLE public.medicines ADD COLUMN stock_set_at timestamptz;
ALTER TABLE public.medicines ADD COLUMN missed_dose_instruction text CHECK (char_length(missed_dose_instruction) <= 500);
ALTER TABLE public.dose_logs ADD COLUMN stock_deducted numeric NOT NULL DEFAULT 0;

-- Stock moves with the dose status, whichever path marks it (app, notification button, undo).
CREATE OR REPLACE FUNCTION public.dose_stock() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE was boolean := OLD.status IN ('taken','late'); now_taken boolean := NEW.status IN ('taken','late'); per numeric; rem numeric;
BEGIN
  IF now_taken AND NOT was THEN
    SELECT tablets_per_dose, tablets_remaining INTO per, rem FROM public.medicines WHERE id = NEW.medicine_id FOR UPDATE;
    IF rem IS NOT NULL THEN
      NEW.stock_deducted := least(per, rem);
      UPDATE public.medicines SET tablets_remaining = rem - NEW.stock_deducted WHERE id = NEW.medicine_id;
    END IF;
  ELSIF was AND NOT now_taken AND OLD.stock_deducted > 0 THEN
    UPDATE public.medicines SET tablets_remaining = tablets_remaining + OLD.stock_deducted
      WHERE id = NEW.medicine_id AND tablets_remaining IS NOT NULL;
    NEW.stock_deducted := 0;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER dose_logs_stock BEFORE UPDATE OF status ON public.dose_logs FOR EACH ROW EXECUTE FUNCTION public.dose_stock();

-- Automatic stock changes are not user edits: keep them out of Activity.
CREATE OR REPLACE FUNCTION public.audit_medicine() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; act text;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; act := 'delete';
  ELSIF TG_OP = 'INSERT' THEN r := NEW; act := 'create';
  ELSE r := NEW;
    IF (to_jsonb(NEW) - 'tablets_remaining' - 'updated_at') = (to_jsonb(OLD) - 'tablets_remaining' - 'updated_at') THEN RETURN NULL; END IF;
    IF OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL THEN act := 'archive';
    ELSIF OLD.archived_at IS NOT NULL AND NEW.archived_at IS NULL THEN act := 'restore';
    ELSE act := 'edit'; END IF;
  END IF;
  INSERT INTO public.audit_log(user_id, actor_id, entity, entity_id, action, summary)
  VALUES (r.user_id, auth.uid(), 'medicine', r.id, act, r.name);
  RETURN NULL;
END; $$;

ALTER TABLE public.reminder_log DROP CONSTRAINT IF EXISTS reminder_log_kind_check;
ALTER TABLE public.reminder_log ADD CONSTRAINT reminder_log_kind_check CHECK (kind IN ('first','second','snooze','test','refill','appt_day','appt_2h'));

-- 3. Appointments
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  doctor text NOT NULL CHECK (char_length(doctor) BETWEEN 1 AND 100),
  starts_at timestamptz NOT NULL,
  location text CHECK (char_length(location) <= 200),
  purpose text CHECK (char_length(purpose) <= 200),
  notes text CHECK (char_length(notes) <= 1000),
  questions text[] NOT NULL DEFAULT '{}',
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own appts read" ON public.appointments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own appts insert" ON public.appointments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.has_consent(auth.uid()));
CREATE POLICY "own appts update" ON public.appointments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own appts delete" ON public.appointments FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX appointments_user_time_idx ON public.appointments(user_id, starts_at);
CREATE INDEX appointments_time_idx ON public.appointments(starts_at);
CREATE TRIGGER appointments_updated BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER appointments_audit AFTER INSERT OR UPDATE OR DELETE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.write_audit('appointment');

-- 4. Vitals (entered by the user only)
CREATE TABLE public.vitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('weight','blood_pressure','sugar_fasting','sugar_after_meal','temperature')),
  value numeric NOT NULL,
  value2 numeric,
  unit text NOT NULL CHECK (unit IN ('kg','mmHg','mg/dL','°C','°F')),
  measured_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'entered_by_you' CHECK (source = 'entered_by_you'),
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vitals TO authenticated;
GRANT ALL ON public.vitals TO service_role;
ALTER TABLE public.vitals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own vitals read" ON public.vitals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own vitals insert" ON public.vitals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.has_consent(auth.uid()));
CREATE POLICY "own vitals update" ON public.vitals FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own vitals delete" ON public.vitals FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX vitals_user_kind_time_idx ON public.vitals(user_id, kind, measured_at);
CREATE TRIGGER vitals_updated BEFORE UPDATE ON public.vitals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER vitals_audit AFTER INSERT OR UPDATE OR DELETE ON public.vitals FOR EACH ROW EXECUTE FUNCTION public.write_audit('vital');

-- 5. Hydration goal (one row per day the goal was set; the latest on or before a day applies) and sleep
CREATE TABLE public.hydration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  day date NOT NULL,
  goal_glasses int CHECK (goal_glasses IS NULL OR goal_glasses BETWEEN 1 AND 30),
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, day)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hydration_logs TO authenticated;
GRANT ALL ON public.hydration_logs TO service_role;
ALTER TABLE public.hydration_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own hydration read" ON public.hydration_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own hydration insert" ON public.hydration_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.has_consent(auth.uid()));
CREATE POLICY "own hydration update" ON public.hydration_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own hydration delete" ON public.hydration_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX hydration_logs_user_day_idx ON public.hydration_logs(user_id, day DESC);
CREATE TRIGGER hydration_logs_updated BEFORE UPDATE ON public.hydration_logs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER hydration_logs_audit AFTER INSERT OR UPDATE OR DELETE ON public.hydration_logs FOR EACH ROW EXECUTE FUNCTION public.write_audit('water_goal');

CREATE TABLE public.sleep_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  night date NOT NULL,
  hours numeric NOT NULL CHECK (hours >= 0 AND hours <= 24),
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, night)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sleep_logs TO authenticated;
GRANT ALL ON public.sleep_logs TO service_role;
ALTER TABLE public.sleep_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sleep read" ON public.sleep_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own sleep insert" ON public.sleep_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.has_consent(auth.uid()));
CREATE POLICY "own sleep update" ON public.sleep_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own sleep delete" ON public.sleep_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX sleep_logs_user_night_idx ON public.sleep_logs(user_id, night DESC);
CREATE TRIGGER sleep_logs_updated BEFORE UPDATE ON public.sleep_logs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER sleep_logs_audit AFTER INSERT OR UPDATE OR DELETE ON public.sleep_logs FOR EACH ROW EXECUTE FUNCTION public.write_audit('sleep');

-- 8. Emergency card: what shows, plus revocable share links (only a hash of the token is stored)
ALTER TABLE public.profiles ADD COLUMN card_prefs jsonb NOT NULL DEFAULT
  '{"name":true,"allergies":true,"conditions":true,"medicines":true,"doctor":true,"contacts":true}'::jsonb;

CREATE TABLE public.emergency_card_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emergency_card_tokens TO authenticated;
GRANT ALL ON public.emergency_card_tokens TO service_role;
ALTER TABLE public.emergency_card_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own card tokens read" ON public.emergency_card_tokens FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own card tokens insert" ON public.emergency_card_tokens FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.has_consent(auth.uid()));
CREATE POLICY "own card tokens update" ON public.emergency_card_tokens FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own card tokens delete" ON public.emergency_card_tokens FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX emergency_card_tokens_user_idx ON public.emergency_card_tokens(user_id);
CREATE TRIGGER emergency_card_tokens_updated BEFORE UPDATE ON public.emergency_card_tokens FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER emergency_card_tokens_audit AFTER INSERT OR UPDATE OR DELETE ON public.emergency_card_tokens FOR EACH ROW EXECUTE FUNCTION public.write_audit('card_link');

-- No-login card view: returns only the items the owner switched on, for a live, unrevoked token.
CREATE OR REPLACE FUNCTION public.get_emergency_card(_token text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE uid uuid; p record; prefs jsonb; out jsonb := '{}'::jsonb;
BEGIN
  IF _token IS NULL OR length(_token) < 32 OR length(_token) > 128 THEN RETURN NULL; END IF;
  SELECT user_id INTO uid FROM public.emergency_card_tokens
   WHERE token_hash = encode(extensions.digest(_token, 'sha256'), 'hex') AND revoked_at IS NULL;
  IF uid IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO p FROM public.profiles WHERE user_id = uid;
  prefs := coalesce(p.card_prefs, '{}'::jsonb);
  IF (prefs->>'name')::boolean THEN out := out || jsonb_build_object('name', p.full_name); END IF;
  IF (prefs->>'allergies')::boolean THEN out := out || jsonb_build_object('allergies', p.allergies); END IF;
  IF (prefs->>'conditions')::boolean THEN out := out || jsonb_build_object('conditions', p.conditions); END IF;
  IF (prefs->>'doctor')::boolean THEN out := out || jsonb_build_object('doctor', jsonb_build_object('name', p.doctor_name, 'phone', p.doctor_phone)); END IF;
  IF (prefs->>'medicines')::boolean THEN
    out := out || jsonb_build_object('medicines', coalesce((SELECT jsonb_agg(jsonb_build_object('name', m.name, 'strength', m.strength, 'dose', m.dose_amount) ORDER BY m.created_at)
      FROM public.medicines m WHERE m.user_id = uid AND m.archived_at IS NULL), '[]'::jsonb));
  END IF;
  IF (prefs->>'contacts')::boolean THEN
    out := out || jsonb_build_object('contacts', coalesce((SELECT jsonb_agg(jsonb_build_object('name', c.name, 'phone', c.phone, 'relationship', c.relationship) ORDER BY c.created_at)
      FROM public.emergency_contacts c WHERE c.user_id = uid), '[]'::jsonb));
  END IF;
  RETURN out;
END; $$;
REVOKE ALL ON FUNCTION public.get_emergency_card(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_emergency_card(text) TO anon, authenticated;