'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

type StorageMetric = {
  admin_id: string;
  admin_name: string;
  base_storage_mb: number;
  extra_storage_mb: number;
  total_storage_mb: number;
  used_bytes: number;
  used_mb: number;
  usage_percent: number;
  photo_count: number;
  video_count: number;
};

type StorageTier = {
  id: string;
  name: string;
  storage_mb: number;
  price_kes: number;
  is_active: boolean;
  display_order: number;
};

type StoragePurchase = {
  id: string;
  admin_id: string;
  admin_name?: string;
  tier_id: string;
  tier_name?: string;
  storage_mb: number;
  amount_kes: number;
  mpesa_receipt: string | null;
  phone_number: string | null;
  status: string;
  created_at: string;
};

export default function StoragePage() {
  const [metrics, setMetrics] = useState<StorageMetric[]>([]);
  const [tiers, setTiers] = useState<StorageTier[]>([]);
  const [purchases, setPurchases] = useState<StoragePurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'tiers' | 'purchases' | 'allocate'>('overview');
  const [selectedAdmin, setSelectedAdmin] = useState<string>('');
  const [allocating, setAllocating] = useState(false);
  const [showNewTier, setShowNewTier] = useState(false);
  const [newTier, setNewTier] = useState({ name: '', storage_mb: 0, price_kes: 0 });
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [metricsRes, tiersRes, purchasesRes] = await Promise.all([
        supabase.rpc('get_all_storage_metrics'),
        supabase.from('storage_tiers').select('*').order('display_order'),
        supabase.from('storage_purchases').select('*').order('created_at', { ascending: false }).limit(50),
      ]);

      if (metricsRes.data) setMetrics(metricsRes.data as StorageMetric[]);
      if (tiersRes.data) setTiers(tiersRes.data as StorageTier[]);

      // Enrich purchases with admin names
      const purchaseData = (purchasesRes.data || []) as StoragePurchase[];
      const adminIds = [...new Set(purchaseData.map(p => p.admin_id))];
      let adminMap = new Map<string, string>();
      if (adminIds.length > 0) {
        const { data: profiles } = await supabase.from('user_profiles').select('id, name').in('id', adminIds);
        (profiles || []).forEach((p: any) => adminMap.set(p.id, p.name || 'Unknown'));
      }
      setPurchases(purchaseData.map(p => ({
        ...p,
        admin_name: adminMap.get(p.admin_id) || 'Unknown',
      })));
    } catch (e) {
      console.error('Failed to load storage data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAllocate = async (adminId: string, extraMb: number) => {
    setAllocating(true);
    try {
      const { data, error } = await supabase.rpc('allocate_admin_storage', {
        p_admin_id: adminId,
        p_extra_storage_mb: extraMb,
      });
      if (error) throw error;
      if (data?.success) {
        showToast(`Allocated ${extraMb}MB to admin`);
        await loadData();
      } else {
        showToast(data?.error || 'Failed to allocate');
      }
    } catch (e: any) {
      showToast(e.message || 'Failed to allocate');
    } finally {
      setAllocating(false);
    }
  };

  const handleCreateTier = async () => {
    if (!newTier.name || !newTier.storage_mb || !newTier.price_kes) return;
    try {
      const { error } = await supabase.from('storage_tiers').insert({
        name: newTier.name,
        storage_mb: newTier.storage_mb,
        price_kes: newTier.price_kes,
        display_order: tiers.length,
      });
      if (error) throw error;
      showToast('Tier created');
      setShowNewTier(false);
      setNewTier({ name: '', storage_mb: 0, price_kes: 0 });
      await loadData();
    } catch (e: any) {
      showToast(e.message);
    }
  };

  const handleDeleteTier = async (tierId: string) => {
    if (!confirm('Delete this tier?')) return;
    try {
      const { error } = await supabase.from('storage_tiers').delete().eq('id', tierId);
      if (error) throw error;
      showToast('Tier deleted');
      await loadData();
    } catch (e: any) {
      showToast(e.message);
    }
  };

  const filteredMetrics = metrics.filter(m =>
    m.admin_name.toLowerCase().includes(search.toLowerCase())
  );

  const totalStorage = metrics.reduce((s, m) => s + m.total_storage_mb, 0);
  const totalUsed = metrics.reduce((s, m) => s + m.used_bytes, 0);
  const totalExtra = metrics.reduce((s, m) => s + m.extra_storage_mb, 0);

  const formatMB = (mb: number) => {
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)}GB`;
    return `${mb}MB`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)}GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)}MB`;
    return `${(bytes / 1024).toFixed(0)}KB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'rgba(212,175,55,0.5)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}>
          {toast}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-black" style={{ color: '#D4AF37' }}>Cloud Storage Management</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Manage storage allocations, tiers, and purchases for all photographers
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>Total Allocated</p>
          <p className="text-2xl font-black mt-1" style={{ color: '#D4AF37' }}>{formatMB(totalStorage)}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>Total Used</p>
          <p className="text-2xl font-black mt-1" style={{ color: '#F59E0B' }}>{formatBytes(totalUsed)}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>Extra Purchased</p>
          <p className="text-2xl font-black mt-1" style={{ color: '#10B981' }}>{formatMB(totalExtra)}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>Photographers</p>
          <p className="text-2xl font-black mt-1" style={{ color: '#8B5CF6' }}>{metrics.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['overview', 'tiers', 'purchases', 'allocate'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
            style={{
              background: activeTab === tab ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.03)',
              color: activeTab === tab ? '#D4AF37' : 'rgba(255,255,255,0.4)',
              border: `1px solid ${activeTab === tab ? 'rgba(212,175,55,0.3)' : 'rgba(255,255,255,0.06)'}`,
            }}>
            {tab === 'overview' && '📊 Overview'}
            {tab === 'tiers' && '📦 Storage Tiers'}
            {tab === 'purchases' && '💰 Purchases'}
            {tab === 'allocate' && '➕ Allocate'}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Search photographers..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#fff' }}
          />
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>Photographer</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>Base</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>Extra</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>Used</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>Usage</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>Photos</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>Videos</th>
                </tr>
              </thead>
              <tbody>
                {filteredMetrics.map((m) => (
                  <tr key={m.admin_id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <td className="px-4 py-3 font-semibold" style={{ color: '#fff' }}>{m.admin_name}</td>
                    <td className="px-4 py-3" style={{ color: 'rgba(255,255,255,0.6)' }}>{formatMB(m.base_storage_mb)}</td>
                    <td className="px-4 py-3" style={{ color: '#10B981' }}>{m.extra_storage_mb > 0 ? `+${formatMB(m.extra_storage_mb)}` : '—'}</td>
                    <td className="px-4 py-3" style={{ color: 'rgba(255,255,255,0.6)' }}>{formatBytes(m.used_bytes)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                          <div className="h-full rounded-full" style={{
                            width: `${Math.min(m.usage_percent, 100)}%`,
                            background: m.usage_percent > 80 ? '#EF4444' : m.usage_percent > 50 ? '#F59E0B' : '#10B981',
                          }} />
                        </div>
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{m.usage_percent}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'rgba(255,255,255,0.6)' }}>{m.photo_count.toLocaleString()}</td>
                    <td className="px-4 py-3" style={{ color: 'rgba(255,255,255,0.6)' }}>{m.video_count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Storage Tiers Tab */}
      {activeTab === 'tiers' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Define storage tiers that admins can purchase</p>
            <button onClick={() => setShowNewTier(true)}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}>
              + New Tier
            </button>
          </div>

          {showNewTier && (
            <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="grid grid-cols-3 gap-3">
                <input placeholder="Tier name" value={newTier.name} onChange={e => setNewTier({ ...newTier, name: e.target.value })}
                  className="px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                <input placeholder="Storage (MB)" type="number" value={newTier.storage_mb || ''} onChange={e => setNewTier({ ...newTier, storage_mb: parseInt(e.target.value) || 0 })}
                  className="px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                <input placeholder="Price (KES)" type="number" value={newTier.price_kes || ''} onChange={e => setNewTier({ ...newTier, price_kes: parseInt(e.target.value) || 0 })}
                  className="px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreateTier} className="px-4 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: '#D4AF37', color: '#080810' }}>Save</button>
                <button onClick={() => setShowNewTier(false)} className="px-4 py-2 rounded-lg text-sm"
                  style={{ color: 'rgba(255,255,255,0.4)' }}>Cancel</button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-5 gap-4">
            {tiers.map((tier) => (
              <div key={tier.id} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-lg font-black" style={{ color: '#D4AF37' }}>{tier.name}</p>
                <p className="text-2xl font-black mt-2" style={{ color: '#fff' }}>{formatMB(tier.storage_mb)}</p>
                <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>KES {tier.price_kes.toLocaleString()}</p>
                <button onClick={() => handleDeleteTier(tier.id)}
                  className="mt-3 text-xs px-3 py-1 rounded-lg"
                  style={{ color: '#EF4444', background: 'rgba(239,68,68,0.1)' }}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Purchases Tab */}
      {activeTab === 'purchases' && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>Date</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>Photographer</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>Storage</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>Amount</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>M-Pesa</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <td className="px-4 py-3" style={{ color: 'rgba(255,255,255,0.6)' }}>{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: '#fff' }}>{p.admin_name}</td>
                  <td className="px-4 py-3" style={{ color: '#10B981' }}>+{formatMB(p.storage_mb)}</td>
                  <td className="px-4 py-3" style={{ color: '#D4AF37' }}>KES {p.amount_kes.toLocaleString()}</td>
                  <td className="px-4 py-3" style={{ color: 'rgba(255,255,255,0.4)' }}>{p.mpesa_receipt || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded-lg text-xs font-semibold"
                      style={{
                        background: p.status === 'completed' ? 'rgba(16,185,129,0.15)' : p.status === 'pending' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                        color: p.status === 'completed' ? '#10B981' : p.status === 'pending' ? '#F59E0B' : '#EF4444',
                      }}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Allocate Tab */}
      {activeTab === 'allocate' && (
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Manually allocate extra storage to a photographer</p>
          <div className="rounded-xl p-4 space-y-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div>
              <label className="text-xs font-semibold block mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Select Photographer</label>
              <select value={selectedAdmin} onChange={e => setSelectedAdmin(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}>
                <option value="">Choose a photographer...</option>
                {metrics.map(m => (
                  <option key={m.admin_id} value={m.admin_id}>
                    {m.admin_name} — {formatMB(m.used_mb)} / {formatMB(m.total_storage_mb)} used
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-5 gap-3">
              {tiers.filter(t => t.is_active).map(tier => (
                <button key={tier.id} onClick={() => selectedAdmin && handleAllocate(selectedAdmin, tier.storage_mb)}
                  disabled={!selectedAdmin || allocating}
                  className="rounded-xl p-4 text-center transition-colors hover:opacity-80 disabled:opacity-30"
                  style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)' }}>
                  <p className="text-lg font-black" style={{ color: '#D4AF37' }}>{tier.name}</p>
                  <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>KES {tier.price_kes.toLocaleString()}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
