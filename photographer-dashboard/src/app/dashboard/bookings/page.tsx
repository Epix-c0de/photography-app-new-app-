'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

type Booking = {
  id: string;
  date: string;
  time: string;
  location: string;
  status: string;
  notes: string | null;
  user_id: string;
  package_id: string | null;
  packages?: { name: string; price: number; shoot_type: string } | null;
  user_profiles?: { name: string; phone: string } | null;
  clientId?: string;
};

type AvailabilityStatus = 'available' | 'busy' | 'partial';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'rgba(255,159,10,0.15)', text: '#FF9F0A' },
  confirmed: { bg: 'rgba(52,199,89,0.15)', text: '#34C759' },
  completed: { bg: 'rgba(10,132,255,0.15)', text: '#0A84FF' },
  cancelled: { bg: 'rgba(255,59,48,0.15)', text: '#FF3B30' },
  booked: { bg: 'rgba(255,159,10,0.15)', text: '#FF9F0A' },
};

const AVAIL_COLORS: Record<AvailabilityStatus, { bg: string; border: string }> = {
  available: { bg: 'rgba(52,199,89,0.25)', border: '#34C759' },
  busy: { bg: 'rgba(255,59,48,0.25)', border: '#FF3B30' },
  partial: { bg: 'rgba(255,159,10,0.25)', border: '#FF9F0A' },
};

const S = {
  card: { background: 'linear-gradient(135deg, rgba(212,175,55,0.04) 0%, rgba(13,13,25,0.8) 100%)', border: '1px solid rgba(212,175,55,0.1)', borderRadius: 20, padding: '20px 22px', transition: 'all 0.2s' },
  btn: (color: string) => ({ padding: '7px 14px', borderRadius: 10, border: `1px solid ${color}30`, background: `${color}10`, color, fontSize: 12, fontWeight: 700, cursor: 'pointer' }),
  input: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 14px', color: 'white', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' as const },
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarOffset, setCalendarOffset] = useState(0);
  const [availability, setAvailability] = useState<Map<string, AvailabilityStatus>>(new Map());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadBookings = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('bookings')
      .select(`*, packages(name, price), user_profiles!bookings_user_id_fkey(name, phone)`)
      .order('date', { ascending: true }) as any;

    // Map user_id to client_id
    const userIds = [...new Set((data || []).map((b: any) => b.user_id).filter(Boolean))];
    let userToClientMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: clients } = await supabase.from('clients').select('id, user_id').eq('owner_admin_id', user.id).in('user_id', userIds);
      (clients || []).forEach((c: any) => userToClientMap.set(c.user_id, c.id));
    }

    setBookings((data || []).map((b: any) => ({ ...b, clientId: userToClientMap.get(b.user_id) })));
    setLoading(false);
  }, []);

  const loadAvailability = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() + calendarOffset, 1).toISOString().split('T')[0];
    const end = new Date(now.getFullYear(), now.getMonth() + calendarOffset + 2, 0).toISOString().split('T')[0];
    const { data } = await supabase.from('admin_calendar_availability').select('*').eq('admin_id', user.id).gte('date', start).lte('date', end);
    const map = new Map<string, AvailabilityStatus>();
    (data || []).forEach((item: any) => map.set(item.date, item.status));
    setAvailability(map);
  }, [calendarOffset]);

  useEffect(() => { loadBookings(); }, [loadBookings]);
  useEffect(() => { if (showCalendar) loadAvailability(); }, [showCalendar, loadAvailability]);

  const updateStatus = async (id: string, status: string, clientId?: string) => {
    setActionLoading(id);
    await supabase.from('bookings').update({ status }).eq('id', id);
    // Send notification to client
    if (clientId) {
      await supabase.from('notifications').insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        type: 'booking_status_update',
        title: 'Booking Status Updated',
        body: `Your booking status is now ${status.toUpperCase()}.`,
        data: { bookingId: id, status },
        read: false,
      }).catch(() => {});
    }
    await loadBookings();
    setActionLoading(null);
    showToast(`Booking ${status}`);
  };

  const handleReschedule = async () => {
    if (!rescheduleBooking || !rescheduleDate) return;
    setActionLoading(rescheduleBooking.id);
    await supabase.from('bookings').update({ date: rescheduleDate, time: rescheduleTime || rescheduleBooking.time, status: 'confirmed' }).eq('id', rescheduleBooking.id);
    setRescheduleBooking(null);
    await loadBookings();
    setActionLoading(null);
    showToast('Booking rescheduled');
  };

  const setDayStatus = async (dateStr: string, status: AvailabilityStatus) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('admin_calendar_availability').upsert({ admin_id: user.id, date: dateStr, status, updated_at: new Date().toISOString() }, { onConflict: 'admin_id,date' });
    setAvailability(prev => { const next = new Map(prev); next.set(dateStr, status); return next; });
    setSelectedDate(null);
  };

  const filtered = bookings.filter(b => filter === 'all' || b.status === filter);
  const counts = { all: bookings.length, pending: bookings.filter(b => b.status === 'pending' || b.status === 'booked').length, confirmed: bookings.filter(b => b.status === 'confirmed').length, completed: bookings.filter(b => b.status === 'completed').length, cancelled: bookings.filter(b => b.status === 'cancelled').length };

  // Calendar
  const now = new Date();
  const viewDate = new Date(now.getFullYear(), now.getMonth() + calendarOffset, 1);
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
  const monthName = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const calDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calDays.push(d);
  const formatDateStr = (d: number) => `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {toast && (
        <div style={{ position: 'fixed', top: 24, right: 24, background: 'rgba(13,13,25,0.95)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 14, padding: '12px 20px', color: '#D4AF37', fontWeight: 600, fontSize: 14, zIndex: 100, backdropFilter: 'blur(20px)' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: 'white' }}>Bookings</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', marginTop: 4, fontSize: 14 }}>{counts.pending} pending · {counts.confirmed} confirmed</p>
        </div>
        <button onClick={() => setShowCalendar(!showCalendar)}
          style={{ background: showCalendar ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${showCalendar ? 'rgba(212,175,55,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 14, padding: '10px 18px', color: showCalendar ? '#D4AF37' : 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          📅 Availability Calendar
        </button>
      </div>

      {/* Availability Calendar */}
      {showCalendar && (
        <div style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.04) 0%, rgba(13,13,25,0.8) 100%)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 24, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <button onClick={() => setCalendarOffset(p => p - 1)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 20, cursor: 'pointer' }}>‹</button>
            <h3 style={{ fontWeight: 800, fontSize: 16 }}>{monthName}</h3>
            <button onClick={() => setCalendarOffset(p => p + 1)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 20, cursor: 'pointer' }}>›</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={i} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', padding: '4px 0' }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {calDays.map((day, i) => {
              if (!day) return <div key={`e-${i}`} />;
              const dateStr = formatDateStr(day);
              const avail = availability.get(dateStr);
              const isSelected = selectedDate === dateStr;
              return (
                <button key={dateStr} onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  style={{ aspectRatio: '1', borderRadius: 10, border: isSelected ? '2px solid #D4AF37' : `1px solid ${avail ? AVAIL_COLORS[avail].border + '40' : 'rgba(255,255,255,0.06)'}`, background: avail ? AVAIL_COLORS[avail].bg : 'rgba(255,255,255,0.03)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {day}
                </button>
              );
            })}
          </div>
          {selectedDate && (
            <div style={{ marginTop: 16, padding: 16, background: 'rgba(0,0,0,0.3)', borderRadius: 14 }}>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>Set {selectedDate} as:</p>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['available', 'busy', 'partial'] as AvailabilityStatus[]).map((s) => (
                  <button key={s} onClick={() => setDayStatus(selectedDate, s)}
                    style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: `1px solid ${AVAIL_COLORS[s].border}40`, background: AVAIL_COLORS[s].bg, color: AVAIL_COLORS[s].border, fontWeight: 700, fontSize: 13, cursor: 'pointer', textTransform: 'capitalize' as const }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
            {(['available', 'busy', 'partial'] as AvailabilityStatus[]).map((s) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 12, height: 12, borderRadius: 4, background: AVAIL_COLORS[s].bg, border: `1px solid ${AVAIL_COLORS[s].border}` }} />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'capitalize' as const }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
        {(['all', 'pending', 'confirmed', 'completed', 'cancelled'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: '9px 16px', borderRadius: 12, border: filter === f ? '1px solid #D4AF37' : '1px solid rgba(255,255,255,0.08)', background: filter === f ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.03)', color: filter === f ? '#D4AF37' : 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' as const }}>
            {f} ({counts[f as keyof typeof counts] ?? bookings.length})
          </button>
        ))}
      </div>

      {/* Bookings list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.3)' }}>Loading bookings...</div>
      ) : filtered.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>No bookings found.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((b) => {
            const sc = STATUS_COLORS[b.status] || STATUS_COLORS.pending;
            return (
              <div key={b.id} style={S.card}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(212,175,55,0.2)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(212,175,55,0.1)')}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#D4AF37', flexShrink: 0 }}>
                        {(b.user_profiles?.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontWeight: 800, fontSize: 15, color: 'white' }}>{b.user_profiles?.name || 'Unknown Client'}</p>
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{b.user_profiles?.phone || 'No phone'}</p>
                      </div>
                      <span style={{ padding: '4px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700, background: sc.bg, color: sc.text, marginLeft: 'auto' }}>
                        {b.status}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
                      {[
                        { label: 'Date', value: b.date },
                        { label: 'Time', value: b.time },
                        { label: 'Location', value: b.location || '—' },
                        { label: 'Package', value: b.packages?.name || '—' },
                      ].map((item) => (
                        <div key={item.label}>
                          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 2 }}>{item.label}</p>
                          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{item.value}</p>
                        </div>
                      ))}
                    </div>

                    {b.packages?.price && (
                      <p style={{ fontSize: 14, fontWeight: 800, color: '#D4AF37', marginBottom: 8 }}>KES {b.packages.price.toLocaleString()}</p>
                    )}
                    {b.notes && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' as const }}>{b.notes}</p>}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 120 }}>
                    {(b.status === 'pending' || b.status === 'booked') && (
                      <button onClick={() => updateStatus(b.id, 'confirmed', b.clientId)} disabled={actionLoading === b.id}
                        style={{ ...S.btn('#34C759'), textAlign: 'center' as const }}>✓ Confirm</button>
                    )}
                    {b.status === 'confirmed' && (
                      <button onClick={() => updateStatus(b.id, 'completed', b.clientId)} disabled={actionLoading === b.id}
                        style={{ ...S.btn('#0A84FF'), textAlign: 'center' as const }}>✓ Complete</button>
                    )}
                    {(b.status === 'pending' || b.status === 'confirmed' || b.status === 'booked') && (
                      <>
                        <button onClick={() => { setRescheduleBooking(b); setRescheduleDate(b.date); setRescheduleTime(b.time); }}
                          style={{ ...S.btn('#D4AF37'), textAlign: 'center' as const }}>↺ Reschedule</button>
                        <button onClick={() => updateStatus(b.id, 'cancelled', b.clientId)} disabled={actionLoading === b.id}
                          style={{ ...S.btn('#FF3B30'), textAlign: 'center' as const }}>✕ Cancel</button>
                      </>
                    )}
                    {b.status === 'cancelled' && (
                      <button onClick={() => updateStatus(b.id, 'pending', b.clientId)} disabled={actionLoading === b.id}
                        style={{ ...S.btn('#D4AF37'), textAlign: 'center' as const }}>↺ Re-open</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reschedule modal */}
      {rescheduleBooking && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#13131F', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 24, padding: 32, maxWidth: 400, width: '90%' }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Reschedule Booking</h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 24 }}>{rescheduleBooking.user_profiles?.name}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 6 }}>New Date</label>
                <input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} style={S.input} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 6 }}>New Time</label>
                <input type="time" value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} style={S.input} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button onClick={() => setRescheduleBooking(null)}
                style={{ flex: 1, padding: 14, borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.6)', fontWeight: 700, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleReschedule}
                style={{ flex: 1, padding: 14, borderRadius: 14, border: 'none', background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810', fontWeight: 700, cursor: 'pointer' }}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
