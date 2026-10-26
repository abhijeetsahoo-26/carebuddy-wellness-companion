ALTER TABLE public.emergency_card_tokens ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE OR REPLACE FUNCTION public.get_emergency_card(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE uid uuid; p record; prefs jsonb; out jsonb := '{}'::jsonb;
BEGIN
  IF _token IS NULL OR length(_token) < 32 OR length(_token) > 128 THEN RETURN NULL; END IF;
  SELECT user_id INTO uid FROM public.emergency_card_tokens
   WHERE token_hash = encode(extensions.digest(_token, 'sha256'), 'hex') AND revoked_at IS NULL
     AND (expires_at IS NULL OR expires_at > now());
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
END; $function$;