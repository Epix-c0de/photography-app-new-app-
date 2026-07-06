'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

let chartRegistered = false;
async function registerChart() {
  if (chartRegistered) return;
  const { Chart, registerables } = await import('chart.js');
  Chart.register(...registerables);
  chartRegistered = true;
}

type Referral = {
  id: string;
  referrer_id: string;
  referred_id: string | null;
  referral_code: string;
  referral_token: string | null;
  status: string;
  reward_amount: number;
  created_at: string;
  rewarded_at: string | null;
  referrer_name: string;
  referrer_email: string;
  referred_name: string;
  referred_email: string;
};

type ReferralStats = {
  total_referrals: number;
  completed_referrals: number;
  pending_referrals: number;
  total_rewards_paid: number;
  unique_referrers: number;
};

type ReferralAnalytics = {
  referral_token: string;
  admin_id: string;
  admin_name: string;
  referral_code: string;
  total_clicks: number;
  conversions: number;
  conversion_rate: number;
  first_click_at: string | null;
  last_click_at: string | null;
};

export default function ReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [analytics, setAnalytics] = useState<ReferralAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: referralsData } = await supabase
        .from('referrals')
        .select('*')
        .order('created_at', { ascending: false });

      const refs = referralsData || [];
      if (refs.length) {
        const userIds = Array.from(new Set([
          ...refs.map(r => r.referrer_id),
          ...refs.filter(r => r.referred_id).map(r => r.referred_id!),
        ]));
        const { data: profiles } = await supabase.from('user_profiles').select('id, name, email').in('id', userIds);
        const pMap = new Map(profiles?.map(p => [p.id, p]) || []);

        setReferrals(refs.map(r => ({
          ...r,
          referrer_name: pMap.get(r.referrer_id)?.name || 'Unknown',
          referrer_email: pMap.get(r.referrer_id)?.email || '',
          referred_name: pMap.get(r.referred_id || '')?.name || '—',
          referred_email: pMap.get(r.referred_id || '')?.email || '',
        })));
      }

      const completed = refs.filter(r => r.status === 'completed' || r.status === 'rewarded');
      const pending = refs.filter(r => r.status === 'pending');
      const totalRewards = completed.reduce((sum, r) => sum + (r.reward_amount || 0), 0);
      const uniqueReferrers = new Set(refs.map(r => r.referrer_id)).size;

      setStats({
        total_referrals: refs.length,
        completed_referrals: completed.length,
        pending_referrals: pending.length,
        total_rewards_paid: totalRewards,
        unique_referrers: uniqueReferrers,
      });

      // Load referral analytics
      const { data: analyticsData } = await supabase.rpc('get_referral_analytics');
      setAnalytics(analyticsData || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Render bar chart when analytics data changes
  useEffect(() => {
    if (!chartRef.current || analytics.length === 0) return;

    let cancelled = false;

    (async () => {
      await registerChart();
      if (cancelled || !chartRef.current) return;

      const { Chart } = await import('chart.js');

      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }

      const ctx = chartRef.current.getContext('2d');
      if (!ctx) return;

      const labels = analytics.map(a => a.admin_name || a.referral_code);
      const clicks = analytics.map(a => a.total_clicks || 0);
      const conversions = analytics.map(a => a.conversions || 0);

      chartInstanceRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Clicks',
            data: clicks,
            backgroundColor: 'rgba(0, 122, 255, 0.7)',
            borderColor: 'rgba(0, 122, 255, 1)',
            borderWidth: 1,
            borderRadius: 6,
          },
          {
            label: 'Conversions',
            data: conversions,
            backgroundColor: 'rgba(52, 199, 89, 0.7)',
            borderColor: 'rgba(52, 199, 89, 1)',
            borderWidth: 1,
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#888', font: { weight: 'bold' } },
          },
        },
        scales: {
          x: {
            ticks: { color: '#666', maxRotation: 45 },
            grid: { color: 'rgba(255,255,255,0.03)' },
          },
          y: {
            beginAtZero: true,
            ticks: { color: '#666', stepSize: 1 },
            grid: { color: 'rgba(255,255,255,0.05)' },
          },
        },
      },
    });

    })();

    return () => {
      cancelled = true;
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [analytics]);

  const filtered = filterStatus === 'all' ? referrals : referrals.filter(r => r.status === filterStatus);

  const statusColors: Record<string, { bg: string; text: string }> = {
    pending: { bg: 'rgba(255,159,10,0.1)', text: '#FF9F0A' },
    completed: { bg: 'rgba(52,199,89,0.1)', text: '#34C759' },
    rewarded: { bg: 'rgba(212,175,55,0.1)', text: '#D4AF37' },
  };

  const totalClicks = analytics.reduce((sum, a) => sum + (a.total_clicks || 0), 0);
  const totalConversions = analytics.reduce((sum, a) => sum + (a.conversions || 0), 0);
  const overallConversionRate = totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black">Referral Program</h1>
          <p className="text-gray-400 mt-1">Track photographer referrals and reward payouts</p>
        </div>
        <button onClick={loadData} disabled={loading}
          className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
          style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Referrals', value: stats?.total_referrals ?? '—', color: '#D4AF37' },
          { label: 'Completed', value: stats?.completed_referrals ?? '—', color: '#34C759' },
          { label: 'Pending', value: stats?.pending_referrals ?? '—', color: '#FF9F0A' },
          { label: 'Rewards Paid', value: `KES ${stats?.total_rewards_paid ?? 0}`, color: '#007AFF' },
          { label: 'Unique Referrers', value: stats?.unique_referrers ?? '—', color: '#BF5AF2' },
        ].map((s, i) => (
          <div key={i} className="bg-[#111118] border border-white/5 rounded-2xl p-6">
            <p className="text-sm font-semibold text-gray-400 mb-2">{s.label}</p>
            <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Clicks & Conversions Analytics */}
      <div className="bg-[#111118] border border-white/5 rounded-2xl p-6">
        <h2 className="font-bold text-lg mb-4">Click & Conversion Analytics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-sm text-gray-400 mb-1">Total Clicks</p>
            <p className="text-3xl font-black" style={{ color: '#007AFF' }}>{totalClicks}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-sm text-gray-400 mb-1">Conversions</p>
            <p className="text-3xl font-black" style={{ color: '#34C759' }}>{totalConversions}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-sm text-gray-400 mb-1">Conversion Rate</p>
            <p className="text-3xl font-black" style={{ color: '#D4AF37' }}>{overallConversionRate}%</p>
          </div>
        </div>

        {analytics.length > 0 && (
          <div className="mb-6" style={{ height: '320px' }}>
            <canvas ref={chartRef} />
          </div>
        )}

        {/* Per-photographer breakdown */}
        {analytics.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-gray-400 uppercase">Per-Photographer Breakdown</h3>
            {analytics.map((a) => {
              const maxClicks = Math.max(...analytics.map(x => x.total_clicks || 1));
              const clickWidth = ((a.total_clicks || 0) / maxClicks) * 100;
              const convWidth = ((a.conversions || 0) / maxClicks) * 100;
              return (
                <div key={a.referral_token} className="bg-white/3 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-semibold text-sm">{a.admin_name}</p>
                      <p className="text-xs text-gray-500 font-mono">{a.referral_code}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs px-2 py-1 rounded-lg font-bold"
                        style={{
                          background: a.conversion_rate > 20 ? 'rgba(52,199,89,0.15)' : a.conversion_rate > 10 ? 'rgba(255,159,10,0.15)' : 'rgba(255,255,255,0.05)',
                          color: a.conversion_rate > 20 ? '#34C759' : a.conversion_rate > 10 ? '#FF9F0A' : '#888',
                        }}>
                        {a.conversion_rate}% CVR
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-12">Clicks</span>
                      <div className="flex-1 bg-white/5 rounded-full h-3 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${clickWidth}%`, background: 'linear-gradient(90deg, #007AFF, #5AC8FA)' }} />
                      </div>
                      <span className="text-xs font-bold w-8 text-right">{a.total_clicks}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-12">Converts</span>
                      <div className="flex-1 bg-white/5 rounded-full h-3 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${convWidth}%`, background: 'linear-gradient(90deg, #34C759, #A8E6CF)' }} />
                      </div>
                      <span className="text-xs font-bold w-8 text-right">{a.conversions}</span>
                    </div>
                  </div>
                  {a.first_click_at && (
                    <p className="text-xs text-gray-600 mt-2">
                      First click: {new Date(a.first_click_at).toLocaleDateString('en-KE')}
                      {a.last_click_at && ` · Last: ${new Date(a.last_click_at).toLocaleDateString('en-KE')}`}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {analytics.length === 0 && !loading && (
          <p className="text-gray-500 text-center py-8">No click analytics yet. Share some referral links to get started.</p>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['all', 'pending', 'completed', 'rewarded'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className="px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all"
            style={filterStatus === s
              ? { background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }
              : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
            {s} ({referrals.filter(r => s === 'all' || r.status === s).length})
          </button>
        ))}
      </div>

      {/* Referrals Table */}
      <div className="bg-[#111118] border border-white/5 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5">
          <h2 className="font-bold">All Referrals ({filtered.length})</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'rgba(212,175,55,0.4)', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Referrer</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Referred User</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Reward</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(ref => (
                  <tr key={ref.id} className="hover:bg-white/2">
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-white">{ref.referrer_name}</p>
                      <p className="text-xs text-gray-500">{ref.referrer_email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs px-2 py-1 rounded bg-white/5 text-gray-300">{ref.referral_code}</span>
                      {ref.referral_token && (
                        <span className="font-mono text-xs px-2 py-1 rounded bg-white/5 text-gray-500 ml-1">{ref.referral_token}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-white">{ref.referred_name}</p>
                      {ref.referred_email && <p className="text-xs text-gray-500">{ref.referred_email}</p>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded-lg text-xs font-bold capitalize"
                        style={statusColors[ref.status] || { bg: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }}>
                        {ref.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-bold" style={{ color: '#34C759' }}>
                      KES {ref.reward_amount}
                    </td>
                    <td className="px-6 py-4 text-right text-xs text-gray-500">
                      {new Date(ref.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">No referrals found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
