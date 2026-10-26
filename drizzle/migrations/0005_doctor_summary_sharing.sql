CREATE TABLE public.doctor_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  range_from date NOT NULL,
  range_to date NOT NULL,
  sections text[] NOT NULL DEFAULT '{}',
  questions text[] NOT NULL DEFAULT '{}',
  kind text NOT NULL DEFAULT 'pdf' CHECK (kind IN ('pdf','share')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.doctor_summaries TO authenticated;
GRANT ALL ON public.doctor_summaries TO service_role;
ALTER TABLE public.doctor_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own summaries read" ON public.doctor_summaries FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own summaries insert" ON public.doctor_summaries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.has_consent(auth.uid()));
CREATE POLICY "own summaries delete" ON public.doctor_summaries FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX doctor_summaries_user_idx ON public.doctor_summaries(user_id, created_at DESC);

CREATE TABLE public.share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  range_from date NOT NULL,
  range_to date NOT NULL,
  sections text[] NOT NULL DEFAULT '{}',
  questions text[] NOT NULL DEFAULT '{}',
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (range_from <= range_to)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.share_links TO authenticated;
GRANT ALL ON public.share_links TO service_role;
ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own share links read" ON public.share_links FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own share links insert" ON public.share_links FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.has_consent(auth.uid()));
CREATE POLICY "own share links update" ON public.share_links FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own share links delete" ON public.share_links FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX share_links_user_idx ON public.share_links(user_id, created_at DESC);
CREATE TRIGGER share_links_updated BEFORE UPDATE ON public.share_links FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.share_link_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.share_links(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, DELETE ON public.share_link_views TO authenticated;
GRANT ALL ON public.share_link_views TO service_role;
ALTER TABLE public.share_link_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own link views read" ON public.share_link_views FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own link views delete" ON public.share_link_views FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX share_link_views_link_idx ON public.share_link_views(link_id, viewed_at DESC);
CREATE INDEX share_link_views_user_idx ON public.share_link_views(user_id);

-- No-login: validates a live, unexpired, unrevoked token, records the view, returns what the owner chose.
CREATE OR REPLACE FUNCTION public.open_share_link(_token text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE l record;
BEGIN
  IF _token IS NULL OR length(_token) < 32 OR length(_token) > 128 THEN RETURN NULL; END IF;
  SELECT * INTO l FROM public.share_links
   WHERE token_hash = encode(extensions.digest(_token, 'sha256'), 'hex')
     AND revoked_at IS NULL AND expires_at > now();
  IF l.id IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.share_link_views(link_id, user_id) VALUES (l.id, l.user_id);
  UPDATE public.share_links SET view_count = view_count + 1, last_viewed_at = now(),
    first_viewed_at = coalesce(first_viewed_at, now()) WHERE id = l.id;
  RETURN jsonb_build_object('user_id', l.user_id, 'range_from', l.range_from, 'range_to', l.range_to,
    'sections', to_jsonb(l.sections), 'questions', to_jsonb(l.questions), 'expires_at', l.expires_at);
END; $$;
REVOKE ALL ON FUNCTION public.open_share_link(text) FROM public;
GRANT EXECUTE ON FUNCTION public.open_share_link(text) TO anon, authenticated;