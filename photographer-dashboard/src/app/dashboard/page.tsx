'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function DashboardOverview() {
  const [stats, setStats] = useState({
    totalClients: 0, totalGalleries: 0, paidGalleries: 0,
    totalRevenue: 0, revenueThisMonth: 0, pendingPayments: 0,
    smsBalance: 0, upcomingBookings: 0,
  });
  const [recentGalleries, setRecentGalleries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [
        { count: clientCount },
        { data: galleries },
        { data: subs },
        { count: bookingCount },
        { data: settings },
      ] = await Promise.all([
        supabase.from('clients').select('*', { count: 'exact', head: true }).eq('owner_admin_id', user.id),
        supabase.from('galleries').select('id, name, is_paid, price, created_at, cover_photo_url').eq('owner_admin_id', user.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('admin_subscriptions').select('amount, created_at').eq('admin_id', user.id).eq('status', 'success'),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('user_id', user.id).in('status', ['pending', 'confirmed']),
        supabase.from('admin_settings').select('sms_credits').eq('admin_id', user.id).maybeSingle(),
      ]);

      const { count: galleryCount } = await supabase.from('galleries').select('*', { count: 'exact', head: true }).eq('owner_admin_id', user.id);
      const { count: paidCount } = await supabase.from('galleries').select('*', { count: 'exact', head: true }).eq('owner_admin_id', user.id).eq('is_paid', true);

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const totalRevenue = (subs || []).reduce((s: number, r: any) => s + (r.amount || 0), 0);
      const monthRevenue = (subs || []).filter((r: any) => r.created_at >= monthStart).reduce((s: number, r: any) => s + (r.amount || 0), 0);

      const { count: pendingCount } = await supabase.from('galleries').select('*', { count: 'exact', head: true }).eq('owner_admin_id', user.id).eq('is_paid', false);

      setStats({
        totalClients: clientCount || 0,
        totalGalleries: galleryCount || 0,
        paidGalleries: paidCount || 0,
        totalRevenue,
        revenueThisMonth: monthRevenue,
        pendingPayments: pendingCount || 0,
        smsBalance: (settings as any)?.sms_credits || 0,
        upcomingBookings: bookingCount || 0,
      });
      setRecentGalleries(galleries || []);
      setLoading(false);
    })();
  }, []);

  const statCards = [
    { label: 'Total Clients', value: stats.totalClients, color: 'text-yellow-400', icon: '👥' },
    { label: 'Galleries', value: stats.totalGalleries, color: 'text-blue-400', icon: '🖼️' },
    { label: 'Paid Galleries', value: stats.paidGalleries, color: 'text-green-400', icon: '✅' },
    { label: 'Pending Payment', value: stats.pendingPayments, color: 'text-orange-400', icon: '⏳' },
    { label: 'Total Revenue', value: `KES ${stats.totalRevenue.toLocaleString()}`, color: 'text-yellow-400', icon: '💰' },
    { label: 'This Month', value: `KES ${stats.revenueThisMonth.toLocaleString()}`, color: 'text-green-400', icon: '📈' },
    { label: 'SMS Credits', value: stats.smsBalance, color: 'text-purple-400', icon: '📱' },
    { label: 'Upcoming Shoots', value: stats.upcomingBookings, color: 'text-blue-400', icon: '📅' },
  ];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black">Dashboard</h1>
        <p className="text-gray-400 mt-1">Your studio at a glance</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="bg-[#111118] border border-white/5 rounded-2xl p-5">
            <div className="text-2xl mb-2">{s.icon}</div>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-gray-500 text-xs mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Recent galleries */}
      <div>
        <h2 className="text-xl font-bold mb-4">Recent Galleries</h2>
        <div className="bg-[#111118] border border-white/5 rounded-2xl overflow-hidden">
          {recentGalleries.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No galleries yet. <a href="/dashboard/upload" className="text-yellow-400 hover:underline">Upload your first gallery →</a></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-gray-500 text-xs uppercase">
                  <th className="text-left px-6 py-3">Gallery</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-6 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {recentGalleries.map((g) => (
                  <tr key={g.id} className="border-b border-white/5 hover:bg-white/2">
                    <td className="px-6 py-3 font-medium">{g.name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-lg text-xs font-bold ${g.is_paid ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}`}>
                        {g.is_paid ? 'Paid' : 'Unpaid'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right text-gray-400">
                      {new Date(g.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
