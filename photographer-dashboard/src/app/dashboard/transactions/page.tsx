'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

type Transaction = {
  id: string;
  phone_number: string;
  amount: number;
  status: 'pending' | 'success' | 'failed' | 'cancelled';
  mpesa_receipt_number: string | null;
  transaction_type: 'stk_push' | 'c2b';
  result_code: number | null;
  created_at: string;
  clients: {
    id: string;
    name: string;
  } | null;
  payment_gateways: {
    shortcode: string | null;
    till_number: string | null;
  } | null;
};

type StatusFilter = 'all' | 'success' | 'pending' | 'failed';

function formatCurrency(amount: number): string {
  return `KES ${amount.toLocaleString()}`;
}

function maskPhone(phone: string): string {
  if (phone.length >= 9) {
    return phone.slice(0, 5) + '***' + phone.slice(-2);
  }
  return phone;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  success: { bg: 'rgba(52,199,89,0.15)', text: '#34C759' },
  pending: { bg: 'rgba(255,159,10,0.15)', text: '#FF9F0A' },
  failed: { bg: 'rgba(255,59,48,0.15)', text: '#FF3B30' },
  cancelled: { bg: 'rgba(142,142,147,0.15)', text: '#8E8E93' },
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const loadTransactions = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const { data: clients } = await supabase
        .from('clients')
        .select('id')
        .eq('owner_admin_id', user.id);

      const clientIds = (clients || []).map((c: any) => c.id);
      if (clientIds.length === 0) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          clients (id, name),
          payment_gateways (shortcode, till_number)
        `)
        .in('client_id', clientIds)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setTransactions((data as any) || []);
    } catch (err) {
      console.error('Error loading transactions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  const stats = useMemo(() => {
    const success = transactions.filter((t) => t.status === 'success');
    const pending = transactions.filter((t) => t.status === 'pending');
    const failed = transactions.filter((t) => t.status === 'failed');
    const totalRevenue = success.reduce((sum, t) => sum + Number(t.amount), 0);
    const successRate = transactions.length > 0
      ? Math.round((success.length / transactions.length) * 100)
      : 0;

    return {
      total: transactions.length,
      success: success.length,
      pending: pending.length,
      failed: failed.length,
      totalRevenue,
      successRate,
    };
  }, [transactions]);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      const matchesSearch =
        t.phone_number.includes(search) ||
        t.mpesa_receipt_number?.toLowerCase().includes(search.toLowerCase()) ||
        t.clients?.name?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === 'all' || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [transactions, search, statusFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">Transactions</h1>
        <p className="text-gray-400 mt-1">View all M-Pesa payments from clients</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
          <p className="text-2xl font-black text-green-400">{formatCurrency(stats.totalRevenue)}</p>
          <p className="text-xs text-gray-400 mt-1">Total Revenue</p>
        </div>
        <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
          <p className="text-2xl font-black text-green-400">{stats.successRate}%</p>
          <p className="text-xs text-gray-400 mt-1">Success Rate</p>
        </div>
        <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
          <p className="text-2xl font-black text-yellow-400">{stats.pending}</p>
          <p className="text-xs text-gray-400 mt-1">Pending</p>
        </div>
        <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
          <p className="text-2xl font-black text-red-400">{stats.failed}</p>
          <p className="text-xs text-gray-400 mt-1">Failed</p>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex gap-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by phone, receipt, or client name..."
          className="flex-1 bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
        />
        <div className="flex gap-2">
          {(['all', 'success', 'pending', 'failed'] as StatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                statusFilter === f
                  ? 'text-black'
                  : 'bg-white/5 text-white hover:bg-white/10'
              }`}
              style={statusFilter === f ? { background: 'linear-gradient(135deg, #D4AF37, #F0D060)' } : {}}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction List */}
      {loading ? (
        <div className="text-center py-20">
          <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: 'rgba(212,175,55,0.6)', borderTopColor: 'transparent' }} />
          <p className="text-sm text-gray-400 mt-4">Loading transactions...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400 text-lg">No transactions found</p>
          <p className="text-gray-500 text-sm mt-1">{search ? 'Try a different search' : 'Transactions will appear here when clients pay'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => {
            const colors = STATUS_COLORS[t.status] || STATUS_COLORS.pending;
            return (
              <div key={t.id} className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/[0.07] transition-colors">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colors.text }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-white truncate">{t.clients?.name || 'Unknown Client'}</p>
                    <p className="font-bold" style={{ color: colors.text }}>{formatCurrency(Number(t.amount))}</p>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-gray-400">{maskPhone(t.phone_number)}</span>
                    <span className="text-xs text-gray-600">·</span>
                    <span className="text-xs text-gray-400">
                      {new Date(t.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {t.mpesa_receipt_number && (
                    <p className="text-xs text-gray-500 mt-1 font-mono">{t.mpesa_receipt_number}</p>
                  )}
                </div>
                <span className="px-3 py-1 rounded-lg text-xs font-bold" style={{ background: colors.bg, color: colors.text }}>
                  {t.status.toUpperCase()}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
