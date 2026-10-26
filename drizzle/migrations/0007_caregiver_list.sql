CREATE OR REPLACE FUNCTION public.my_caregiving() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'status', g.status, 'alerts_enabled', g.alerts_enabled,
    'can_missed_alerts', g.can_missed_alerts,
    'first_name', split_part(coalesce(nullif(trim(p.full_name), ''), 'Someone'), ' ', 1)) ORDER BY g.accepted_at), '[]'::jsonb)
  FROM public.caregiver_grants g LEFT JOIN public.profiles p ON p.user_id = g.user_id
  WHERE g.caregiver_id = auth.uid() AND g.status IN ('active','paused');
$$;
REVOKE ALL ON FUNCTION public.my_caregiving() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_caregiving() TO authenticated;