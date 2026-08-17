'use client';

import { useQuery } from "@tanstack/react-query";
import { supabase } from "../integrations/supabase/client";

type WebsiteContentRow = {
  section: string;
  title: string | null;
  content: any | null;
};

export function useWebsiteContent<T = any>(section: string) {
  return useQuery({
    queryKey: ["website-content", section],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("website_content")
        .select("section,title,content")
        .eq("section", section)
        .maybeSingle();

      if (error) throw error;
      return (data || null) as WebsiteContentRow | null;
    },
  });
}
