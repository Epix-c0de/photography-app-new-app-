/**
 * Types for Unassigned User Analytics
 * Corresponds to SQL functions in migration 20260602000012
 */

export interface AverageTimeToAssignment {
  avg_time_seconds: number;
  avg_time_hours: number;
  avg_time_days: number;
  total_assigned_count: number;
}

export interface PhotographerConversionRate {
  photographer_id: string;
  photographer_name: string;
  photographer_code: string;
  total_assignments: number;
  successful_assignments: number;
  failed_attempts: number;
  conversion_rate: number;
}

export interface TopViewedContent {
  content_type: 'bts' | 'announcement';
  content_id: string;
  view_count: number;
  title: string;
  created_at: string;
}

export interface AssignmentSourceDistribution {
  assigned_via: 'code_entry' | 'qr_scan' | 'invite_link' | 'admin_invite';
  assignment_count: number;
  percentage: number;
}

export interface FailedAttemptStatistics {
  total_failed_sessions: number;
  total_failed_attempts: number;
  avg_attempts_per_session: number;
  sessions_with_1_attempt: number;
  sessions_with_2_3_attempts: number;
  sessions_with_4_plus_attempts: number;
}

export interface UnassignedUserAnalyticsSummary {
  total_unassigned_users: number;
  average_time_to_assignment: {
    seconds: number;
    hours: number;
    days: number;
    total_assigned: number;
  };
  assignment_source_distribution: AssignmentSourceDistribution[];
  failed_attempts: {
    total_failed_sessions: number;
    total_failed_attempts: number;
    avg_attempts_per_session: number;
    sessions_with_1_attempt: number;
    sessions_with_2_3_attempts: number;
    sessions_with_4_plus_attempts: number;
  };
}
