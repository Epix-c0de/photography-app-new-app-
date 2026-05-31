'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function GalleriesPage() {
  const [galleries, setGalleries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => { loadGalleries(); }, []);

  const loadGalleries = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('galleries')
      .select('id, name, access_code, is_paid, is_locked, price, shoot_type, created_at, cover_photo_url, client_id')
      .eq('owner_admin_id', user.id)
      .order('created_at', { ascending: false });

    // Get client names
    const clientIds = [...new Set((data || []).map((g: any) => g.client_id).filter(Boolean))];
    let clientMap = new Map<string, string>();
    if (clientIds.length > 0) {
      const { data: clients } = await supabase.from('clients').select('id, name').in('id', clientIds);
      (clients || []).forEach((c: any) => clientMap.set(c.id, c.name));
    }

    // Get photo counts
    const galleryIds = (data || []).map((g: any) => g.id);
    let photoCounts = new Map<string, number>();
    if (galleryIds.length > 0) {
      const { data: photos } = await supabase.from('gallery_photos').select('gallery_id').in('gallery_id', galleryIds);
      (photos || []).forEach((p: any) => photoCounts.set(p.gallery_id, (photoCounts.get(p.gallery_id) || 0) + 1));
    }

    setGalleries((data || []).map((g: any) => ({
      ...g,
      clientName: clientMap.get(g.client_id) || 'Unknown',
      photoCount: photoCounts.get(g.id) || 0,
    })));
    setLoading(false);
  };

  const toggleLock = async (id: string, currentLocked: boolean) => {
    setActionLoading(id);
    await supabase.from('galleries').update({ is_locked: !currentLocked }).eq('id', id);
    await loadGalleries();
    setActionLoading(null);
  };

  const markPaid = async (id: string) => {
    setActionLoading(id);
    await supabase.from('galleries').update({ is_paid: true, is_locked: false }).eq('id', id);
    await loadGalleries();
    setActionLoading(null);
  };

  const copyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = galleries.filter((g) =>
    !search || g.name?.toLowerCase().includes(search.toLowerCase()) ||
    g.clientName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black">Galleries</h1>
          <p className="text-gray-400 mt-1">{galleries.length} total galleries</p>
        </div>
        <a href="/dashboard/upload"
          className="bg-yellow-500 text-black font-bold px-5 py-2.5 rounded-xl hover:opacity-90 text-sm">
          + Upload New
        </a>
      </div>

      <input type="text" placeholder="Search galleries or clients..."
        value={search} onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-md bg-[#111118] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500/50" />

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((g) => (
            <div key={g.id} className="bg-[#111118] border border-white/5 rounded-2xl overflow-hidden">
              {/* Cover */}
              <div className="h-36 bg-[#0A0A0E] relative">
                {g.cover_photo_url ? (
                  <img src={g.cover_photo_url.startsWith('http') ? g.cover_photo_url : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/client-photos/${g.cover_photo_url}`}
                    className="w-full h-full object-cover" alt="" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl text-gray-700">🖼️</div>
                )}
                <div className="absolute top-2 right-2 flex gap-1">
                  <span className={`px-2 py-1 rounded-lg text-xs font-bold ${g.is_paid ? 'bg-green-500/80 text-white' : 'bg-orange-500/80 text-white'}`}>
                    {g.is_paid ? 'Paid' : 'Unpaid'}
                  </span>
                  <span className={`px-2 py-1 rounded-lg text-xs font-bold ${g.is_locked ? 'bg-red-500/80 text-white' : 'bg-blue-500/80 text-white'}`}>
                    {g.is_locked ? '🔒' : '🔓'}
                  </span>
                </div>
              </div>

              <div className="p-4 space-y-3">
                <div>
                  <p className="font-bold truncate">{g.name}</p>
                  <p className="text-gray-400 text-xs">{g.clientName} · {g.photoCount} photos · {g.shoot_type}</p>
                </div>

                {g.price > 0 && (
                  <p className="text-yellow-400 font-bold text-sm">KES {g.price.toLocaleString()}</p>
                )}

                {/* Access code */}
                <div className="flex items-center gap-2 bg-[#0A0A0E] rounded-xl px-3 py-2">
                  <span className="text-yellow-400 font-mono font-bold text-sm flex-1">{g.access_code}</span>
                  <button onClick={() => copyCode(g.id, g.access_code)}
                    className="text-xs text-gray-400 hover:text-white transition-colors">
                    {copiedId === g.id ? '✅' : '📋'}
                  </button>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button onClick={() => toggleLock(g.id, g.is_locked)} disabled={actionLoading === g.id}
                    className="flex-1 text-xs py-2 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50">
                    {g.is_locked ? '🔓 Unlock' : '🔒 Lock'}
                  </button>
                  {!g.is_paid && (
                    <button onClick={() => markPaid(g.id)} disabled={actionLoading === g.id}
                      className="flex-1 text-xs py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50">
                      ✅ Mark Paid
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-3 text-center py-12 text-gray-500">No galleries found.</div>
          )}
        </div>
      )}
    </div>
  );
}
