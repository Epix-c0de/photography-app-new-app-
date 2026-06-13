'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type AnalyticsSummary = {
  generated_at: string;
  total_unassigned_users: number;
  average_time_to_assignment: {
    avg_seconds: number | null;
    avg_hours: number | null;
    avg_days: number | null;
    total_assigned_sessions: number;
  };
  assignment_source_distribution: Array<{
    source: string;
    count: number;
    percentage: number;
  }>;
  failed_attempts: {
    total_failed_sessions: number;
    total_failed_attempts: number;
    avg_attempts_per_session: number;
    max_attempts_in_session: number;
    sessions_with_1_attempt: number;
    sessions_with_2_3_attempts: number;
    sessions_with_4_9_attempts: number;
    sessions_with_10_plus_attempts: number;
    last_7_days: number;
    last_30_days: number;
  };
  top_viewed_content: Array<{
    content_type: string;
    content_id: string;
    title: string;
    view_count: number;
    visibility: string;
    published_at: string;
  }>;
};

type PhotographerConversion = {
  photographer_id: string;
  photographer_name: string;
  photographer_code: string;
  total_assigned_clients: number;
  users_who_attempted: number;
  conversion_rate_pct: number;
  avg_time_to_assign_hours: number;
  total_failed_attempts: number;
};

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [conversions, setConversions] = useState<PhotographerConversion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [summaryRes, conversionRes] = await Promise.all([
        supabase.rpc('get_unassigned_user_analytics', { p_limit_top_content: 10 } as any),
        supabase.rpc('get_photographer_conversion_report' as any),
      ]);

      if (summaryRes.data) setSummary(summaryRes.data as AnalyticsSummary);
      if (conversionRes.data) setConversions(conversionRes.data as PhotographerConversion[]);
    } catch (e) {
      console.error('Analytics load error:', e);
    } finally {
      setLoading(false);
    }
  }

  const sourceColors: Record<string, string> = {
    code_entry: '#D4AF37',
    qr_scan: '#34C759',
    invite_link: '#007AFF',
    admin_invite: '#BF5AF2',
  };

  const fmt = (n: number | null | undefined, decimals = 1) =>
    n == null ? '—' : Number(n).toFixed(decimals);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black">Unassigned User Analytics</h1>
          <p className="text-gray-400 mt-1">Track assignment funnels, conversion rates, and content engagement</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
          style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {loading && !summary ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'rgba(212,175,55,0.4)', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <>
          {/* Key Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#111118] border border-white/5 rounded-2xl p-6">
              <p className="text-sm font-semibold text-gray-400 mb-2">Total Unassigned Users</p>
              <p className="text-3xl font-black" style={{ color: '#FF9F0A' }}>
                {summary?.total_unassigned_users ?? '—'}
              </p>
              <p className="text-xs text-gray-500 mt-2">No photographer yet</p>
            </div>

            <div className="bg-[#111118] border border-white/5 rounded-2xl p-6">
              <p className="text-sm font-semibold text-gray-400 mb-2">Avg Time to Assignment</p>
              <p className="text-3xl font-black" style={{ color: '#D4AF37' }}>
                {fmt(summary?.average_time_to_assignment?.avg_hours)}h
              </p>
              <p className="text-xs text-gray-500 mt-2">
                {fmt(summary?.average_time_to_assignment?.avg_days)}d avg •{' '}
                {summary?.average_time_to_assignment?.total_assigned_sessions ?? 0} sessions
              </p>
            </div>

            <div className="bg-[#111118] border border-white/5 rounded-2xl p-6">
              <p className="text-sm font-semibold text-gray-400 mb-2">Failed Attempt Sessions</p>
              <p className="text-3xl font-black" style={{ color: '#FF3B30' }}>
                {summary?.failed_attempts?.total_failed_sessions ?? '—'}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Avg {fmt(summary?.failed_attempts?.avg_attempts_per_session)} tries/session
              </p>
            </div>

            <div className="bg-[#111118] border border-white/5 rounded-2xl p-6">
              <p className="text-sm font-semibold text-gray-400 mb-2">Failed Attempts (30d)</p>
              <p className="text-3xl font-black text-white">
                {summary?.failed_attempts?.last_30_days ?? '—'}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                {summary?.failed_attempts?.last_7_days ?? 0} in last 7 days
              </p>
            </div>
          </div>

          {/* Assignment Source Distribution + Failed Attempt Buckets */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Assignment Sources */}
            <div className="bg-[#111118] border border-white/5 rounded-2xl p-6">
              <h2 className="font-bold mb-4">Assignment Source Distribution</h2>
              {!summary?.assignment_source_distribution?.length ? (
                <p className="text-gray-500 text-sm">No assignment data yet</p>
              ) : (
                <div className="space-y-3">
                  {summary.assignment_source_distribution.map((src) => (
                    <div key={src.source}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold capitalize text-white">
                          {src.source.replace(/_/g, ' ')}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-400">{src.count}</span>
                          <span className="text-sm font-bold" style={{ color: sourceColors[src.source] ?? '#ffffff' }}>
                            {fmt(src.percentage)}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-2 rounded-full bg-white/5">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${src.percentage}%`,
                            background: sourceColors[src.source] ?? '#D4AF37',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Failed Attempt Buckets */}
            <div className="bg-[#111118] border border-white/5 rounded-2xl p-6">
              <h2 className="font-bold mb-4">Failed Attempt Breakdown</h2>
              <div className="space-y-3">
                {[
                  { label: '1 attempt', value: summary?.failed_attempts?.sessions_with_1_attempt },
                  { label: '2–3 attempts', value: summary?.failed_attempts?.sessions_with_2_3_attempts },
                  { label: '4–9 attempts', value: summary?.failed_attempts?.sessions_with_4_9_attempts },
                  { label: '10+ attempts', value: summary?.failed_attempts?.sessions_with_10_plus_attempts },
                ].map((bucket) => {
                  const total = summary?.failed_attempts?.total_failed_sessions || 1;
                  const pct = ((bucket.value ?? 0) / total) * 100;
                  return (
                    <div key={bucket.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-300">{bucket.label}</span>
                        <span className="text-sm font-bold text-white">{bucket.value ?? 0}</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-white/5">
                        <div
                          className="h-2 rounded-full"
                          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #D4AF37, #F0D060)' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-4 border-t border-white/5 flex justify-between text-sm">
                <span className="text-gray-400">Max attempts in one session</span>
                <span className="font-bold text-white">{summary?.failed_attempts?.max_attempts_in_session ?? 0}</span>
              </div>
            </div>
          </div>

          {/* Top Viewed Content */}
          <div className="bg-[#111118] border border-white/5 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5">
              <h2 className="font-bold">Top Viewed Content by Unassigned Users</h2>
            </div>
            {!summary?.top_viewed_content?.length ? (
              <div className="px-6 py-10 text-center text-gray-500">No content views recorded yet</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">#</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Visibility</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Views</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {summary.top_viewed_content.map((item, i) => (
                    <tr key={item.content_id} className="hover:bg-white/2">
                      <td className="px-6 py-4 text-gray-500 text-sm">{i + 1}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-white">{item.title}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded text-xs font-bold uppercase"
                          style={{
                            background: item.content_type === 'bts' ? 'rgba(212,175,55,0.1)' : 'rgba(0,122,255,0.1)',
                            color: item.content_type === 'bts' ? '#D4AF37' : '#007AFF',
                          }}>
                          {item.content_type === 'bts' ? 'BTS' : 'Announcement'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded text-xs font-bold capitalize"
                          style={{
                            background: item.visibility === 'global' ? 'rgba(52,199,89,0.1)' : 'rgba(255,255,255,0.05)',
                            color: item.visibility === 'global' ? '#34C759' : 'rgba(255,255,255,0.4)',
                          }}>
                          {item.visibility?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-black" style={{ color: '#D4AF37' }}>
                        {item.view_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Per-Photographer Conversion Table */}
          <div className="bg-[#111118] border border-white/5 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5">
              <h2 className="font-bold">Photographer Conversion Report</h2>
              <p className="text-xs text-gray-500 mt-1">Assignment counts, conversion rates, and average time-to-assign</p>
            </div>
            {!conversions.length ? (
              <div className="px-6 py-10 text-center text-gray-500">No photographer conversion data yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Photographer</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Code</th>
                      <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Assigned</th>
                      <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Attempted</th>
                      <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Conv. Rate</th>
                      <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Avg Time (h)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {conversions.map((p) => (
                      <tr key={p.photographer_id} className="hover:bg-white/2">
                        <td className="px-6 py-4 text-sm font-semibold text-white">{p.photographer_name}</td>
                        <td className="px-6 py-4">
                          <span className="font-mono text-xs px-2 py-1 rounded bg-white/5 text-gray-300">
                            {p.photographer_code || '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-bold" style={{ color: '#34C759' }}>
                          {p.total_assigned_clients}
                        </td>
                        <td className="px-6 py-4 text-right text-gray-400">{p.users_who_attempted}</td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-bold"
                            style={{ color: Number(p.conversion_rate_pct) >= 50 ? '#34C759' : Number(p.conversion_rate_pct) >= 20 ? '#FF9F0A' : '#FF3B30' }}>
                            {fmt(p.conversion_rate_pct)}%
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-gray-300">{fmt(p.avg_time_to_assign_hours)}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
