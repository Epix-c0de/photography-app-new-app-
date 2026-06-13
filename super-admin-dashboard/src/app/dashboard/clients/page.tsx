'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type Client = {
  id: string;
  name: string;
  phone: string;
  email: string;
  owner_name: string;
  owner_email: string;
  gallery_count: number;
  created_at: string;
};

export default function AllClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);

  useEffect(() => { loadClients(); }, []);

  const loadClients = async () => {
    setLoading(true);
    try {
      const { data: clientsData, count } = await supabase
        .from('clients')
        .select('id, name, phone, email, owner_admin_id, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(200);

      setTotal(count || 0);

      if (!clientsData?.length) { setClients([]); return; }

      // Get owner names
      const ownerIds = [...new Set(clientsData.map(c => c.owner_admin_id).filter(Boolean))];
      const { data: owners } = await supabase
        .from('user_profiles').select('id, name, email').in('id', ownerIds);
      const ownerMap = new Map((owners || []).map(o => [o.id, o]));

      // Get gallery counts
      const clientIds = clientsData.map(c => c.id);
      const { data: galleries } = await supabase
        .from('galleries').select('client_id').in('client_id', clientIds);
      const galleryCounts = new Map<string, number>();
      (galleries || []).forEach(g => galleryCounts.set(g.client_id, (galleryCounts.get(g.client_id) || 0) + 1));

      setClients(clientsData.map(c => {
        const owner = ownerMap.get(c.owner_admin_id);
        return {
          id: c.id, name: c.name || 'Unknown', phone: c.phone || '', email: c.email || '',
          owner_name: owner?.name || 'Unknown', owner_email: owner?.email || '',
          gallery_count: galleryCounts.get(c.id) || 0,
          created_at: c.created_at,
        };
      }));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const filtered = search.trim()
    ? clients.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.phone.includes(search) ||
        c.email.toLowerCase().includes(search.toLowerCase()) ||
        c.owner_name.toLowerCase().includes(search.toLowerCase())
      )
    : clients;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black">All Clients</h1>
          <p className="text-gray-400 mt-1">{total.toLocaleString()} total clients across all photographers</p>
        </div>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)}
        className="w-full max-w-sm bg-[#111118] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500/50"
        placeholder="Search by name, phone, email, or photographer..." />

      <div className="bg-[#111118] border border-white/5 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="font-bold">Clients ({filtered.length}{filtered.length < total ? ` of ${total}` : ''})</h2>
          {loading && <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'rgba(212,175,55,0.5)', borderTopColor: 'transparent' }} />}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {['Client', 'Phone', 'Galleries', 'Photographer', 'Joined'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 20px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.015)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '14px 20px' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.15)' }}>
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-white">{c.name}</p>
                        {c.email && <p className="text-xs text-gray-500">{c.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{c.phone || '—'}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <span className="px-2 py-1 rounded-lg text-xs font-bold"
                      style={{ background: c.gallery_count > 0 ? 'rgba(52,199,89,0.1)' : 'rgba(255,255,255,0.05)', color: c.gallery_count > 0 ? '#34C759' : 'rgba(255,255,255,0.3)' }}>
                      {c.gallery_count} {c.gallery_count === 1 ? 'gallery' : 'galleries'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <p className="text-sm text-white">{c.owner_name}</p>
                    <p className="text-xs text-gray-500">{c.owner_email}</p>
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                    {new Date(c.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} style={{ padding: '48px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>
                    No clients found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
