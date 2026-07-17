import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface UseClientIdsOptions {
  isDemoMode: boolean;
}

export function useClientIds({ isDemoMode }: UseClientIdsOptions) {
  const [clientIds, setClientIds] = useState<string[]>([]);
  const clientIdsRef = useRef<string[]>([]);

  const fetchAllClientIds = useCallback(async (userId?: string): Promise<string[]> => {
    if (isDemoMode) {
      setClientIds(['demo-client']);
      clientIdsRef.current = ['demo-client'];
      return ['demo-client'];
    }

    let authUser: any = null;
    try {
      const result = await supabase.auth.getUser();
      authUser = result.data?.user;
    } catch {
      setClientIds([]);
      return [];
    }
    if (!authUser) {
      setClientIds([]);
      return [];
    }

    const { data, error } = await supabase
      .from('clients')
      .select('id, owner_admin_id, user_profiles:owner_admin_id(name)')
      .eq('user_id', authUser.id);

    if (error) {
      setClientIds([]);
      return [];
    }

    const ids = (data || []).map((r: any) => r.id).filter(Boolean);
    setClientIds(ids);
    clientIdsRef.current = ids;

    return ids;
  }, [isDemoMode]);

  return {
    clientIds,
    clientIdsRef,
    fetchAllClientIds,
  };
}
