/**
 * Example component demonstrating unassigned user analytics display
 * This can be integrated into the super admin dashboard
 */

import React from 'react';
import {
  useUnassignedUserAnalyticsSummary,
  useTopViewedContent,
  useConversionRatePerPhotographer,
} from '@/hooks/useUnassignedUserAnalytics';

export function UnassignedUserAnalyticsCard() {
  const { data: summary, loading, error, refresh } = useUnassignedUserAnalyticsSummary();

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 rounded-lg border border-red-200">
        <p className="text-red-800">Error loading analytics: {error.message}</p>
        <button
          onClick={refresh}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="p-6 bg-gray-50 rounded-lg">
        <p className="text-gray-600">No analytics data available</p>
      </div>
    );
  }

  const formatTime = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)} minutes`;
    if (hours < 24) return `${hours.toFixed(1)} hours`;
    return `${(hours / 24).toFixed(1)} days`;
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Unassigned User Analytics</h2>
        <button
          onClick={refresh}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Unassigned */}
        <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
          <p className="text-sm text-orange-600 font-medium">Total Unassigned</p>
          <p className="text-3xl font-bold text-orange-900">
            {summary.total_unassigned_users}
          </p>
          <p className="text-xs text-orange-600 mt-1">Users without photographer</p>
        </div>

        {/* Average Time to Assignment */}
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-600 font-medium">Avg Time to Assign</p>
          <p className="text-3xl font-bold text-blue-900">
            {formatTime(summary.average_time_to_assignment.hours)}
          </p>
          <p className="text-xs text-blue-600 mt-1">
            Based on {summary.average_time_to_assignment.total_assigned} assignments
          </p>
        </div>

        {/* Total Failed Sessions */}
        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <p className="text-sm text-red-600 font-medium">Failed Sessions</p>
          <p className="text-3xl font-bold text-red-900">
            {summary.failed_attempts.total_failed_sessions}
          </p>
          <p className="text-xs text-red-600 mt-1">
            {summary.failed_attempts.total_failed_attempts} total attempts
          </p>
        </div>

        {/* Average Failed Attempts */}
        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <p className="text-sm text-yellow-600 font-medium">Avg Failed Attempts</p>
          <p className="text-3xl font-bold text-yellow-900">
            {summary.failed_attempts.avg_attempts_per_session?.toFixed(1) || '0'}
          </p>
          <p className="text-xs text-yellow-600 mt-1">Per failed session</p>
        </div>
      </div>

      {/* Assignment Source Distribution */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Assignment Sources</h3>
        <div className="space-y-2">
          {summary.assignment_source_distribution.map((source) => (
            <div key={source.assigned_via} className="flex items-center">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700 capitalize">
                    {source.assigned_via.replace('_', ' ')}
                  </span>
                  <span className="text-sm text-gray-600">
                    {source.assignment_count} ({source.percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${source.percentage}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Failed Attempt Breakdown */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Failed Attempt Breakdown</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 bg-gray-50 rounded">
            <p className="text-xs text-gray-600">1 Attempt</p>
            <p className="text-xl font-bold text-gray-900">
              {summary.failed_attempts.sessions_with_1_attempt}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded">
            <p className="text-xs text-gray-600">2-3 Attempts</p>
            <p className="text-xl font-bold text-gray-900">
              {summary.failed_attempts.sessions_with_2_3_attempts}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded">
            <p className="text-xs text-gray-600">4+ Attempts</p>
            <p className="text-xl font-bold text-gray-900">
              {summary.failed_attempts.sessions_with_4_plus_attempts}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TopViewedContentCard() {
  const { data: content, loading, error } = useTopViewedContent(5);

  if (loading) {
    return <div className="p-6 bg-white rounded-lg shadow">Loading...</div>;
  }

  if (error || !content || content.length === 0) {
    return null;
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Top Viewed Content</h2>
      <div className="space-y-3">
        {content.map((item) => (
          <div key={item.content_id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <div className="flex-1">
              <p className="font-medium text-gray-800">{item.title}</p>
              <p className="text-xs text-gray-500 capitalize">{item.content_type}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-blue-600">{item.view_count}</p>
              <p className="text-xs text-gray-500">views</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PhotographerConversionTable() {
  const { data: photographers, loading, error } = useConversionRatePerPhotographer();

  if (loading) {
    return <div className="p-6 bg-white rounded-lg shadow">Loading...</div>;
  }

  if (error || !photographers || photographers.length === 0) {
    return null;
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Photographer Conversion Rates</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Photographer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Code
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Assignments
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Failed Attempts
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Conversion Rate
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {photographers.map((photographer) => (
              <tr key={photographer.photographer_id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {photographer.photographer_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                  {photographer.photographer_code}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {photographer.total_assignments}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {photographer.failed_attempts}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      photographer.conversion_rate >= 75
                        ? 'bg-green-100 text-green-800'
                        : photographer.conversion_rate >= 50
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {photographer.conversion_rate.toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
