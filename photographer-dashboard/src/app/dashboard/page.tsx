'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

type Stats = {
  totalClients: number;
  totalGalleries: number;
  paidGalleries: number;
  unpaidGalleries: number;
  totalRevenue: number;
  revenueThisMonth: number;
  smsBalance: number;
  pendingBookings: number;
  confirmedBookings: number;
};

export default function DashboardOverview() {
  const [stats, setStats] = useState<Stats>({
    totalClients: 0, totalGalleries: 0, paidGalleries: 0, unpaidGalleries: 0,
    totalRevenue: 0, revenueThisMonth: 0, smsBalance: 0, pendingBookings: 0, confirmedBookings: 0,
  });
  const [recentGalleries, setRecentGalleries] = useState<any[]>([]);
  const [recentClients, setRecentClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminName, setAdminName] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [
        { data: profile },
        { count: clientCount },
        { data: galleries },
        { data: recentClients },
        { data: settings },
        { count: pendingBookings },
        { count: confirmedBookings },
        { data: allGalleriesForRevenue },
      ] = await Promise.all([
        supabase.from('user_profiles').select('name').eq('id', user.id).single(),
        supabase.from('clients').select('*', { count: 'exact', head: true }).eq('owner_admin_id', user.id),
        supabase.from('galleries').select('id, name, is_paid, price, created_at, cover_photo_url, access_code, is_locked, client_id').eq('owner_admin_id', user.id).order('created_at', { ascending: false }).limit(6),
        supabase.from('clients').select('id, name, phone, created_at').eq('owner_admin_id', user.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('admin_settings').select('sms_credits').eq('admin_id', user.id).maybeSingle(),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
        supabase.from('galleries').select('id, is_paid, price, created_at').eq('owner_admin_id', user.id),
      ]);

      setAdminName((profile as any)?.name || user.email?.split('@')[0] || 'Photographer');

      const galleryList = galleries || [];
      const allRevenueGalleries = allGalleriesForRevenue || [];
      const paidCount = allRevenueGalleries.filter((g: any) => g.is_paid).length;
      const unpaidCount = allRevenueGalleries.filter((g: any) => !g.is_paid).length;
      const totalRevenue = allRevenueGalleries.filter((g: any) => g.is_paid).reduce((s: number, g: any) => s + (g.price || 0), 0);
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const monthRevenue = allRevenueGalleries.filter((g: any) => g.is_paid && g.created_at >= monthStart).reduce((s: number, g: any) => s + (g.price || 0), 0);

      // Get client names for galleries
      const clientIds = Array.from(new Set(galleryList.map((g: any) => g.client_id).filter(Boolean))) as string[];
      let clientMap = new Map<string, string>();
      if (clientIds.length > 0) {
        const { data: clients } = await supabase.from('clients').select('id, name').in('id', clientIds);
        (clients || []).forEach((c: any) => clientMap.set(c.id, c.name));
      }

      setStats({
        totalClients: clientCount || 0,
        totalGalleries: galleryList.length,
        paidGalleries: paidCount,
        unpaidGalleries: unpaidCount,
        totalRevenue,
        revenueThisMonth: monthRevenue,
        smsBalance: (settings as any)?.sms_credits || 0,
        pendingBookings: pendingBookings || 0,
        confirmedBookings: confirmedBookings || 0,
      });

      setRecentGalleries(galleryList.map((g: any) => ({ ...g, clientName: clientMap.get(g.client_id) || 'Unknown' })));
      setRecentClients(recentClients || []);
      setLoading(false);
    })();
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const quickActions = [
    { label: 'Upload Gallery', icon: '⬆️', href: '/dashboard/upload', color: '#D4AF37' },
    { label: 'Add Client', icon: '👤', href: '/dashboard/clients', color: '#34C759' },
    { label: 'Pending Pay', icon: '💳', href: '/dashboard/galleries', color: '#FF9F0A', badge: stats.unpaidGalleries },
    { label: "Today's Shoots", icon: '📅', href: '/dashboard/bookings', color: '#0A84FF', badge: stats.pendingBookings },
    { label: 'Send Notification', icon: '🔔', href: '/dashboard/notifications', color: '#AF52DE' },
    { label: 'BTS & Posts', icon: '🎬', href: '/dashboard/bts', color: '#FF375F' },
  ];

  const statCards = [
    { label: 'Total Clients', value: stats.totalClients, color: '#D4AF37', icon: '👥', href: '/dashboard/clients' },
    { label: 'Galleries', value: stats.totalGalleries, sub: `${stats.paidGalleries} paid`, color: '#34C759', icon: '🖼️', href: '/dashboard/galleries' },
    { label: 'Total Revenue', value: `KES ${stats.totalRevenue.toLocaleString()}`, color: '#D4AF37', icon: '💰', href: '/dashboard/galleries' },
    { label: 'This Month', value: `KES ${stats.revenueThisMonth.toLocaleString()}`, color: '#34C759', icon: '📈', href: '/dashboard/galleries' },
    { label: 'Pending Pay', value: stats.unpaidGalleries, color: '#FF9F0A', icon: '⏳', href: '/dashboard/galleries' },
    { label: 'SMS Credits', value: stats.smsBalance, color: '#AF52DE', icon: '📱', href: '/dashboard/settings' },
    { label: 'Pending Bookings', value: stats.pendingBookings, color: '#FF9F0A', icon: '📅', href: '/dashboard/bookings' },
    { label: 'Confirmed Shoots', value: stats.confirmedBookings, color: '#0A84FF', icon: '✅', href: '/dashboard/bookings' },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <div style={{ width: 36, height: 36, border: '3px solid rgba(212,175,55,0.3)', borderTopColor: '#D4AF37', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.08) 0%, rgba(13,13,25,0.6) 100%)', border: '1px solid rgba(212,175,55,0.12)', borderRadius: 24, padding: '28px 32px' }}>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>{greeting}</p>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: 'white', letterSpacing: -0.5, marginBottom: 4 }}>{adminName}</h1>
        <p style={{ fontSize: 13, color: '#D4AF37', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Admin Command Center</p>

        {/* Revenue summary */}
        <div style={{ marginTop: 24, background: 'linear-gradient(135deg, #1A1A1A, #0F0F0F)', borderRadius: 20, padding: 24, border: '1px solid rgba(212,175,55,0.18)' }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Total Business Revenue</p>
          <p style={{ fontSize: 42, fontWeight: 900, color: '#D4AF37', letterSpacing: -1, marginBottom: 20 }}>KES {stats.totalRevenue.toLocaleString()}</p>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 20 }} />
          <div style={{ display: 'flex', gap: 32 }}>
            <div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>This Month</p>
              <p style={{ fontSize: 20, fontWeight: 800, color: '#34C759' }}>+KES {stats.revenueThisMonth.toLocaleString()}</p>
            </div>
            <div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Unpaid Galleries</p>
              <p style={{ fontSize: 20, fontWeight: 800, color: '#FF9F0A' }}>{stats.unpaidGalleries}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, marginBottom: 14 }}>Quick Actions</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {quickActions.map((a) => (
            <Link key={a.label} href={a.href} style={{ textDecoration: 'none' }}>
              <div style={{ background: '#161616', borderRadius: 18, padding: '16px 18px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'all 0.15s', position: 'relative' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(212,175,55,0.2)'; (e.currentTarget as HTMLDivElement).style.background = '#1A1A1A'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLDivElement).style.background = '#161616'; }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: `${a.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, position: 'relative' }}>
                  {a.icon}
                  {a.badge !== undefined && a.badge > 0 && (
                    <div style={{ position: 'absolute', top: -4, right: -4, background: '#D4AF37', color: '#080810', fontSize: 9, fontWeight: 800, borderRadius: 8, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                      {a.badge}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>{a.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, marginBottom: 14 }}>Analytics Overview</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {statCards.map((s) => (
            <Link key={s.label} href={s.href} style={{ textDecoration: 'none' }}>
              <div style={{ background: '#111111', borderRadius: 20, padding: 20, border: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(212,175,55,0.15)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, marginBottom: 14 }}>
                  {s.icon}
                </div>
                <p style={{ fontSize: 22, fontWeight: 800, color: s.color, letterSpacing: -0.5 }}>{s.value}</p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginTop: 4 }}>{s.label}</p>
                {s.sub && <p style={{ fontSize: 10, color: '#D4AF37', fontWeight: 700, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.sub}</p>}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Galleries */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>Recent Galleries</p>
          <Link href="/dashboard/galleries" style={{ fontSize: 12, color: '#D4AF37', fontWeight: 700, textDecoration: 'none' }}>View all →</Link>
        </div>
        <div style={{ background: '#111111', borderRadius: 20, border: '1px solid rgba(255,255,255,0.04)', overflow: 'hidden' }}>
          {recentGalleries.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
              No galleries yet.{' '}
              <Link href="/dashboard/upload" style={{ color: '#D4AF37', textDecoration: 'none' }}>Upload your first gallery →</Link>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  {['Gallery', 'Client', 'Access Code', 'Status', 'Created'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '12px 20px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentGalleries.map((g) => (
                  <tr key={g.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.015)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '14px 20px', fontWeight: 600, fontSize: 13, color: 'white' }}>{g.name}</td>
                    <td style={{ padding: '14px 20px', fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{g.clientName}</td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#D4AF37', fontSize: 13, letterSpacing: 1 }}>{g.access_code}</span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: g.is_paid ? 'rgba(52,199,89,0.15)' : 'rgba(255,159,10,0.15)', color: g.is_paid ? '#34C759' : '#FF9F0A' }}>
                        {g.is_paid ? 'Paid' : 'Unpaid'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                      {new Date(g.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Recent Clients */}
      {recentClients.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>Recent Clients</p>
            <Link href="/dashboard/clients" style={{ fontSize: 12, color: '#D4AF37', fontWeight: 700, textDecoration: 'none' }}>View all →</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentClients.map((c) => (
              <Link key={c.id} href={`/dashboard/clients`} style={{ textDecoration: 'none' }}>
                <div style={{ background: '#111111', borderRadius: 16, padding: '14px 18px', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(212,175,55,0.15)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)')}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#D4AF37', flexShrink: 0 }}>
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: 14, color: 'white' }}>{c.name}</p>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{c.phone || 'No phone'}</p>
                  </div>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                    {new Date(c.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
