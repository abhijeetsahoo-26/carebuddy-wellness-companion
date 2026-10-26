CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- consents
CREATE TABLE public.consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, version)
);
GRANT SELECT, INSERT ON public.consents TO authenticated;
GRANT ALL ON public.consents TO service_role;
ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own consents read" ON public.consents FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own consents insert" ON public.consents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX consents_user_idx ON public.consents(user_id);
CREATE TRIGGER consents_updated BEFORE UPDATE ON public.consents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.has_consent(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.consents WHERE user_id = _uid)
$$;

-- profiles
CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text CHECK (char_length(full_name) <= 100),
  age_group text CHECK (age_group IN ('under_18','18_39','40_59','60_74','75_plus')),
  allergies text CHECK (char_length(allergies) <= 1000),
  conditions text CHECK (char_length(conditions) <= 1000),
  doctor_name text CHECK (char_length(doctor_name) <= 100),
  doctor_phone text CHECK (char_length(doctor_phone) <= 20),
  pharmacist_name text CHECK (char_length(pharmacist_name) <= 100),
  pharmacist_phone text CHECK (char_length(pharmacist_phone) <= 20),
  diet text CHECK (diet IN ('vegetarian','non_vegetarian','eggetarian','vegan','jain','other')),
  onboarding_step int NOT NULL DEFAULT 0,
  onboarding_done boolean NOT NULL DEFAULT false,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.has_consent(auth.uid()));
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND public.has_consent(auth.uid()));
CREATE POLICY "own profile delete" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- emergency contacts
CREATE TABLE public.emergency_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  phone text NOT NULL CHECK (char_length(phone) BETWEEN 3 AND 20),
  relationship text CHECK (char_length(relationship) <= 50),
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emergency_contacts TO authenticated;
GRANT ALL ON public.emergency_contacts TO service_role;
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own contacts read" ON public.emergency_contacts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own contacts insert" ON public.emergency_contacts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.has_consent(auth.uid()));
CREATE POLICY "own contacts update" ON public.emergency_contacts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own contacts delete" ON public.emergency_contacts FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX emergency_contacts_user_idx ON public.emergency_contacts(user_id);
CREATE TRIGGER emergency_contacts_updated BEFORE UPDATE ON public.emergency_contacts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- audit log (append-only, written by triggers only)
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  actor_id uuid,
  entity text NOT NULL,
  entity_id uuid,
  action text NOT NULL CHECK (action IN ('create','edit','delete')),
  summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own audit read" ON public.audit_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX audit_log_user_time_idx ON public.audit_log(user_id, created_at DESC);

-- generic audit trigger: reuse for medicines and Doctor's Plan tables later
CREATE OR REPLACE FUNCTION public.write_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; act text;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; act := 'delete';
  ELSIF TG_OP = 'UPDATE' THEN r := NEW; act := 'edit';
  ELSE r := NEW; act := 'create'; END IF;
  INSERT INTO public.audit_log(user_id, actor_id, entity, entity_id, action, summary)
  VALUES (r.user_id, auth.uid(), TG_ARGV[0], r.id, act, TG_ARGV[0] || ' ' || act);
  RETURN NULL;
END; $$;

CREATE TRIGGER emergency_contacts_audit AFTER INSERT OR UPDATE OR DELETE ON public.emergency_contacts
FOR EACH ROW EXECUTE FUNCTION public.write_audit('emergency_contact');