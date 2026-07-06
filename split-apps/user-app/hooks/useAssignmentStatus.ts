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
      adminIds: [],
      clientIds: [],
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
          adminIds: [],
          clientIds: [],
          loading: false,
        };
        moduleCache = unauthStatus;
        setStatus(unauthStatus);
        return;
      }

      // Fetch ALL client rows for this user (multi-admin: one row per linked admin)
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
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching assignment status:', error);
        setStatus(prev => ({ ...prev, loading: false }));
        return;
      }

      if (!data || data.length === 0) {
        const unassignedStatus: AssignmentStatus = {
          isAssigned: false,
          photographerId: null,
          photographerName: null,
          clientId: null,
          adminIds: [],
          clientIds: [],
          loading: false,
        };
        moduleCache = unassignedStatus;
        setStatus(unassignedStatus);
        return;
      }

      // Filter out orphaned records (null user_id)
      const validRows = data.filter((row: any) => row.user_id !== null);
      const orphanedRows = data.filter((row: any) => row.user_id === null);
      if (orphanedRows.length > 0) {
        console.warn(`[useAssignmentStatus] ${orphanedRows.length} orphaned client record(s) detected (null user_id). Ignoring.`);
      }

      if (validRows.length === 0) {
        const orphanStatus: AssignmentStatus = {
          isAssigned: false,
          photographerId: null,
          photographerName: null,
          clientId: orphanedRows[0]?.id ?? null,
          adminIds: [],
          clientIds: [],
          loading: false,
        };
        moduleCache = orphanStatus;
        setStatus(orphanStatus);
        return;
      }

      // Multi-admin: collect all admin IDs and client IDs
      const adminIds = validRows.map((r: any) => r.owner_admin_id).filter(Boolean);
      const clientIds = validRows.map((r: any) => r.id).filter(Boolean);

      const newStatus: AssignmentStatus = {
        isAssigned: adminIds.length > 0,
        // Primary admin = first linked admin (for backward compat)
        photographerId: adminIds[0] ?? null,
        photographerName: (validRows[0]?.user_profiles as any)?.name ?? null,
        clientId: clientIds[0] ?? null,
        adminIds,
        clientIds,
        loading: false,
      };

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
