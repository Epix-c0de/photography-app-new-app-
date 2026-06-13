'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

type Photographer = {
  id: string; name: string; email: string; phone: string;
  subscription_status: string; subscription_expires_at: string | null;
  is_lifetime: boolean; created_at: string;
  gallery_count: number; client_count: number; total_revenue: number;
  storage_gb?: number; total_photos?: number; avg_photo_size_bytes?: number;
  is_suspended?: boolean; allow_original_download?: boolean;
};

type StorageMetrics = {
  total_photos: number;
  total_storage_bytes: number;
  gallery_count: number;
  avg_photo_size_bytes: number;
};

function StatusBadge({ status, expiresAt, isLifetime, isSuspended }: { status: string; expiresAt: string | null; isLifetime: boolean; isSuspended?: boolean }) {
  if (isSuspended) return <span className="px-2 py-1 rounded-lg text-xs font-bold" style={{ background: 'rgba(255,59,48,0.15)', color: '#FF3B30' }}>⛔ Suspended</span>;
  if (isLifetime) return <span className="px-2 py-1 rounded-lg text-xs font-bold" style={{ background: 'rgba(175,82,222,0.15)', color: '#AF52DE' }}>👑 Lifetime</span>;
  const now = new Date();
  if (status === 'active' && expiresAt && new Date(expiresAt) > now) {
    const days = Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / 86400000);
    return <span className="px-2 py-1 rounded-lg text-xs font-bold" style={{ background: 'rgba(52,199,89,0.15)', color: '#34C759' }}>● Active · {days}d</span>;
  }
  if (status === 'inactive') return <span className="px-2 py-1 rounded-lg text-xs font-bold" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>○ Inactive</span>;
  return <span className="px-2 py-1 rounded-lg text-xs font-bold" style={{ background: 'rgba(255,59,48,0.15)', color: '#FF3B30' }}>✕ Expired</span>;
}

export default function PhotographersPage() {
  const [photographers, setPhotographers] = useState<Photographer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'expired' | 'inactive'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [storageModal, setStorageModal] = useState<{ visible: boolean; photographer: Photographer | null; metrics: StorageMetrics | null }>({ visible: false, photographer: null, metrics: null });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: admins }, { data: galleries }, { data: clients }, { data: subs }] = await Promise.all([
        supabase.from('user_profiles').select('id, name, email, phone, subscription_status, subscription_expires_at, is_lifetime, is_suspended, allow_original_download, created_at').in('role', ['admin', 'super_admin']).order('created_at', { ascending: false }) as any,
        supabase.from('galleries').select('owner_admin_id') as any,
        supabase.from('clients').select('owner_admin_id') as any,
        supabase.from('admin_subscriptions').select('admin_id, amount, status').eq('status', 'success') as any,
      ]);

      const galleryCounts = new Map<string, number>();
      (galleries || []).forEach((g: any) => galleryCounts.set(g.owner_admin_id, (galleryCounts.get(g.owner_admin_id) || 0) + 1));
      const clientCounts = new Map<string, number>();
      (clients || []).forEach((c: any) => clientCounts.set(c.owner_admin_id, (clientCounts.get(c.owner_admin_id) || 0) + 1));
      const revenueCounts = new Map<string, number>();
      (subs || []).forEach((s: any) => revenueCounts.set(s.admin_id, (revenueCounts.get(s.admin_id) || 0) + (s.amount || 0)));

      // Load storage metrics for each photographer
      const photographersWithStorage = await Promise.all((admins || []).map(async (a: any) => {
        const { data: storageData } = await supabase.rpc('get_photographer_storage_metrics', { p_admin_id: a.id });
        const storage = storageData && storageData.length > 0 ? storageData[0] : null;
        return {
          ...a,
          gallery_count: galleryCounts.get(a.id) || 0,
          client_count: clientCounts.get(a.id) || 0,
          total_revenue: revenueCounts.get(a.id) || 0,
          storage_gb: storage ? (storage.total_storage_bytes / 1024 / 1024 / 1024) : 0,
          total_photos: storage?.total_photos || 0,
          avg_photo_size_bytes: storage?.avg_photo_size_bytes || 0,
        };
      }));

      setPhotographers(photographersWithStorage);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

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

  const handleMakeLifetime = async (adminId: string) => {
    if (!confirm('Grant lifetime access to this photographer?')) return;
    setActionLoading(adminId);
    try {
      await supabase.from('user_profiles').update({ is_lifetime: true, subscription_status: 'active', subscription_expires_at: '2099-12-31T23:59:59Z' }).eq('id', adminId);
      await loadData();
    } catch (e) { console.error(e); }
    setActionLoading(null);
  };

  const handleViewStorage = async (photographer: Photographer) => {
    try {
      const { data: storageData } = await supabase.rpc('get_photographer_storage_metrics', { p_admin_id: photographer.id });
      const metrics = storageData && storageData.length > 0 ? storageData[0] : null;
      setStorageModal({ visible: true, photographer, metrics });
    } catch (e) {
      console.error(e);
      alert('Failed to load storage metrics');
    }
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">Photographers</h1>
        <p className="text-gray-400 mt-1">{photographers.length} photographers on the platform</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <input type="text" placeholder="Search photographers..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="bg-[#111118] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500/50 flex-1 max-w-sm" />
        <div className="flex gap-2">
          {(['all', 'active', 'expired', 'inactive'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all"
              style={filter === f
                ? { background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }
                : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#111118] border border-white/5 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="font-bold">Photographers ({filtered.length})</h2>
          {loading && <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'rgba(212,175,55,0.5)', borderTopColor: 'transparent' }} />}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {['Photographer', 'Status', 'Clients', 'Galleries', 'Storage', 'Revenue', 'Joined', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 20px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.015)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '14px 20px' }}>
                    <Link href={`/dashboard/photographers/${p.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.15)' }}>
                        {(p.name || p.email || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-white">{p.name || 'No name'}</p>
                        <p className="text-xs text-gray-500">{p.email}</p>
                      </div>
                    </Link>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <StatusBadge status={p.subscription_status} expiresAt={p.subscription_expires_at} isLifetime={p.is_lifetime} isSuspended={p.is_suspended} />
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{p.client_count}</td>
                  <td style={{ padding: '14px 20px', fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{p.gallery_count}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <button
                      onClick={() => handleViewStorage(p)}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1"
                      style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)', color: '#D4AF37' }}>
                      {p.storage_gb ? `${p.storage_gb.toFixed(2)} GB` : '0 GB'}
                      <span>📊</span>
                    </button>
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: 13, fontWeight: 600, color: p.total_revenue > 0 ? '#D4AF37' : 'rgba(255,255,255,0.2)' }}>
                    {p.total_revenue > 0 ? `KES ${p.total_revenue.toLocaleString()}` : '—'}
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                    {new Date(p.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    {!p.is_lifetime ? (
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleExtend(p.id, 30)} disabled={actionLoading === p.id}
                          className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                          style={{ background: 'rgba(52,199,89,0.1)', border: '1px solid rgba(52,199,89,0.2)', color: '#34C759' }}>
                          +30d
                        </button>
                        <button onClick={() => handleMakeLifetime(p.id)} disabled={actionLoading === p.id}
                          className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                          style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)', color: '#D4AF37' }}>
                          Lifetime
                        </button>
                        <button onClick={() => handleDeactivate(p.id)} disabled={actionLoading === p.id}
                          className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                          style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.2)', color: '#FF3B30' }}>
                          Deactivate
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-600">Lifetime</span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr><td colSpan={8} style={{ padding: '48px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>No photographers found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Storage Details Modal */}
      {storageModal.visible && storageModal.photographer && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50" onClick={() => setStorageModal({ visible: false, photographer: null, metrics: null })}>
          <div className="bg-[#111118] border border-white/10 rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold">{storageModal.photographer.name}</h3>
                <p className="text-sm text-gray-400">Storage Breakdown</p>
              </div>
              <button
                onClick={() => setStorageModal({ visible: false, photographer: null, metrics: null })}
                className="text-gray-400 hover:text-white">
                ✕
              </button>
            </div>

            {storageModal.metrics ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-400 mb-1">Total Storage</p>
                    <p className="text-2xl font-black" style={{ color: '#D4AF37' }}>
                      {(storageModal.metrics.total_storage_bytes / 1024 / 1024 / 1024).toFixed(2)} GB
                    </p>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-400 mb-1">Total Photos</p>
                    <p className="text-2xl font-black text-white">
                      {storageModal.metrics.total_photos.toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-400 mb-1">Galleries</p>
                    <p className="text-2xl font-black text-white">
                      {storageModal.metrics.gallery_count}
                    </p>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-400 mb-1">Avg Photo Size</p>
                    <p className="text-2xl font-black text-white">
                      {(storageModal.metrics.avg_photo_size_bytes / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-lg" style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)' }}>
                  <p className="text-sm font-semibold mb-2" style={{ color: '#D4AF37' }}>Storage Efficiency</p>
                  <p className="text-xs text-gray-400">
                    {storageModal.metrics.total_photos > 0
                      ? `Average ${(storageModal.metrics.total_storage_bytes / storageModal.metrics.total_photos / 1024 / 1024).toFixed(2)} MB per photo`
                      : 'No photos uploaded yet'}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">No storage data available</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
