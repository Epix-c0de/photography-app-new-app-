'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  confirmed: 'bg-green-500/20 text-green-400',
  completed: 'bg-blue-500/20 text-blue-400',
  cancelled: 'bg-red-500/20 text-red-400',
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => { loadBookings(); }, []);

  const loadBookings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('bookings')
      .select(`*, packages(name, price), user_profiles!bookings_user_id_fkey(name, phone)`)
      .order('date', { ascending: true }) as any;

    setBookings(data || []);
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    setActionLoading(id);
    await supabase.from('bookings').update({ status }).eq('id', id);
    await loadBookings();
    setActionLoading(null);
  };

  const filtered = bookings.filter((b) => filter === 'all' || b.status === filter);

  const counts = {
    all: bookings.length,
    pending: bookings.filter((b) => b.status === 'pending').length,
    confirmed: bookings.filter((b) => b.status === 'confirmed').length,
    completed: bookings.filter((b) => b.status === 'completed').length,
    cancelled: bookings.filter((b) => b.status === 'cancelled').length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">Bookings</h1>
        <p className="text-gray-400 mt-1">{counts.pending} pending · {counts.confirmed} confirmed</p>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'confirmed', 'completed', 'cancelled'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-colors ${
              filter === f ? 'bg-yellow-500 text-black' : 'bg-[#111118] border border-white/10 text-gray-400 hover:text-white'
            }`}>
            {f} ({counts[f as keyof typeof counts]})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No bookings found.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => (
            <div key={b.id} className="bg-[#111118] border border-white/5 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <p className="font-bold">{b.user_profiles?.name || 'Unknown Client'}</p>
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${STATUS_COLORS[b.status] || 'bg-gray-500/20 text-gray-400'}`}>
                      {b.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-gray-400">
                    <div><span className="text-gray-600">Date:</span> {b.date}</div>
                    <div><span className="text-gray-600">Time:</span> {b.time}</div>
                    <div><span className="text-gray-600">Location:</span> {b.location || '—'}</div>
                    <div><span className="text-gray-600">Package:</span> {b.packages?.name || '—'}</div>
                  </div>
                  {b.packages?.price && (
                    <p className="text-yellow-400 font-semibold text-sm mt-2">KES {b.packages.price.toLocaleString()}</p>
                  )}
                  {b.notes && <p className="text-gray-500 text-xs mt-2 italic">{b.notes}</p>}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 min-w-fit">
                  {b.status === 'pending' && (
                    <button onClick={() => updateStatus(b.id, 'confirmed')} disabled={actionLoading === b.id}
                      className="px-3 py-1.5 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold rounded-lg hover:bg-green-500/20 disabled:opacity-50">
                      Confirm
                    </button>
                  )}
                  {b.status === 'confirmed' && (
                    <button onClick={() => updateStatus(b.id, 'completed')} disabled={actionLoading === b.id}
                      className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold rounded-lg hover:bg-blue-500/20 disabled:opacity-50">
                      Complete
                    </button>
                  )}
                  {(b.status === 'pending' || b.status === 'confirmed') && (
                    <button onClick={() => updateStatus(b.id, 'cancelled')} disabled={actionLoading === b.id}
                      className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold rounded-lg hover:bg-red-500/20 disabled:opacity-50">
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
