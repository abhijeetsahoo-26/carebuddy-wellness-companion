-- Doctor's Plan: every save is a new, read-only version.
CREATE TABLE public.doctor_plan_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  version_no int NOT NULL,
  attachment_path text,
  attachment_name text,
  attachment_type text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, version_no)
);
GRANT SELECT, INSERT, DELETE ON public.doctor_plan_versions TO authenticated;
GRANT ALL ON public.doctor_plan_versions TO service_role;
ALTER TABLE public.doctor_plan_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own plan versions read" ON public.doctor_plan_versions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own plan versions insert" ON public.doctor_plan_versions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.has_consent(auth.uid()));
CREATE POLICY "own plan versions delete" ON public.doctor_plan_versions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX doctor_plan_versions_user_idx ON public.doctor_plan_versions(user_id, version_no DESC);

CREATE TABLE public.doctor_plan_medicines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.doctor_plan_versions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  position int NOT NULL DEFAULT 0,
  name text NOT NULL,
  dose text,
  interval_text text,
  max_per_day text,
  doctor_name text,
  date_advised date,
  confirmed boolean NOT NULL DEFAULT false,
  confirmed_on date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.doctor_plan_medicines TO authenticated;
GRANT ALL ON public.doctor_plan_medicines TO service_role;
ALTER TABLE public.doctor_plan_medicines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own plan meds read" ON public.doctor_plan_medicines FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own plan meds insert" ON public.doctor_plan_medicines FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.has_consent(auth.uid()));
CREATE POLICY "own plan meds delete" ON public.doctor_plan_medicines FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX doctor_plan_medicines_version_idx ON public.doctor_plan_medicines(version_id, position);
CREATE INDEX doctor_plan_medicines_user_idx ON public.doctor_plan_medicines(user_id);

CREATE TABLE public.doctor_plan_diet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL UNIQUE REFERENCES public.doctor_plan_versions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  diet_rules text,
  foods_to_avoid text,
  special_instructions text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.doctor_plan_diet TO authenticated;
GRANT ALL ON public.doctor_plan_diet TO service_role;
ALTER TABLE public.doctor_plan_diet ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own plan diet read" ON public.doctor_plan_diet FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own plan diet insert" ON public.doctor_plan_diet FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.has_consent(auth.uid()));
CREATE POLICY "own plan diet delete" ON public.doctor_plan_diet FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX doctor_plan_diet_user_idx ON public.doctor_plan_diet(user_id);

CREATE TABLE public.doctor_plan_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.doctor_plan_versions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  metric text NOT NULL CHECK (metric IN ('heart_rate','temperature','oxygen')),
  min_value numeric,
  max_value numeric,
  set_by text,
  set_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (version_id, metric)
);
GRANT SELECT, INSERT, DELETE ON public.doctor_plan_limits TO authenticated;
GRANT ALL ON public.doctor_plan_limits TO service_role;
ALTER TABLE public.doctor_plan_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own plan limits read" ON public.doctor_plan_limits FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own plan limits insert" ON public.doctor_plan_limits FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.has_consent(auth.uid()));
CREATE POLICY "own plan limits delete" ON public.doctor_plan_limits FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX doctor_plan_limits_user_idx ON public.doctor_plan_limits(user_id);

CREATE TRIGGER doctor_plan_versions_audit AFTER INSERT OR DELETE ON public.doctor_plan_versions
FOR EACH ROW EXECUTE FUNCTION public.write_audit('doctor_plan');
CREATE TRIGGER doctor_plan_medicines_audit AFTER INSERT OR DELETE ON public.doctor_plan_medicines
FOR EACH ROW EXECUTE FUNCTION public.write_audit('doctor_plan_medicine');
CREATE TRIGGER doctor_plan_diet_audit AFTER INSERT OR DELETE ON public.doctor_plan_diet
FOR EACH ROW EXECUTE FUNCTION public.write_audit('doctor_plan_diet');
CREATE TRIGGER doctor_plan_limits_audit AFTER INSERT OR DELETE ON public.doctor_plan_limits
FOR EACH ROW EXECUTE FUNCTION public.write_audit('doctor_plan_limit');

-- Saves a whole plan as one new version, atomically. Runs as the caller (RLS applies).
CREATE OR REPLACE FUNCTION public.save_doctor_plan(p jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE vid uuid; vno int; m jsonb; l jsonb; i int := 0; uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('plan:' || uid::text));
  SELECT coalesce(max(version_no), 0) + 1 INTO vno FROM public.doctor_plan_versions WHERE user_id = uid;
  INSERT INTO public.doctor_plan_versions(user_id, version_no, attachment_path, attachment_name, attachment_type, is_demo)
  VALUES (uid, vno, p->>'attachment_path', p->>'attachment_name', p->>'attachment_type', coalesce((p->>'is_demo')::boolean, false))
  RETURNING id INTO vid;
  INSERT INTO public.doctor_plan_diet(version_id, user_id, diet_rules, foods_to_avoid, special_instructions)
  VALUES (vid, uid, p->'diet'->>'diet_rules', p->'diet'->>'foods_to_avoid', p->'diet'->>'special_instructions');
  FOR m IN SELECT * FROM jsonb_array_elements(coalesce(p->'medicines', '[]'::jsonb)) LOOP
    INSERT INTO public.doctor_plan_medicines(version_id, user_id, position, name, dose, interval_text, max_per_day, doctor_name, date_advised, confirmed, confirmed_on)
    VALUES (vid, uid, i, m->>'name', m->>'dose', m->>'interval_text', m->>'max_per_day', m->>'doctor_name',
      nullif(m->>'date_advised','')::date, coalesce((m->>'confirmed')::boolean, false), nullif(m->>'confirmed_on','')::date);
    i := i + 1;
  END LOOP;
  FOR l IN SELECT * FROM jsonb_array_elements(coalesce(p->'limits', '[]'::jsonb)) LOOP
    INSERT INTO public.doctor_plan_limits(version_id, user_id, metric, min_value, max_value, set_by, set_on)
    VALUES (vid, uid, l->>'metric', nullif(l->>'min_value','')::numeric, nullif(l->>'max_value','')::numeric, l->>'set_by', nullif(l->>'set_on','')::date);
  END LOOP;
  RETURN vid;
END; $$;
REVOKE ALL ON FUNCTION public.save_doctor_plan(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_doctor_plan(jsonb) TO authenticated;

-- Prescription uploads: private, each user only sees their own folder.
CREATE POLICY "own prescriptions read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'prescriptions' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own prescriptions insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'prescriptions' AND (storage.foldername(name))[1] = auth.uid()::text AND public.has_consent(auth.uid()));
CREATE POLICY "own prescriptions delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'prescriptions' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Meals
CREATE TABLE public.meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  meal_type text NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
  description text NOT NULL,
  eaten_at timestamptz NOT NULL DEFAULT now(),
  ai_note text,
  ai_note_status text NOT NULL DEFAULT 'pending' CHECK (ai_note_status IN ('pending','ok','unavailable')),
  deleted_at timestamptz,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meals TO authenticated;
GRANT ALL ON public.meals TO service_role;
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own meals read" ON public.meals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own meals insert" ON public.meals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.has_consent(auth.uid()));
CREATE POLICY "own meals update" ON public.meals FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own meals delete" ON public.meals FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX meals_user_time_idx ON public.meals(user_id, eaten_at DESC);
CREATE TRIGGER meals_updated_at BEFORE UPDATE ON public.meals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Daily AI-call counter per user (Asia/Kolkata day). Written only via claim_ai_call().
CREATE TABLE public.ai_usage (
  user_id uuid NOT NULL,
  day date NOT NULL,
  calls int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
GRANT SELECT ON public.ai_usage TO authenticated;
GRANT ALL ON public.ai_usage TO service_role;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ai usage read" ON public.ai_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.claim_ai_call(_cap int) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); d date := (now() AT TIME ZONE 'Asia/Kolkata')::date; n int;
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;
  INSERT INTO public.ai_usage(user_id, day, calls) VALUES (uid, d, 1)
  ON CONFLICT (user_id, day) DO UPDATE SET calls = ai_usage.calls + 1, updated_at = now()
  WHERE ai_usage.calls < least(_cap, 50)
  RETURNING calls INTO n;
  RETURN n IS NOT NULL;
END; $$;
REVOKE ALL ON FUNCTION public.claim_ai_call(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_ai_call(int) TO authenticated;