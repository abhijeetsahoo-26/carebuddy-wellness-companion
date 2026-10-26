import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_DIRECTORY, mergeDirectory } from "@/lib/directory";

export function useDirectory() {
  const q = useQuery({
    queryKey: ["directory"],
    queryFn: async () => {
      const { data, error } = await supabase.from("emergency_directory").select("key, label, number, sort, user_id");
      if (error) throw error;
      return mergeDirectory(data);
    },
  });
  return { ...q, list: q.data ?? DEFAULT_DIRECTORY };
}
