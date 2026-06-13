// Task 7.1 / 28.2: useAssignmentStatus hook for user app
// Requirements: 1.1, 4.1, 20.4

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { AssignmentStatus } from '../../../types/assignment';

// Module-level cache: persists across component re-renders and mount/unmount
// for the duration of the app session. Cleared explicitly on logout via clearCache().
let moduleCache: AssignmentStatus | null = null;

/**
 * Clear the module-level assignment status cache.
 * Call this on logout so the next session fetches fresh data.
 */
export function clearCache(): void {
  moduleCache = null;
}

export function useAssignmentStatus(): AssignmentStatus {
  const [status, setStatus] = useState<AssignmentStatus>(() => {
    // Hydrate from module cache immediately to avoid a flash of loading state
    if (moduleCache) {
      return moduleCache;
    }
    return {
      isAssigned: false,
      photographerId: null,
      photographerName: null,
      clientId: null,
      loading: true,
    };
  });

  const subscriptionRef = useRef<any>(null);

  const fetchAssignmentStatus = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        const unauthStatus: AssignmentStatus = {
          isAssigned: false,
          photographerId: null,
          photographerName: null,
          clientId: null,
          loading: false,
        };
        moduleCache = unauthStatus;
        setStatus(unauthStatus);
        return;
      }

      // Query: SELECT c.id, c.owner_admin_id, up.name FROM clients c LEFT JOIN user_profiles up WHERE c.user_id = $userId
      const { data, error } = await supabase
        .from('clients')
        .select(`
          id,
          owner_admin_id,
          user_id,
          user_profiles:owner_admin_id (
            name
          )
        `)
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching assignment status:', error);
        setStatus(prev => ({ ...prev, loading: false }));
        return;
      }

      // Handle orphaned client record: record exists but user_id is NULL
      // or owner_admin_id points to a non-existent user_profiles row (Req 16.2, 16.6)
      if (data && data.user_id === null) {
        console.warn('[useAssignmentStatus] Orphaned client record detected (null user_id). Treating as unassigned.');
        const orphanStatus: AssignmentStatus = {
          isAssigned: false,
          photographerId: null,
          photographerName: null,
          clientId: data.id,
          loading: false,
        };
        moduleCache = orphanStatus;
        setStatus(orphanStatus);
        return;
      }

      const newStatus: AssignmentStatus = {
        isAssigned: !!data?.owner_admin_id,
        photographerId: data?.owner_admin_id || null,
        // Gracefully handle the case where the photographer's profile no longer
        // exists (deleted/suspended account) — fall back to null name (Req 16.6)
        photographerName: (data?.user_profiles as any)?.name ?? null,
        clientId: data?.id || null,
        loading: false,
      };

      // Update module-level cache so all future hook instances share the result
      moduleCache = newStatus;
      setStatus(newStatus);
    } catch (err) {
      console.error('Unexpected error in useAssignmentStatus:', err);
      setStatus(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const refresh = useCallback(() => {
    // Invalidate module cache and re-fetch
    moduleCache = null;
    fetchAssignmentStatus();
  }, [fetchAssignmentStatus]);

  useEffect(() => {
    // If the module cache is already populated, use it and skip the network fetch
    if (moduleCache) {
      setStatus(moduleCache);
    } else {
      // Initial fetch — populates the module cache
      fetchAssignmentStatus();
    }

    // Subscribe to real-time changes on clients table
    // Use a unique channel name per hook instance to avoid the
    // "cannot add postgres_changes callbacks after subscribe()" error
    // that occurs when multiple components mount this hook simultaneously.
    const channelName = `assignment_changes_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      subscriptionRef.current = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'clients',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log('Assignment change detected:', payload);
            // Real-time event: invalidate cache and re-fetch fresh data
            moduleCache = null;
            fetchAssignmentStatus();
          }
        )
        .subscribe();
    };

    setupSubscription();

    // Cleanup subscription on unmount (cache intentionally kept alive)
    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [fetchAssignmentStatus]);

  return {
    ...status,
    refresh,
  };
}
