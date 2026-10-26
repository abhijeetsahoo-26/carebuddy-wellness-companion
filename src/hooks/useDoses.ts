import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { istDate, istDayStartUTC } from "@/lib/time";

export type DoseRow = {
  id: string;
  scheduled_at: string;
  status: string;
  logged_at: string | null;
  snoozed_until: string | null;
  is_demo: boolean;
  medicine: { id: string; name: string; dose_amount: string | null; food: string; is_demo: boolean } | null;
};

/** Doses from `daysBack` India-time days ago through the end of today. */
export function useDoses(daysBack = 0) {
  return useQuery({
    queryKey: ["doses", daysBack],
    queryFn: async () => {
      const today = istDate();
      const from = new Date(istDayStartUTC(today).getTime() - daysBack * 86400e3);
      const to = new Date(istDayStartUTC(today).getTime() + 86400e3);
      const { data, error } = await supabase
        .from("dose_logs")
        .select("id, scheduled_at, status, logged_at, snoozed_until, is_demo, medicine:medicines(id, name, dose_amount, food, is_demo)")
        .gte("scheduled_at", from.toISOString())
        .lt("scheduled_at", to.toISOString())
        .order("scheduled_at");
      if (error) throw error;
      return data as unknown as DoseRow[];
    },
  });
}
