/**
 * Analytics Service: Unassigned User Metrics
 * Requirements: 14.7, 14.8, 14.9, 14.10
 *
 * Queries the unassigned_user_sessions table to surface conversion and
 * engagement metrics for the super-admin dashboard.
 */

import { supabase } from './supabase';
import type {
  AverageTimeToAssignment,
  PhotographerConversionRate,
  TopViewedContent,
  AssignmentSourceDistribution,
  FailedAttemptStatistics,
  UnassignedUserAnalyticsSummary,
} from '@/types/unassigned-user-analytics';

// ---------------------------------------------------------------------------
// 1. Total unassigned users
//    Counts clients rows where owner_admin_id IS NULL (no photographer assigned)
// ---------------------------------------------------------------------------
export async function getTotalUnassignedUsers(): Promise<number> {
  const { count, error } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .is('owner_admin_id', null);

  if (error) {
    console.error('[analytics] getTotalUnassignedUsers:', error.message);
    return 0;
  }
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// 2. Average time_to_assignment
//    Only sessions that ended with an assignment have a non-null value
// ---------------------------------------------------------------------------
export async function getAverageTimeToAssignment(): Promise<AverageTimeToAssignment> {
  const { data, error } = await supabase
    .from('unassigned_user_sessions')
    .select('time_to_assignment_seconds')
    .not('time_to_assignment_seconds', 'is', null) as any;

  if (error) {
    console.error('[analytics] getAverageTimeToAssignment:', error.message);
    return { avg_time_seconds: 0, avg_time_hours: 0, avg_time_days: 0, total_assigned_count: 0 };
  }

  const rows = (data ?? []) as Array<{ time_to_assignment_seconds: number }>;
  const total = rows.length;
  if (total === 0) {
    return { avg_time_seconds: 0, avg_time_hours: 0, avg_time_days: 0, total_assigned_count: 0 };
  }

  const sumSeconds = rows.reduce((acc, r) => acc + (r.time_to_assignment_seconds ?? 0), 0);
  const avgSeconds = sumSeconds / total;

  return {
    avg_time_seconds: Math.round(avgSeconds),
    avg_time_hours: parseFloat((avgSeconds / 3600).toFixed(2)),
    avg_time_days: parseFloat((avgSeconds / 86400).toFixed(2)),
    total_assigned_count: total,
  };
}

// ---------------------------------------------------------------------------
// 3. Conversion rate per photographer
//    Compares sessions that were successfully assigned vs. those that had
//    code entry attempts but were never assigned.
//    Also counts failed code attempts per photographer from their sessions.
// ---------------------------------------------------------------------------
export async function getPhotographerConversionRates(): Promise<PhotographerConversionRate[]> {
  // Fetch all photographers (admin role users)
  const { data: photographers, error: pgError } = await supabase
    .from('user_profiles')
    .select('id, name, photographer_code')
    .eq('role', 'admin') as any;

  if (pgError) {
    console.error('[analytics] getPhotographerConversionRates (photographers):', pgError.message);
    return [];
  }

  const results: PhotographerConversionRate[] = [];

  for (const pg of photographers ?? []) {
    // Count clients successfully assigned to this photographer
    const { count: successCount } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('owner_admin_id', pg.id) as any;

    // Count assignment log entries for this photographer (all attempts via any method)
    const { count: totalAttempts } = await supabase
      .from('client_assignment_log')
      .select('*', { count: 'exact', head: true })
      .eq('admin_id', pg.id) as any;

    const successful = successCount ?? 0;
    const total = totalAttempts ?? 0;
    const failed = Math.max(0, total - successful);
    const conversionRate = total > 0 ? parseFloat(((successful / total) * 100).toFixed(2)) : 0;

    results.push({
      photographer_id: pg.id,
      photographer_name: pg.name ?? 'Unknown',
      photographer_code: pg.photographer_code ?? '',
      total_assignments: total,
      successful_assignments: successful,
      failed_attempts: failed,
      conversion_rate: conversionRate,
    });
  }

  // Sort descending by successful assignments
  return results.sort((a, b) => b.successful_assignments - a.successful_assignments);
}

// ---------------------------------------------------------------------------
// 4. Top viewed content
//    content_views is stored as JSONB: { "bts": ["<id>", ...], "announcements": ["<id>", ...] }
//    We count occurrences of each content_id across all sessions.
// ---------------------------------------------------------------------------
export async function getTopViewedContent(limit = 10): Promise<TopViewedContent[]> {
  const { data: sessions, error } = await supabase
    .from('unassigned_user_sessions')
    .select('content_views') as any;

  if (error) {
    console.error('[analytics] getTopViewedContent:', error.message);
    return [];
  }

  // Tally views per content id + type
  const btsCounts = new Map<string, number>();
  const announcementCounts = new Map<string, number>();

  for (const session of sessions ?? []) {
    const views = session.content_views as { bts?: string[]; announcements?: string[] } | null;
    if (!views) continue;

    for (const id of views.bts ?? []) {
      btsCounts.set(id, (btsCounts.get(id) ?? 0) + 1);
    }
    for (const id of views.announcements ?? []) {
      announcementCounts.set(id, (announcementCounts.get(id) ?? 0) + 1);
    }
  }

  // Fetch BTS post titles
  const btsIds = Array.from(btsCounts.keys());
  const announcementIds = Array.from(announcementCounts.keys());

  const [btsData, announcementData] = await Promise.all([
    btsIds.length > 0
      ? supabase.from('bts_posts').select('id, title, created_at').in('id', btsIds)
      : { data: [] as any[], error: null },
    announcementIds.length > 0
      ? supabase.from('announcements').select('id, title, created_at').in('id', announcementIds)
      : { data: [] as any[], error: null },
  ]);

  const combined: TopViewedContent[] = [];

  for (const post of btsData.data ?? []) {
    combined.push({
      content_type: 'bts',
      content_id: post.id,
      view_count: btsCounts.get(post.id) ?? 0,
      title: post.title ?? 'Untitled',
      created_at: post.created_at,
    });
  }

  for (const ann of announcementData.data ?? []) {
    combined.push({
      content_type: 'announcement',
      content_id: ann.id,
      view_count: announcementCounts.get(ann.id) ?? 0,
      title: ann.title ?? 'Untitled',
      created_at: ann.created_at,
    });
  }

  return combined
    .sort((a, b) => b.view_count - a.view_count)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// 5. Assignment source distribution
//    Uses client_assignment_log.assigned_via to break down how clients
//    were assigned (code_entry | qr_scan | invite_link | admin_invite).
// ---------------------------------------------------------------------------
export async function getAssignmentSourceDistribution(): Promise<AssignmentSourceDistribution[]> {
  const { data, error } = await supabase
    .from('client_assignment_log')
    .select('assigned_via') as any;

  if (error) {
    console.error('[analytics] getAssignmentSourceDistribution:', error.message);
    return [];
  }

  const counts = new Map<string, number>();
  let total = 0;

  for (const row of data ?? []) {
    const source = (row.assigned_via as string) ?? 'unknown';
    counts.set(source, (counts.get(source) ?? 0) + 1);
    total++;
  }

  if (total === 0) return [];

  const sources: AssignmentSourceDistribution[] = [];
  for (const [source, count] of counts.entries()) {
    sources.push({
      assigned_via: source as AssignmentSourceDistribution['assigned_via'],
      assignment_count: count,
      percentage: parseFloat(((count / total) * 100).toFixed(2)),
    });
  }

  return sources.sort((a, b) => b.assignment_count - a.assignment_count);
}

// ---------------------------------------------------------------------------
// 6. Failed attempt counts
//    Sessions where code_entry_attempts > 0 but assigned_at IS NULL means
//    the user tried but never converted.
// ---------------------------------------------------------------------------
export async function getFailedAttemptStatistics(): Promise<FailedAttemptStatistics> {
  const { data, error } = await supabase
    .from('unassigned_user_sessions')
    .select('code_entry_attempts, assigned_at')
    .gt('code_entry_attempts', 0) as any;

  if (error) {
    console.error('[analytics] getFailedAttemptStatistics:', error.message);
    return {
      total_failed_sessions: 0,
      total_failed_attempts: 0,
      avg_attempts_per_session: 0,
      sessions_with_1_attempt: 0,
      sessions_with_2_3_attempts: 0,
      sessions_with_4_plus_attempts: 0,
    };
  }

  // Only count sessions that never converted (no assigned_at)
  const failedSessions = (data ?? []).filter((r: any) => !r.assigned_at) as Array<{
    code_entry_attempts: number;
    assigned_at: string | null;
  }>;

  const totalFailed = failedSessions.length;
  if (totalFailed === 0) {
    return {
      total_failed_sessions: 0,
      total_failed_attempts: 0,
      avg_attempts_per_session: 0,
      sessions_with_1_attempt: 0,
      sessions_with_2_3_attempts: 0,
      sessions_with_4_plus_attempts: 0,
    };
  }

  let totalAttempts = 0;
  let with1 = 0;
  let with2to3 = 0;
  let with4plus = 0;

  for (const s of failedSessions) {
    const attempts = s.code_entry_attempts ?? 0;
    totalAttempts += attempts;
    if (attempts === 1) with1++;
    else if (attempts <= 3) with2to3++;
    else with4plus++;
  }

  return {
    total_failed_sessions: totalFailed,
    total_failed_attempts: totalAttempts,
    avg_attempts_per_session: parseFloat((totalAttempts / totalFailed).toFixed(2)),
    sessions_with_1_attempt: with1,
    sessions_with_2_3_attempts: with2to3,
    sessions_with_4_plus_attempts: with4plus,
  };
}

// ---------------------------------------------------------------------------
// Convenience: fetch all metrics in parallel for the dashboard
// ---------------------------------------------------------------------------
export async function getUnassignedUserAnalyticsSummary(): Promise<UnassignedUserAnalyticsSummary> {
  const [
    totalUnassigned,
    avgTime,
    sourceDistribution,
    failedAttempts,
  ] = await Promise.all([
    getTotalUnassignedUsers(),
    getAverageTimeToAssignment(),
    getAssignmentSourceDistribution(),
    getFailedAttemptStatistics(),
  ]);

  return {
    total_unassigned_users: totalUnassigned,
    average_time_to_assignment: {
      seconds: avgTime.avg_time_seconds,
      hours: avgTime.avg_time_hours,
      days: avgTime.avg_time_days,
      total_assigned: avgTime.total_assigned_count,
    },
    assignment_source_distribution: sourceDistribution,
    failed_attempts: failedAttempts,
  };
}
