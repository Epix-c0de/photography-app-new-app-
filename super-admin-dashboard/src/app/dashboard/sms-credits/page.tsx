'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

type CreditPackage = {
  id: string;
  name: string;
  sms_count: number;
  price: number;
  is_active: boolean;
  created_at: string;
};

type AdminCredits = {
  admin_id: string;
  admin_name: string;
  admin_email: string;
  balance: number;
  total_purchased: number;
  total_used: number;
};

type PurchaseTransaction = {
  id: string;
  admin_id: string;
  admin_name: string;
  package_name: string;
  sms_count: number;
  amount: number;
  status: string;
  mpesa_receipt: string;
  phone_number: string;
  created_at: string;
};

export default function SmsCreditsPage() {
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [adminCredits, setAdminCredits] = useState<AdminCredits[]>([]);
  const [transactions, setTransactions] = useState<PurchaseTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPackage, setEditingPackage] = useState<CreditPackage | null>(null);
  const [showNewPackage, setShowNewPackage] = useState(false);
  const [newPackage, setNewPackage] = useState({ name: '', sms_count: 0, price: 0 });
  const [activeTab, setActiveTab] = useState<'packages' | 'balances' | 'transactions'>('packages');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pkgRes, creditsRes, txRes] = await Promise.all([
        supabase.from('sms_credit_packages').select('*').order('price', { ascending: true }),
        supabase.from('sms_credits').select('*'),
        supabase.from('sms_purchase_transactions').select('*').order('created_at', { ascending: false }).limit(100),
      ]);

      // Enrich credits with admin names
      const adminIds = (creditsRes.data || []).map((c: any) => c.admin_id);
      const txAdminIds = (txRes.data || []).map((t: any) => t.admin_id);
      const allAdminIds = Array.from(new Set([...adminIds, ...txAdminIds]));

      let adminMap = new Map<string, { name: string; email: string }>();
      if (allAdminIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, name, email')
          .in('id', allAdminIds);
        (profiles || []).forEach((p: any) => adminMap.set(p.id, { name: p.name || 'Unknown', email: p.email }));
      }

      setPackages((pkgRes.data || []) as CreditPackage[]);
      setAdminCredits(
        (creditsRes.data || []).map((c: any) => ({
          ...c,
          admin_name: adminMap.get(c.admin_id)?.name || 'Unknown',
          admin_email: adminMap.get(c.admin_id)?.email || '',
        }))
      );
      setTransactions(
        (txRes.data || []).map((t: any) => ({
          ...t,
          admin_name: adminMap.get(t.admin_id)?.name || 'Unknown',
          package_name: packages.find((p) => p.id === t.package_id)?.name || 'Custom',
        }))
      );
    } catch (e) {
      console.error('Failed to load SMS credits data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreatePackage = async () => {
    if (!newPackage.name || newPackage.sms_count <= 0 || newPackage.price <= 0) return;
    try {
      const { error } = await supabase.from('sms_credit_packages').insert({
        name: newPackage.name,
        sms_count: newPackage.sms_count,
        price: newPackage.price,
        is_active: true,
      });
      if (error) throw error;
      setNewPackage({ name: '', sms_count: 0, price: 0 });
      setShowNewPackage(false);
      loadData();
    } catch (e: any) {
      alert('Error: ' + (e.message || 'Failed to create package'));
    }
  };

  const handleUpdatePackage = async () => {
    if (!editingPackage) return;
    try {
      const { error } = await supabase
        .from('sms_credit_packages')
        .update({ name: editingPackage.name, sms_count: editingPackage.sms_count, price: editingPackage.price, is_active: editingPackage.is_active })
        .eq('id', editingPackage.id);
      if (error) throw error;
      setEditingPackage(null);
      loadData();
    } catch (e: any) {
      alert('Error: ' + (e.message || 'Failed to update package'));
    }
  };

  const handleDeletePackage = async (id: string) => {
    if (!confirm('Delete this package? This cannot be undone.')) return;
    try {
      const { error } = await supabase.from('sms_credit_packages').delete().eq('id', id);
      if (error) throw error;
      loadData();
    } catch (e: any) {
      alert('Error: ' + (e.message || 'Failed to delete package'));
    }
  };

  const totalCreditsIssued = adminCredits.reduce((s, c) => s + (c.total_purchased || 0), 0);
  const totalCreditsUsed = adminCredits.reduce((s, c) => s + (c.total_used || 0), 0);
  const totalRevenue = transactions.filter((t) => t.status === 'completed').reduce((s, t) => s + (t.amount || 0), 0);

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
      <div>
        <h1 className="text-3xl font-black">SMS Credits Management</h1>
        <p className="text-gray-400 mt-1">Manage credit packages, view admin balances, and track purchases</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Credits Issued', value: totalCreditsIssued.toLocaleString(), color: '#D4AF37', icon: '📦' },
          { label: 'Total Credits Used', value: totalCreditsUsed.toLocaleString(), color: '#34C759', icon: '📤' },
          { label: 'Total Revenue', value: `KES ${totalRevenue.toLocaleString()}`, color: '#0A84FF', icon: '💰' },
          { label: 'Active Admins', value: adminCredits.filter((c) => c.balance > 0).length.toString(), color: '#AF52DE', icon: '👤' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl p-5 border border-white/5" style={{ background: '#111118' }}>
            <div className="text-2xl mb-3">{s.icon}</div>
            <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
            <p className="text-sm font-semibold text-white mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/5 pb-2">
        {(['packages', 'balances', 'transactions'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
            style={{
              background: activeTab === tab ? 'linear-gradient(135deg, #D4AF37, #F0D060)' : 'rgba(255,255,255,0.05)',
              color: activeTab === tab ? '#080810' : '#9CA3AF',
            }}
          >
            {tab === 'packages' ? '📦 Credit Packages' : tab === 'balances' ? '💳 Admin Balances' : '📋 Transactions'}
          </button>
        ))}
      </div>

      {/* Packages Tab */}
      {activeTab === 'packages' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowNewPackage(!showNewPackage)}
              className="px-4 py-2 rounded-xl text-sm font-bold"
              style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}
            >
              + New Package
            </button>
          </div>

          {showNewPackage && (
            <div className="rounded-2xl p-5 border border-white/5" style={{ background: '#111118' }}>
              <h3 className="font-bold mb-4">Create Credit Package</h3>
              <div className="grid grid-cols-3 gap-4">
                <input
                  placeholder="Package name"
                  value={newPackage.name}
                  onChange={(e) => setNewPackage({ ...newPackage, name: e.target.value })}
                  className="rounded-xl px-4 py-3 text-sm text-white border border-white/10"
                  style={{ background: '#1A1A2E' }}
                />
                <input
                  type="number"
                  placeholder="SMS count"
                  value={newPackage.sms_count || ''}
                  onChange={(e) => setNewPackage({ ...newPackage, sms_count: parseInt(e.target.value) || 0 })}
                  className="rounded-xl px-4 py-3 text-sm text-white border border-white/10"
                  style={{ background: '#1A1A2E' }}
                />
                <input
                  type="number"
                  placeholder="Price (KES)"
                  value={newPackage.price || ''}
                  onChange={(e) => setNewPackage({ ...newPackage, price: parseFloat(e.target.value) || 0 })}
                  className="rounded-xl px-4 py-3 text-sm text-white border border-white/10"
                  style={{ background: '#1A1A2E' }}
                />
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={handleCreatePackage} className="px-4 py-2 rounded-xl text-sm font-bold"
                  style={{ background: '#34C759', color: '#080810' }}>Save Package</button>
                <button onClick={() => setShowNewPackage(false)} className="px-4 py-2 rounded-xl text-sm font-bold"
                  style={{ background: 'rgba(255,255,255,0.05)', color: '#9CA3AF' }}>Cancel</button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {packages.map((pkg) => (
              <div key={pkg.id} className="rounded-2xl p-5 border border-white/5" style={{ background: '#111118' }}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-white">{pkg.name}</h3>
                  <span className="text-xs px-2 py-1 rounded-lg font-bold"
                    style={{ background: pkg.is_active ? 'rgba(52,199,89,0.1)' : 'rgba(255,59,48,0.1)', color: pkg.is_active ? '#34C759' : '#FF3B30' }}>
                    {pkg.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-3xl font-black" style={{ color: '#D4AF37' }}>{pkg.sms_count.toLocaleString()}</p>
                <p className="text-sm text-gray-400 mt-1">SMS credits</p>
                <p className="text-xl font-bold text-white mt-2">KES {pkg.price.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">
                  KES {(pkg.price / pkg.sms_count).toFixed(2)} per SMS
                </p>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setEditingPackage(pkg)}
                    className="flex-1 px-3 py-1.5 rounded-lg text-xs font-bold"
                    style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37' }}
                  >Edit</button>
                  <button
                    onClick={() => handleDeletePackage(pkg.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold"
                    style={{ background: 'rgba(255,59,48,0.1)', color: '#FF3B30' }}
                  >Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Balances Tab */}
      {activeTab === 'balances' && (
        <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: '#111118' }}>
          <div className="px-5 py-4 border-b border-white/5">
            <h2 className="font-bold">Admin Credit Balances</h2>
          </div>
          <div className="divide-y divide-white/5">
            {adminCredits.length === 0 ? (
              <p className="text-center text-gray-500 text-sm py-8">No credit balances yet</p>
            ) : adminCredits.map((c) => (
              <div key={c.admin_id} className="flex items-center gap-4 px-5 py-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37' }}>
                  {c.admin_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{c.admin_name}</p>
                  <p className="text-xs text-gray-500">{c.admin_email}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black" style={{ color: c.balance > 0 ? '#34C759' : '#FF3B30' }}>
                    {c.balance.toLocaleString()} SMS
                  </p>
                  <p className="text-xs text-gray-500">
                    {c.total_purchased.toLocaleString()} purchased · {c.total_used.toLocaleString()} used
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: '#111118' }}>
          <div className="px-5 py-4 border-b border-white/5">
            <h2 className="font-bold">Purchase Transactions</h2>
          </div>
          <div className="divide-y divide-white/5">
            {transactions.length === 0 ? (
              <p className="text-center text-gray-500 text-sm py-8">No transactions yet</p>
            ) : transactions.map((t) => (
              <div key={t.id} className="flex items-center gap-4 px-5 py-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                  style={{ background: t.status === 'completed' ? 'rgba(52,199,89,0.1)' : 'rgba(255,159,10,0.1)', color: t.status === 'completed' ? '#34C759' : '#FF9F0A' }}>
                  {t.status === 'completed' ? '✓' : '⏳'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{t.admin_name}</p>
                  <p className="text-xs text-gray-500">
                    {t.sms_count.toLocaleString()} credits · KES {t.amount.toLocaleString()} · {t.mpesa_receipt || 'No receipt'}
                  </p>
                </div>
                <p className="text-xs text-gray-500 flex-shrink-0">
                  {new Date(t.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Package Modal */}
      {editingPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}
          onClick={() => setEditingPackage(null)}>
          <div className="w-full max-w-md rounded-2xl p-6 border border-white/10" style={{ background: '#111118' }}
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-4">Edit Package</h3>
            <div className="space-y-3">
              <input
                placeholder="Package name"
                value={editingPackage.name}
                onChange={(e) => setEditingPackage({ ...editingPackage, name: e.target.value })}
                className="w-full rounded-xl px-4 py-3 text-sm text-white border border-white/10"
                style={{ background: '#1A1A2E' }}
              />
              <input
                type="number"
                placeholder="SMS count"
                value={editingPackage.sms_count}
                onChange={(e) => setEditingPackage({ ...editingPackage, sms_count: parseInt(e.target.value) || 0 })}
                className="w-full rounded-xl px-4 py-3 text-sm text-white border border-white/10"
                style={{ background: '#1A1A2E' }}
              />
              <input
                type="number"
                placeholder="Price (KES)"
                value={editingPackage.price}
                onChange={(e) => setEditingPackage({ ...editingPackage, price: parseFloat(e.target.value) || 0 })}
                className="w-full rounded-xl px-4 py-3 text-sm text-white border border-white/10"
                style={{ background: '#1A1A2E' }}
              />
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-400">Active:</label>
                <button
                  onClick={() => setEditingPackage({ ...editingPackage, is_active: !editingPackage.is_active })}
                  className="w-12 h-6 rounded-full transition-all relative"
                  style={{ background: editingPackage.is_active ? '#34C759' : '#333' }}
                >
                  <div className="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all"
                    style={{ left: editingPackage.is_active ? '26px' : '2px' }} />
                </button>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={handleUpdatePackage} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}>Save Changes</button>
              <button onClick={() => setEditingPackage(null)} className="px-4 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#9CA3AF' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
