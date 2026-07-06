'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

type SmsLog = {
  id: string;
  photographer_id: string;
  phone_number: string;
  message: string;
  status: string;
  provider: string;
  cost: number | null;
  created_at: string;
  photographer_name: string;
};

type SmsStats = {
  total_sent: number;
  total_delivered: number;
  total_failed: number;
  total_cost: number;
  today_sent: number;
  this_month_sent: number;
};

export default function SmsAnalyticsPage() {
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [stats, setStats] = useState<SmsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [logsRes, totalRes, deliveredRes, failedRes, costRes, todayRes, monthRes] = await Promise.all([
        supabase.from('sms_logs').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('sms_logs').select('*', { count: 'exact', head: true }),
        supabase.from('sms_logs').select('*', { count: 'exact', head: true }).eq('status', 'delivered'),
        supabase.from('sms_logs').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
        supabase.from('sms_logs').select('cost'),
        supabase.from('sms_logs').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
        supabase.from('sms_logs').select('*', { count: 'exact', head: true }).gte('created_at', monthStart),
      ]);

      const logs = logsRes.data || [];
      if (logs.length) {
        const ids = Array.from(new Set(logs.map(l => l.photographer_id)));
        const { data: profiles } = await supabase.from('user_profiles').select('id, name').in('id', ids);
        const pMap = new Map(profiles?.map(p => [p.id, p.name]) || []);
        setLogs(logs.map(l => ({ ...l, photographer_name: pMap.get(l.photographer_id) || 'Unknown' })));
      }

      const totalCost = costRes.data?.reduce((sum, l) => sum + (l.cost || 0), 0) || 0;

      setStats({
        total_sent: totalRes.count || 0,
        total_delivered: deliveredRes.count || 0,
        total_failed: failedRes.count || 0,
        total_cost: totalCost,
        today_sent: todayRes.count || 0,
        this_month_sent: monthRes.count || 0,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = logs.filter(l => {
    if (filterStatus !== 'all' && l.status !== filterStatus) return false;
    if (search && !l.phone_number.includes(search) && !l.photographer_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const deliveryRate = stats && stats.total_sent > 0
    ? ((stats.total_delivered / stats.total_sent) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black">SMS Analytics</h1>
          <p className="text-gray-400 mt-1">Track SMS delivery rates, costs, and usage across all photographers</p>
        </div>
        <button onClick={loadData} disabled={loading}
          className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
          style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-[#111118] border border-white/5 rounded-2xl p-6">
          <p className="text-sm font-semibold text-gray-400 mb-2">Total SMS Sent</p>
          <p className="text-3xl font-black" style={{ color: '#D4AF37' }}>{stats?.total_sent ?? '—'}</p>
          <p className="text-xs text-gray-500 mt-2">{stats?.today_sent ?? 0} today • {stats?.this_month_sent ?? 0} this month</p>
        </div>
        <div className="bg-[#111118] border border-white/5 rounded-2xl p-6">
          <p className="text-sm font-semibold text-gray-400 mb-2">Delivery Rate</p>
          <p className="text-3xl font-black" style={{ color: '#34C759' }}>{deliveryRate}%</p>
          <p className="text-xs text-gray-500 mt-2">{stats?.total_delivered ?? 0} delivered • {stats?.total_failed ?? 0} failed</p>
        </div>
        <div className="bg-[#111118] border border-white/5 rounded-2xl p-6">
          <p className="text-sm font-semibold text-gray-400 mb-2">Total Cost</p>
          <p className="text-3xl font-black" style={{ color: '#FF9F0A' }}>KES {(stats?.total_cost ?? 0).toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-2">Africa's Talking billing</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <input type="text" placeholder="Search phone or photographer..." value={search} onChange={e => setSearch(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white text-sm w-72" />
        <div className="flex gap-2">
          {['all', 'sent', 'delivered', 'failed'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
              style={filterStatus === s
                ? { background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }
                : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* SMS Logs Table */}
      <div className="bg-[#111118] border border-white/5 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5">
          <h2 className="font-bold">SMS Logs ({filtered.length})</h2>
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
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Photographer</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Message</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Provider</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Cost</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(log => (
                  <tr key={log.id} className="hover:bg-white/2">
                    <td className="px-6 py-4 text-sm font-semibold text-white">{log.photographer_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-300 font-mono">{log.phone_number}</td>
                    <td className="px-6 py-4 text-sm text-gray-400 max-w-xs truncate">{log.message}</td>
                    <td className="px-6 py-4">
                      <span className="text-xs px-2 py-1 rounded bg-white/5 text-gray-400 capitalize">{log.provider || 'at'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded-lg text-xs font-bold capitalize"
                        style={{
                          background: log.status === 'delivered' ? 'rgba(52,199,89,0.1)' : log.status === 'failed' ? 'rgba(255,59,48,0.1)' : 'rgba(255,159,10,0.1)',
                          color: log.status === 'delivered' ? '#34C759' : log.status === 'failed' ? '#FF3B30' : '#FF9F0A',
                        }}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-400">{log.cost != null ? `KES ${log.cost.toFixed(2)}` : '—'}</td>
                    <td className="px-6 py-4 text-right text-xs text-gray-500">
                      {new Date(log.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500">No SMS logs found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
