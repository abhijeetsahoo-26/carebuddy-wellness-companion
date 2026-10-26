import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useAccount() {
  const { user, loading: authLoading } = useAuth();
  const q = useQuery({
    queryKey: ["account", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [c, p] = await Promise.all([
        supabase.from("consents").select("version, accepted_at").order("accepted_at", { ascending: false }).limit(1),
        supabase.from("profiles").select("*").maybeSingle(),
      ]);
      if (c.error) throw c.error;
      if (p.error) throw p.error;
      return { consent: c.data[0] ?? null, profile: p.data };
    },
  });
  return { user, authLoading, ...q };
}
