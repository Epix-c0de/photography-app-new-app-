'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function ClientsPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { loadClients(); }, []);

  const loadClients = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('clients')
      .select('id, name, phone, email, loyalty_level, total_paid, user_id, created_at')
      .eq('owner_admin_id', user.id)
      .order('name');

    // Get gallery counts
    const clientIds = (data || []).map((c: any) => c.id);
    let galleryCounts = new Map<string, number>();
    if (clientIds.length > 0) {
      const { data: galleries } = await supabase
        .from('galleries').select('client_id').in('client_id', clientIds);
      (galleries || []).forEach((g: any) => {
        galleryCounts.set(g.client_id, (galleryCounts.get(g.client_id) || 0) + 1);
      });
    }

    setClients((data || []).map((c: any) => ({ ...c, gallery_count: galleryCounts.get(c.id) || 0 })));
    setLoading(false);
  };

  const filtered = clients.filter((c) =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search) || c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const loyaltyColor = (level: string) => {
    if (level === 'Gold') return 'text-yellow-400 bg-yellow-500/10';
    if (level === 'Silver') return 'text-gray-300 bg-gray-500/10';
    return 'text-orange-400 bg-orange-500/10';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">Clients</h1>
        <p className="text-gray-400 mt-1">{clients.length} total clients</p>
      </div>

      <input
        type="text"
        placeholder="Search by name, phone, or email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-md bg-[#111118] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500/50"
      />

      <div className="bg-[#111118] border border-white/5 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No clients found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-gray-500 text-xs uppercase">
                <th className="text-left px-6 py-3">Client</th>
                <th className="text-left px-4 py-3">Phone</th>
                <th className="text-center px-4 py-3">Galleries</th>
                <th className="text-right px-4 py-3">Total Paid</th>
                <th className="text-center px-4 py-3">Loyalty</th>
                <th className="text-right px-6 py-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-white/5 hover:bg-white/2">
                  <td className="px-6 py-4">
                    <p className="font-semibold">{c.name}</p>
                    {c.email && <p className="text-gray-500 text-xs">{c.email}</p>}
                  </td>
                  <td className="px-4 py-4 text-gray-400">{c.phone || '—'}</td>
                  <td className="px-4 py-4 text-center text-gray-300">{c.gallery_count}</td>
                  <td className="px-4 py-4 text-right text-yellow-400 font-semibold">
                    {c.total_paid > 0 ? `KES ${c.total_paid.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${loyaltyColor(c.loyalty_level || 'Bronze')}`}>
                      {c.loyalty_level || 'Bronze'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-gray-500 text-xs">
                    {new Date(c.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
