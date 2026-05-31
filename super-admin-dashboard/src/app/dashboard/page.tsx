'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type Photographer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  subscription_status: string;
  subscription_expires_at: string | null;
  is_lifetime: boolean;
  created_at: string;
  gallery_count: number;
  client_count: number;
  total_revenue: number;
};

type PlatformStats = {
  totalPhotographers: number;
  activeSubscriptions: number;
  expiredSubscriptions: number;
  totalClients: number;
  totalGalleries: number;
  monthlyRevenue: number;
};

function StatusBadge({ status, expiresAt, isLifetime }: { status: string; expiresAt: string | null; isLifetime: boolean }) {
  if (isLifetime) return <span className="px-2 py-1 rounded-lg text-xs font-bold bg-purple-500/20 text-purple-400">Lifetime</span>;
  if (status === 'active' && expiresAt && new Date(expiresAt) > new Date()) {
    const daysLeft = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
    return <span className="px-2 py-1 rounded-lg text-xs font-bold bg-green-500/20 text-green-400">Active · {daysLeft}d left</span>;
  }
  if (status === 'inactive') return <span className="px-2 py-1 rounded-lg text-xs font-bold bg-gray-500/20 text-gray-400">Inactive</span>;
  return <span className="px-2 py-1 rounded-lg text-xs font-bold bg-red-500/20 text-red-400">Expired</span>;
}

export default function SuperAdminDashboard() {
  const router = useRouter();
  const [photographers, setPhotographers] = useState<Photographer[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'expired' | 'inactive'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      // Verify super admin
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: profile } = await supabase
        .from('user_profiles').select('role').eq('id', user.id).single() as any;
      if (profile?.role !== 'super_admin') { router.push('/login'); return; }

      // Fetch all admins
      const { data: admins } = await supabase
        .from('user_profiles')
        .select('id, name, email, phone, subscription_status, subscription_expires_at, is_lifetime, created_at')
        .in('role', ['admin', 'super_admin'])
        .order('created_at', { ascending: false }) as any;

      // Fetch gallery counts per admin
      const { data: galleries } = await supabase
        .from('galleries').select('owner_admin_id') as any;

      // Fetch client counts per admin
      const { data: clients } = await supabase
        .from('clients').select('owner_admin_id') as any;

      // Fetch subscription revenue
      const { data: subs } = await supabase
        .from('admin_subscriptions')
        .select('admin_id, amount, status')
        .eq('status', 'success') as any;

      const galleryCounts = new Map<string, number>();
      (galleries || []).forEach((g: any) => {
        galleryCounts.set(g.owner_admin_id, (galleryCounts.get(g.owner_admin_id) || 0) + 1);
      });

      const clientCounts = new Map<string, number>();
      (clients || []).forEach((c: any) => {
        clientCounts.set(c.owner_admin_id, (clientCounts.get(c.owner_admin_id) || 0) + 1);
      });

      const revenueCounts = new Map<string, number>();
      (subs || []).forEach((s: any) => {
        revenueCounts.set(s.admin_id, (revenueCounts.get(s.admin_id) || 0) + (s.amount || 0));
      });

      const enriched: Photographer[] = (admins || []).map((a: any) => ({
        ...a,
        gallery_count: galleryCounts.get(a.id) || 0,
        client_count: clientCounts.get(a.id) || 0,
        total_revenue: revenueCounts.get(a.id) || 0,
      }));

      setPhotographers(enriched);

      // Platform stats
      const now = new Date();
      const activeCount = enriched.filter(p =>
        p.is_lifetime ||
        (p.subscription_status === 'active' && p.subscription_expires_at && new Date(p.subscription_expires_at) > now)
      ).length;

      const thisMonthRevenue = (subs || [])
        .filter((s: any) => new Date(s.created_at || '').getMonth() === now.getMonth())
        .reduce((sum: number, s: any) => sum + (s.amount || 0), 0);

      setStats({
        totalPhotographers: enriched.length,
        activeSubscriptions: activeCount,
        expiredSubscriptions: enriched.length - activeCount,
        totalClients: (clients || []).length,
        totalGalleries: (galleries || []).length,
        monthlyRevenue: thisMonthRevenue,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleExtend = async (adminId: string, days: number) => {
    setActionLoading(adminId);
    try {
      const p = photographers.find(p => p.id === adminId);
      const base = p?.subscription_expires_at && new Date(p.subscription_expires_at) > new Date()
        ? new Date(p.subscription_expires_at)
        : new Date();
      base.setDate(base.getDate() + days);

      await supabase.from('user_profiles').update({
        subscription_status: 'active',
        subscription_expires_at: base.toISOString(),
      }).eq('id', adminId);

      await loadData();
    } catch (e) { console.error(e); }
    setActionLoading(null);
  };

  const handleDeactivate = async (adminId: string) => {
    if (!confirm('Deactivate this photographer? They will lose access immediately.')) return;
    setActionLoading(adminId);
    try {
      await supabase.from('user_profiles').update({
        subscription_status: 'expired',
        subscription_expires_at: new Date().toISOString(),
      }).eq('id', adminId);
      await loadData();
    } catch (e) { console.error(e); }
    setActionLoading(null);
  };

  const filtered = photographers.filter(p => {
    const matchSearch = !search ||
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.email?.toLowerCase().includes(search.toLowerCase());
    const now = new Date();
    const isActive = p.is_lifetime || (p.subscription_status === 'active' && p.subscription_expires_at && new Date(p.subscription_expires_at) > now);
    if (filter === 'active') return matchSearch && isActive;
    if (filter === 'expired') return matchSearch && !isActive && p.subscription_status !== 'inactive';
    if (filter === 'inactive') return matchSearch && p.subscription_status === 'inactive';
    return matchSearch;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">👑</span>
          <div>
            <h1 className="font-black text-lg text-gold">Super Admin</h1>
            <p className="text-xs text-gray-500">Epix Visuals Platform</p>
          </div>
        </div>
        <button
          onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Sign out
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {[
              { label: 'Photographers', value: stats.totalPhotographers, color: 'text-gold' },
              { label: 'Active', value: stats.activeSubscriptions, color: 'text-green-400' },
              { label: 'Expired', value: stats.expiredSubscriptions, color: 'text-red-400' },
              { label: 'Total Clients', value: stats.totalClients, color: 'text-blue-400' },
              { label: 'Total Galleries', value: stats.totalGalleries, color: 'text-purple-400' },
              { label: 'This Month', value: `KES ${stats.monthlyRevenue.toLocaleString()}`, color: 'text-gold' },
            ].map((s) => (
              <div key={s.label} className="bg-card border border-white/5 rounded-2xl p-4 text-center">
                <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-card border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-gold/50"
          />
          <div className="flex gap-2">
            {(['all', 'active', 'expired', 'inactive'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-colors ${
                  filter === f
                    ? 'bg-gold text-black'
                    : 'bg-card border border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Photographers table */}
        <div className="bg-card border border-white/5 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="text-left px-6 py-4">Photographer</th>
                  <th className="text-left px-4 py-4">Status</th>
                  <th className="text-right px-4 py-4">Clients</th>
                  <th className="text-right px-4 py-4">Galleries</th>
                  <th className="text-right px-4 py-4">Revenue</th>
                  <th className="text-right px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-white">{p.name || 'No name'}</p>
                      <p className="text-gray-500 text-xs">{p.email}</p>
                      {p.phone && <p className="text-gray-600 text-xs">{p.phone}</p>}
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge
                        status={p.subscription_status}
                        expiresAt={p.subscription_expires_at}
                        isLifetime={p.is_lifetime}
                      />
                    </td>
                    <td className="px-4 py-4 text-right text-gray-300">{p.client_count}</td>
                    <td className="px-4 py-4 text-right text-gray-300">{p.gallery_count}</td>
                    <td className="px-4 py-4 text-right text-gold font-semibold">
                      {p.total_revenue > 0 ? `KES ${p.total_revenue.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {!p.is_lifetime && (
                          <>
                            <button
                              onClick={() => handleExtend(p.id, 30)}
                              disabled={actionLoading === p.id}
                              className="px-3 py-1.5 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold rounded-lg hover:bg-green-500/20 transition-colors disabled:opacity-50"
                            >
                              +30 days
                            </button>
                            <button
                              onClick={() => handleDeactivate(p.id)}
                              disabled={actionLoading === p.id}
                              className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50"
                            >
                              Deactivate
                            </button>
                          </>
                        )}
                        {p.is_lifetime && (
                          <span className="text-xs text-gray-600">Lifetime account</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No photographers found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
