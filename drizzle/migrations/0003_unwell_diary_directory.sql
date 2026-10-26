CREATE TABLE public.unwell_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  result text NOT NULL CHECK (result IN ('emergency','doctor_soon','self_care')),
  reasons text[] NOT NULL DEFAULT '{}',
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.unwell_sessions TO authenticated;
GRANT ALL ON public.unwell_sessions TO service_role;
ALTER TABLE public.unwell_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sessions read" ON public.unwell_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own sessions insert" ON public.unwell_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.has_consent(auth.uid()));
CREATE POLICY "own sessions delete" ON public.unwell_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX unwell_sessions_user_idx ON public.unwell_sessions(user_id, created_at DESC);

CREATE TABLE public.symptom_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id uuid REFERENCES public.unwell_sessions(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  symptoms text[] NOT NULL DEFAULT '{}',
  severity int CHECK (severity BETWEEN 0 AND 10),
  result text CHECK (result IN ('emergency','doctor_soon','self_care')),
  notes text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('check','manual')),
  deleted_at timestamptz,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.symptom_entries TO authenticated;
GRANT ALL ON public.symptom_entries TO service_role;
ALTER TABLE public.symptom_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own entries read" ON public.symptom_entries FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own entries insert" ON public.symptom_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.has_consent(auth.uid()));
CREATE POLICY "own entries update" ON public.symptom_entries FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own entries delete" ON public.symptom_entries FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX symptom_entries_user_idx ON public.symptom_entries(user_id, occurred_at DESC);
CREATE INDEX symptom_entries_session_idx ON public.symptom_entries(session_id);
CREATE TRIGGER symptom_entries_updated_at BEFORE UPDATE ON public.symptom_entries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER symptom_entries_audit AFTER INSERT OR UPDATE OR DELETE ON public.symptom_entries
FOR EACH ROW EXECUTE FUNCTION public.write_audit('symptom_entry');

-- Rows with user_id NULL are the shared defaults; a user's own row with the same key replaces it for them.
CREATE TABLE public.emergency_directory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  key text NOT NULL,
  label text NOT NULL,
  number text NOT NULL CHECK (number ~ '^[0-9+]{2,15}$'),
  sort int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX emergency_directory_user_key ON public.emergency_directory(coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), key);
CREATE INDEX emergency_directory_user_idx ON public.emergency_directory(user_id);
GRANT SELECT ON public.emergency_directory TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emergency_directory TO authenticated;
GRANT ALL ON public.emergency_directory TO service_role;
ALTER TABLE public.emergency_directory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "defaults readable" ON public.emergency_directory FOR SELECT TO anon, authenticated USING (user_id IS NULL);
CREATE POLICY "own directory read" ON public.emergency_directory FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own directory insert" ON public.emergency_directory FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own directory update" ON public.emergency_directory FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own directory delete" ON public.emergency_directory FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER emergency_directory_updated_at BEFORE UPDATE ON public.emergency_directory FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.emergency_directory(user_id, key, label, number, sort) VALUES
 (NULL, 'emergency', 'Police, fire, ambulance', '112', 0),
 (NULL, 'ambulance_108', 'Ambulance', '108', 1),
 (NULL, 'ambulance_102', 'Ambulance (102)', '102', 2),
 (NULL, 'fire', 'Fire', '101', 3),
 (NULL, 'police', 'Police', '100', 4),
 (NULL, 'women', 'Women helpline', '1091', 5),
 (NULL, 'child', 'Child helpline', '1098', 6),
 (NULL, 'mental_health', 'Mental health support (Tele-MANAS)', '14416', 7);

-- Added after the defaults, so only users' own edits are audited.
CREATE TRIGGER emergency_directory_audit AFTER INSERT OR UPDATE OR DELETE ON public.emergency_directory
FOR EACH ROW EXECUTE FUNCTION public.write_audit('emergency_number');