# Unassigned User Analytics

This document describes the analytics queries available for tracking unassigned user behavior and assignment conversion metrics.

## Overview

The analytics system tracks users who have not yet been assigned to a photographer, monitoring their journey from first app open through successful assignment (or abandonment).

## Database Functions

All functions are defined in migration `20260602000012_unassigned_user_analytics_queries.sql`.

### 1. `get_total_unassigned_users()`

**Returns:** `BIGINT`

**Description:** Count of users currently without a photographer assignment.

**Example:**
```typescript
const { data } = await supabase.rpc('get_total_unassigned_users');
console.log(`Total unassigned users: ${data}`);
```

---

### 2. `get_average_time_to_assignment()`

**Returns:** Table with columns:
- `avg_time_seconds` - Average time in seconds
- `avg_time_hours` - Average time in hours
- `avg_time_days` - Average time in days
- `total_assigned_count` - Total number of users who completed assignment

**Description:** Calculates average time from first app open to successful photographer assignment.

**Example:**
```typescript
const { data } = await supabase.rpc('get_average_time_to_assignment');
console.log(`Average time to assignment: ${data[0].avg_time_hours} hours`);
```

---

### 3. `get_conversion_rate_per_photographer()`

**Returns:** Table with columns:
- `photographer_id` - Photographer's UUID
- `photographer_name` - Photographer's display name
- `photographer_code` - 8-character photographer code
- `total_assignments` - Total clients assigned
- `successful_assignments` - Successfully assigned clients
- `failed_attempts` - Failed code entry attempts
- `conversion_rate` - Percentage success rate

**Description:** Shows assignment conversion metrics for each photographer.

**Example:**
```typescript
const { data } = await supabase.rpc('get_conversion_rate_per_photographer');
data.forEach(photographer => {
  console.log(`${photographer.photographer_name}: ${photographer.conversion_rate}% conversion`);
});
```

---

### 4. `get_top_viewed_content(p_limit)`

**Parameters:**
- `p_limit` (INTEGER, default: 10) - Maximum number of results

**Returns:** Table with columns:
- `content_type` - 'bts' or 'announcement'
- `content_id` - UUID of the content
- `view_count` - Number of views by unassigned users
- `title` - Content title
- `created_at` - Content creation timestamp

**Description:** Returns most-viewed BTS posts and announcements by unassigned users.

**Example:**
```typescript
const { data } = await supabase.rpc('get_top_viewed_content', { p_limit: 5 });
console.log('Top 5 viewed content:', data);
```

---

### 5. `get_assignment_source_distribution()`

**Returns:** Table with columns:
- `assigned_via` - Assignment method ('code_entry', 'qr_scan', 'invite_link', 'admin_invite')
- `assignment_count` - Number of assignments via this method
- `percentage` - Percentage of total assignments

**Description:** Breakdown of assignment methods showing which channels are most effective.

**Example:**
```typescript
const { data } = await supabase.rpc('get_assignment_source_distribution');
data.forEach(source => {
  console.log(`${source.assigned_via}: ${source.percentage}%`);
});
```

---

### 6. `get_failed_attempt_statistics()`

**Returns:** Table with columns:
- `total_failed_sessions` - Sessions that never completed assignment
- `total_failed_attempts` - Total code entry attempts across failed sessions
- `avg_attempts_per_session` - Average attempts per failed session
- `sessions_with_1_attempt` - Count of sessions with 1 attempt
- `sessions_with_2_3_attempts` - Count of sessions with 2-3 attempts
- `sessions_with_4_plus_attempts` - Count of sessions with 4+ attempts

**Description:** Statistics about failed photographer code entry attempts.

**Example:**
```typescript
const { data } = await supabase.rpc('get_failed_attempt_statistics');
console.log(`Failed sessions: ${data[0].total_failed_sessions}`);
console.log(`Average attempts: ${data[0].avg_attempts_per_session}`);
```

---

### 7. `get_unassigned_user_analytics_summary()`

**Returns:** `JSONB` with structure:
```typescript
{
  total_unassigned_users: number;
  average_time_to_assignment: {
    seconds: number;
    hours: number;
    days: number;
    total_assigned: number;
  };
  assignment_source_distribution: Array<{
    assigned_via: string;
    assignment_count: number;
    percentage: number;
  }>;
  failed_attempts: {
    total_failed_sessions: number;
    total_failed_attempts: number;
    avg_attempts_per_session: number;
    sessions_with_1_attempt: number;
    sessions_with_2_3_attempts: number;
    sessions_with_4_plus_attempts: number;
  };
}
```

**Description:** Comprehensive analytics summary combining all key metrics in a single call.

**Example:**
```typescript
const { data } = await supabase.rpc('get_unassigned_user_analytics_summary');
console.log('Complete analytics summary:', data);
```

---

## React Hooks

Use the provided React hooks for easy integration in the super admin dashboard:

```typescript
import {
  useTotalUnassignedUsers,
  useAverageTimeToAssignment,
  useConversionRatePerPhotographer,
  useTopViewedContent,
  useAssignmentSourceDistribution,
  useFailedAttemptStatistics,
  useUnassignedUserAnalyticsSummary,
} from '@/hooks/useUnassignedUserAnalytics';
```

### Example Usage

```typescript
function AnalyticsDashboard() {
  const { data: summary, loading, error } = useUnassignedUserAnalyticsSummary();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h1>Unassigned User Analytics</h1>
      <p>Total unassigned: {summary?.total_unassigned_users}</p>
      <p>Avg time to assignment: {summary?.average_time_to_assignment.hours} hours</p>
      {/* Display other metrics */}
    </div>
  );
}
```

---

## Data Sources

The analytics functions query the following tables:

1. **`unassigned_user_sessions`** - Tracks individual user sessions before assignment
   - `user_id` - User reference
   - `session_start` / `session_end` - Session timestamps
   - `content_views` - JSONB of viewed BTS/announcement IDs
   - `code_entry_attempts` - Number of code entry attempts
   - `assigned_at` - Assignment timestamp (if successful)
   - `assigned_via` - Assignment method
   - `time_to_assignment_seconds` - Duration from start to assignment

2. **`client_assignment_log`** - Historical log of all assignments
   - `client_id` - User who was assigned
   - `admin_id` - Photographer they were assigned to
   - `photographer_code` - Code used for assignment
   - `assigned_via` - Assignment method
   - `created_at` - Assignment timestamp

3. **`clients`** - Current client-photographer relationships
   - `user_id` - Client user reference
   - `owner_admin_id` - Assigned photographer

4. **`user_profiles`** - User information
   - `photographer_code` - Photographer's unique code
   - `name` - Display name
   - `role` - User role (client, admin, super_admin)

---

## Performance Considerations

- All functions use `SECURITY DEFINER` to ensure proper access control
- Indexes exist on key columns:
  - `unassigned_user_sessions(user_id, session_start, assigned_at)`
  - `client_assignment_log(client_id, admin_id)`
  - `clients(user_id, owner_admin_id)`
  - `user_profiles(photographer_code)`

- For large datasets, consider:
  - Adding date range filters to queries
  - Implementing pagination for top content queries
  - Caching summary results on the frontend

---

## Security

All analytics functions are restricted to super admin users through RLS policies on the underlying tables. The functions themselves have `SECURITY DEFINER` to allow aggregation queries, but access is controlled at the table level.

---

## Requirements Mapping

This implementation satisfies the following requirements:

- **Requirement 14.7**: Track conversion_rate (assigned / total_users) for each photographer ✓
- **Requirement 14.8**: Super_Admin_Dashboard displays unassigned user metrics ✓
- **Requirement 14.9**: Track assignment_source distribution ✓
- **Requirement 14.10**: Track failed assignment attempts with invalid_code_attempts counter ✓
