'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function SuperAdminOverview() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPhotographers: 0, activeNow: 0, expiringSoon: 0,
    totalRevenue: 0, monthlyRevenue: 0,
    totalClients: 0, totalGalleries: 0, totalPhotos: 0,
  });
  const [recentPhotographers, setRecentPhotographers] = useState<any[]>([]);
  const [recentSubs, setRecentSubs] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [
        { data: admins },
        { data: galleries },
        { data: clients },
        { data: subs },
        { count: photoCount },
      ] = await Promise.all([
        supabase.from('user_profiles').select('id, name, email, subscription_status, subscription_expires_at, is_lifetime, created_at').in('role', ['admin', 'super_admin']).order('created_at', { ascending: false }).limit(5) as any,
        supabase.from('galleries').select('owner_admin_id', { count: 'exact' }) as any,
        supabase.from('clients').select('owner_admin_id', { count: 'exact' }) as any,
        supabase.from('admin_subscriptions').select('admin_id, amount, status, created_at, phone_number').eq('status', 'success').order('created_at', { ascending: false }).limit(10) as any,
        supabase.from('gallery_photos').select('*', { count: 'exact', head: true }),
      ]);

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Need full admin list for stats
      const { data: allAdmins } = await supabase.from('user_profiles').select('id, subscription_status, subscription_expires_at, is_lifetime').in('role', ['admin', 'super_admin']) as any;

      const activeNow = (allAdmins || []).filter((p: any) => p.is_lifetime || (p.subscription_status === 'active' && p.subscription_expires_at && new Date(p.subscription_expires_at) > now)).length;
      const expiringSoon = (allAdmins || []).filter((p: any) => !p.is_lifetime && p.subscription_expires_at && new Date(p.subscription_expires_at) > now && Math.ceil((new Date(p.subscription_expires_at).getTime() - now.getTime()) / 86400000) <= 7).length;
      const totalRevenue = (subs || []).reduce((s: number, r: any) => s + (r.amount || 0), 0);
      const monthRevenue = (subs || []).filter((r: any) => r.created_at >= monthStart).reduce((s: number, r: any) => s + (r.amount || 0), 0);

      setStats({
        totalPhotographers: (allAdmins || []).length,
        activeNow, expiringSoon, totalRevenue, monthlyRevenue: monthRevenue,
        totalClients: (clients || []).length,
        totalGalleries: (galleries || []).length,
        totalPhotos: photoCount || 0,
      });
      setRecentPhotographers(admins || []);
      setRecentSubs(subs || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'rgba(212,175,55,0.5)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const statCards = [
    { label: 'Total Photographers', value: stats.totalPhotographers, color: '#D4AF37', icon: '📸', href: '/dashboard/photographers' },
    { label: 'Active Subscriptions', value: stats.activeNow, color: '#34C759', icon: '✅', href: '/dashboard/photographers?filter=active' },
    { label: 'Expiring Soon', value: stats.expiringSoon, color: '#FF9F0A', icon: '⚠️', href: '/dashboard/photographers?filter=expired' },
    { label: 'Total Revenue', value: `KES ${stats.totalRevenue.toLocaleString()}`, color: '#D4AF37', icon: '💰', href: '/dashboard/photographers' },
    { label: 'This Month', value: `KES ${stats.monthlyRevenue.toLocaleString()}`, color: '#34C759', icon: '📈', href: '/dashboard/photographers' },
    { label: 'Total Clients', value: stats.totalClients.toLocaleString(), color: '#0A84FF', icon: '👥', href: '/dashboard/clients' },
    { label: 'Total Galleries', value: stats.totalGalleries.toLocaleString(), color: '#AF52DE', icon: '🖼️', href: '/dashboard/photographers' },
    { label: 'Total Photos', value: stats.totalPhotos.toLocaleString(), color: '#FF375F', icon: '📷', href: '/dashboard/photographers' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black">Platform Overview</h1>
        <p className="text-gray-400 mt-1">Real-time platform health and revenue</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(s => (
          <Link key={s.label} href={s.href} style={{ textDecoration: 'none' }}>
            <div className="rounded-2xl p-5 border border-white/5 cursor-pointer transition-all hover:border-yellow-500/20 hover:-translate-y-0.5"
              style={{ background: '#111118' }}>
              <div className="text-2xl mb-3">{s.icon}</div>
              <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
              <p className="text-sm font-semibold text-white mt-1">{s.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Revenue banner */}
      <div className="rounded-2xl p-6 border" style={{ background: 'rgba(212,175,55,0.05)', borderColor: 'rgba(212,175,55,0.15)' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">All-Time Platform Revenue</p>
            <p className="text-4xl font-black" style={{ color: '#D4AF37' }}>KES {stats.totalRevenue.toLocaleString()}</p>
            <p className="text-sm text-gray-400 mt-1">+KES {stats.monthlyRevenue.toLocaleString()} this month</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 mb-1">Active photographers</p>
            <p className="text-3xl font-black text-green-400">{stats.activeNow}</p>
            <p className="text-xs text-yellow-400 mt-1">{stats.expiringSoon} expiring soon</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent photographers */}
        <div className="bg-[#111118] border border-white/5 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="font-bold">Recent Photographers</h2>
            <Link href="/dashboard/photographers" className="text-xs font-bold" style={{ color: '#D4AF37' }}>View all →</Link>
          </div>
          <div className="divide-y divide-white/5">
            {recentPhotographers.map(p => {
              const now = new Date();
              const isActive = p.is_lifetime || (p.subscription_status === 'active' && p.subscription_expires_at && new Date(p.subscription_expires_at) > now);
              return (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37' }}>
                    {(p.name || p.email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{p.name || 'No name'}</p>
                    <p className="text-xs text-gray-500 truncate">{p.email}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-lg font-bold flex-shrink-0"
                    style={{ background: isActive ? 'rgba(52,199,89,0.1)' : 'rgba(255,59,48,0.1)', color: isActive ? '#34C759' : '#FF3B30' }}>
                    {isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent payments */}
        <div className="bg-[#111118] border border-white/5 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <h2 className="font-bold">Recent Payments</h2>
          </div>
          <div className="divide-y divide-white/5">
            {recentSubs.length === 0 ? (
              <p className="text-center text-gray-500 text-sm py-8">No payments yet</p>
            ) : recentSubs.map((s: any) => (
              <div key={s.id || s.created_at} className="flex items-center gap-3 px-5 py-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                  style={{ background: 'rgba(52,199,89,0.1)', color: '#34C759' }}>💚</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">KES {(s.amount || 500).toLocaleString()}</p>
                  <p className="text-xs text-gray-500">{s.phone_number || 'M-Pesa'}</p>
                </div>
                <p className="text-xs text-gray-500 flex-shrink-0">
                  {new Date(s.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Manage Photographers', href: '/dashboard/photographers', icon: '📸', color: '#D4AF37' },
          { label: 'All Clients', href: '/dashboard/clients', icon: '👥', color: '#0A84FF' },
          { label: 'Chat with Photographers', href: '/dashboard/chat', icon: '💬', color: '#34C759' },
          { label: 'Platform Settings', href: '/dashboard/settings', icon: '⚙️', color: '#AF52DE' },
        ].map(a => (
          <Link key={a.label} href={a.href} style={{ textDecoration: 'none' }}>
            <div className="rounded-2xl p-4 border border-white/5 hover:border-yellow-500/20 transition-all cursor-pointer flex items-center gap-3"
              style={{ background: '#111118' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: `${a.color}18` }}>{a.icon}</div>
              <span className="text-sm font-bold text-white">{a.label}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
