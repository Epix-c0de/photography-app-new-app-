/**
 * React hook for fetching unassigned user analytics
 * Uses RPC functions from migration 20260602000012
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  AverageTimeToAssignment,
  PhotographerConversionRate,
  TopViewedContent,
  AssignmentSourceDistribution,
  FailedAttemptStatistics,
  UnassignedUserAnalyticsSummary,
} from '@/types/unassigned-user-analytics';

/**
 * Hook to fetch total unassigned users count
 */
export function useTotalUnassignedUsers() {
  const [data, setData] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const { data: result, error: err } = await supabase.rpc(
          'get_total_unassigned_users'
        );

        if (err) throw err;
        setData(result as number);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return { data, loading, error };
}

/**
 * Hook to fetch average time to assignment metrics
 */
export function useAverageTimeToAssignment() {
  const [data, setData] = useState<AverageTimeToAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const { data: result, error: err } = await supabase.rpc(
          'get_average_time_to_assignment'
        );

        if (err) throw err;
        setData(result?.[0] || null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return { data, loading, error };
}

/**
 * Hook to fetch conversion rates per photographer
 */
export function useConversionRatePerPhotographer() {
  const [data, setData] = useState<PhotographerConversionRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const { data: result, error: err } = await supabase.rpc(
          'get_conversion_rate_per_photographer'
        );

        if (err) throw err;
        setData(result || []);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return { data, loading, error };
}

/**
 * Hook to fetch top viewed content by unassigned users
 */
export function useTopViewedContent(limit: number = 10) {
  const [data, setData] = useState<TopViewedContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const { data: result, error: err } = await supabase.rpc(
          'get_top_viewed_content',
          { p_limit: limit }
        );

        if (err) throw err;
        setData(result || []);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [limit]);

  return { data, loading, error };
}

/**
 * Hook to fetch assignment source distribution
 */
export function useAssignmentSourceDistribution() {
  const [data, setData] = useState<AssignmentSourceDistribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const { data: result, error: err } = await supabase.rpc(
          'get_assignment_source_distribution'
        );

        if (err) throw err;
        setData(result || []);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return { data, loading, error };
}

/**
 * Hook to fetch failed attempt statistics
 */
export function useFailedAttemptStatistics() {
  const [data, setData] = useState<FailedAttemptStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const { data: result, error: err } = await supabase.rpc(
          'get_failed_attempt_statistics'
        );

        if (err) throw err;
        setData(result?.[0] || null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return { data, loading, error };
}

/**
 * Hook to fetch comprehensive analytics summary (all metrics in one call)
 */
export function useUnassignedUserAnalyticsSummary() {
  const [data, setData] = useState<UnassignedUserAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = async () => {
    try {
      setLoading(true);
      const { data: result, error: err } = await supabase.rpc(
        'get_unassigned_user_analytics_summary'
      );

      if (err) throw err;
      setData(result as UnassignedUserAnalyticsSummary);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return { data, loading, error, refresh };
}
