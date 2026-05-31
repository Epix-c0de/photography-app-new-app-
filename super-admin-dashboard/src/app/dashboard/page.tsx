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

function StatusBadge({ status, expiresAt, isLifetime }: { status: string; expiresAt: string | null; isLifetime: boolean }) {
  if (isLifetime) return <span className="badge badge-purple">👑 Lifetime</span>;
  const now = new Date();
  if (status === 'active' && expiresAt && new Date(expiresAt) > now) {
    const days = Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / 86400000);
    return <span className="badge badge-green">● Active · {days}d</span>;
  }
  if (status === 'inactive') return <span className="badge badge-gray">○ Inactive</span>;
  return <span className="badge badge-red">✕ Expired</span>;
}

export default function SuperAdminDashboard() {
  const router = useRouter();
  const [photographers, setPhotographers] = useState<Photographer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'expired' | 'inactive'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [platformStats, setPlatformStats] = useState({
    totalPhotographers: 0,
    activeNow: 0,
    expiringSoon: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
    totalClients: 0,
    totalGalleries: 0,
    totalPhotos: 0,
  });

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: profile } = await supabase
        .from('user_profiles').select('role').eq('id', user.id).single() as any;
      if (profile?.role !== 'super_admin') { router.push('/login'); return; }

      const [
        { data: admins },
        { data: galleries },
        { data: clients },
        { data: subs },
        { count: photoCount },
      ] = await Promise.all([
        supabase.from('user_profiles').select('id, name, email, phone, subscription_status, subscription_expires_at, is_lifetime, created_at').in('role', ['admin', 'super_admin']).order('created_at', { ascending: false }) as any,
        supabase.from('galleries').select('owner_admin_id') as any,
        supabase.from('clients').select('owner_admin_id') as any,
        supabase.from('admin_subscriptions').select('admin_id, amount, status, created_at').eq('status', 'success') as any,
        supabase.from('gallery_photos').select('*', { count: 'exact', head: true }),
      ]);

      const galleryCounts = new Map<string, number>();
      (galleries || []).forEach((g: any) => galleryCounts.set(g.owner_admin_id, (galleryCounts.get(g.owner_admin_id) || 0) + 1));

      const clientCounts = new Map<string, number>();
      (clients || []).forEach((c: any) => clientCounts.set(c.owner_admin_id, (clientCounts.get(c.owner_admin_id) || 0) + 1));

      const revenueCounts = new Map<string, number>();
      (subs || []).forEach((s: any) => revenueCounts.set(s.admin_id, (revenueCounts.get(s.admin_id) || 0) + (s.amount || 0)));

      const enriched: Photographer[] = (admins || []).map((a: any) => ({
        ...a,
        gallery_count: galleryCounts.get(a.id) || 0,
        client_count: clientCounts.get(a.id) || 0,
        total_revenue: revenueCounts.get(a.id) || 0,
      }));

      setPhotographers(enriched);

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const activeNow = enriched.filter(p => p.is_lifetime || (p.subscription_status === 'active' && p.subscription_expires_at && new Date(p.subscription_expires_at) > now)).length;
      const expiringSoon = enriched.filter(p => !p.is_lifetime && p.subscription_expires_at && new Date(p.subscription_expires_at) > now && Math.ceil((new Date(p.subscription_expires_at).getTime() - now.getTime()) / 86400000) <= 7).length;
      const totalRevenue = (subs || []).reduce((s: number, r: any) => s + (r.amount || 0), 0);
      const monthRevenue = (subs || []).filter((r: any) => r.created_at >= monthStart).reduce((s: number, r: any) => s + (r.amount || 0), 0);

      setPlatformStats({
        totalPhotographers: enriched.length,
        activeNow,
        expiringSoon,
        totalRevenue,
        monthlyRevenue: monthRevenue,
        totalClients: (clients || []).length,
        totalGalleries: (galleries || []).length,
        totalPhotos: photoCount || 0,
      });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleExtend = async (adminId: string, days: number) => {
    setActionLoading(adminId);
    try {
      const p = photographers.find(p => p.id === adminId);
      const base = p?.subscription_expires_at && new Date(p.subscription_expires_at) > new Date()
        ? new Date(p.subscription_expires_at) : new Date();
      base.setDate(base.getDate() + days);
      await supabase.from('user_profiles').update({ subscription_status: 'active', subscription_expires_at: base.toISOString() }).eq('id', adminId);
      await loadData();
    } catch (e) { console.error(e); }
    setActionLoading(null);
  };

  const handleDeactivate = async (adminId: string) => {
    if (!confirm('Deactivate this photographer? They will lose access immediately.')) return;
    setActionLoading(adminId);
    try {
      await supabase.from('user_profiles').update({ subscription_status: 'expired', subscription_expires_at: new Date().toISOString() }).eq('id', adminId);
      await loadData();
    } catch (e) { console.error(e); }
    setActionLoading(null);
  };

  const filtered = photographers.filter(p => {
    const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.email?.toLowerCase().includes(search.toLowerCase());
    const now = new Date();
    const isActive = p.is_lifetime || (p.subscription_status === 'active' && p.subscription_expires_at && new Date(p.subscription_expires_at) > now);
    if (filter === 'active') return matchSearch && isActive;
    if (filter === 'expired') return matchSearch && !isActive && p.subscription_status !== 'inactive';
    if (filter === 'inactive') return matchSearch && p.subscription_status === 'inactive';
    return matchSearch;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080810' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'rgba(212,175,55,0.5)', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading platform data...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Photographers', value: platformStats.totalPhotographers, sub: 'on platform', color: '#D4AF37', icon: '📸' },
    { label: 'Active Subscriptions', value: platformStats.activeNow, sub: 'paying monthly', color: '#34C759', icon: '✅' },
    { label: 'Expiring Soon', value: platformStats.expiringSoon, sub: 'within 7 days', color: '#FF9F0A', icon: '⚠️' },
    { label: 'Total Revenue', value: `KES ${platformStats.totalRevenue.toLocaleString()}`, sub: 'all time', color: '#D4AF37', icon: '💰' },
    { label: 'This Month', value: `KES ${platformStats.monthlyRevenue.toLocaleString()}`, sub: 'subscription revenue', color: '#34C759', icon: '📈' },
    { label: 'Total Clients', value: platformStats.totalClients, sub: 'across all studios', color: '#0A84FF', icon: '👥' },
    { label: 'Total Galleries', value: platformStats.totalGalleries, sub: 'delivered', color: '#AF52DE', icon: '🖼️' },
    { label: 'Total Photos', value: platformStats.totalPhotos.toLocaleString(), sub: 'in storage', color: '#FF375F', icon: '📷' },
  ];

  return (
    <div className="min-h-screen" style={{ background: '#080810' }}>
      {/* Header */}
      <header style={{ background: 'rgba(15,15,26,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm"
              style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}>E</div>
            <div>
              <p className="font-black text-sm gold-text">Super Admin</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Epix Visuals Platform Control</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="badge badge-gold">👑 Super Admin</span>
            <button onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }}
              className="text-sm px-4 py-2 rounded-xl transition-colors"
              style={{ color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8 fade-in">
        {/* Page title */}
        <div>
          <h1 className="text-3xl font-black">Platform Dashboard</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', marginTop: 4, fontSize: 14 }}>
            {new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((s, i) => (
            <div key={s.label} className="premium-card p-5" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="text-2xl mb-3">{s.icon}</div>
              <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
              <p className="text-sm font-semibold text-white mt-1">{s.label}</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Revenue note */}
        <div className="premium-card p-5 flex items-start gap-4">
          <div className="text-2xl">💡</div>
          <div>
            <p className="font-bold text-sm" style={{ color: '#D4AF37' }}>How subscription revenue works</p>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
              All KES 500/month payments go directly to <strong className="text-white">your M-Pesa number</strong> via Daraja API.
              The <code className="px-1 py-0.5 rounded text-xs" style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37' }}>admin_subscriptions</code> table
              records every transaction. Configure your M-Pesa shortcode in Supabase secrets:
              <code className="ml-1 px-1 py-0.5 rounded text-xs" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)' }}>MPESA_SHORTCODE</code>,
              <code className="ml-1 px-1 py-0.5 rounded text-xs" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)' }}>MPESA_PASSKEY</code>,
              <code className="ml-1 px-1 py-0.5 rounded text-xs" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)' }}>MPESA_CONSUMER_KEY</code>,
              <code className="ml-1 px-1 py-0.5 rounded text-xs" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)' }}>MPESA_CONSUMER_SECRET</code>.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input type="text" placeholder="Search photographers..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="input-premium flex-1 max-w-sm" />
          <div className="flex gap-2">
            {(['all', 'active', 'expired', 'inactive'] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all ${filter === f ? 'btn-gold' : ''}`}
                style={filter !== f ? { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' } : {}}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Photographers table */}
        <div className="premium-card overflow-hidden">
          <div className="px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            <h2 className="font-bold">Photographers ({filtered.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  {['Photographer', 'Status', 'Clients', 'Galleries', 'Revenue', 'Joined', 'Actions'].map((h) => (
                    <th key={h} style={{ textAlign: h === 'Actions' || h === 'Clients' || h === 'Galleries' || h === 'Revenue' ? 'right' : 'left', padding: '12px 20px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.015)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '14px 20px' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.15)' }}>
                          {(p.name || p.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-white">{p.name || 'No name'}</p>
                          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{p.email}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <StatusBadge status={p.subscription_status} expiresAt={p.subscription_expires_at} isLifetime={p.is_lifetime} />
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right', color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{p.client_count}</td>
                    <td style={{ padding: '14px 20px', textAlign: 'right', color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{p.gallery_count}</td>
                    <td style={{ padding: '14px 20px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: p.total_revenue > 0 ? '#D4AF37' : 'rgba(255,255,255,0.2)' }}>
                      {p.total_revenue > 0 ? `KES ${p.total_revenue.toLocaleString()}` : '—'}
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                      {new Date(p.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      {!p.is_lifetime && (
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleExtend(p.id, 30)} disabled={actionLoading === p.id}
                            className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
                            style={{ background: 'rgba(52,199,89,0.1)', border: '1px solid rgba(52,199,89,0.2)', color: '#34C759' }}>
                            +30d
                          </button>
                          <button onClick={() => handleDeactivate(p.id)} disabled={actionLoading === p.id}
                            className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
                            style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.2)', color: '#FF3B30' }}>
                            Deactivate
                          </button>
                        </div>
                      )}
                      {p.is_lifetime && (
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>Lifetime</span>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '48px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>
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
