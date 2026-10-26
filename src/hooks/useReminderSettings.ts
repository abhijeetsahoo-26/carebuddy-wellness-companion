import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useReminderSettings() {
  return useQuery({
    queryKey: ["reminder-settings"],
    queryFn: async () => {
      const [s, subs, last] = await Promise.all([
        supabase.from("reminder_settings").select("*").maybeSingle(),
        supabase.from("push_subscriptions").select("endpoint"),
        supabase.from("reminder_log").select("kind, status, created_at, sent_at, detail").order("created_at", { ascending: false }).limit(10),
      ]);
      if (s.error) throw s.error;
      if (subs.error) throw subs.error;
      if (last.error) throw last.error;
      return { settings: s.data, endpoints: subs.data.map((x) => x.endpoint), log: last.data };
    },
  });
}
