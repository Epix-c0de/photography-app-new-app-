'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus,
  Clock, MapPin, User, Loader2, Trash2, Edit, X, Check, Users, AlertTriangle
} from 'lucide-react';
import { getHolidaysForYear, getHolidayColor, formatHolidayDate, KENYAN_HOLIDAYS } from '@/lib/kenyan-holidays';

type Event = {
  id: string;
  title: string;
  event_type: string;
  event_date: string;
  event_time: string | null;
  end_time: string | null;
  location: string | null;
  notes: string | null;
  status: string;
  clientName?: string;
  client_id?: string;
  is_busy?: boolean;
};

type CalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: Event[];
  holidays: Array<{ name: string; type: string; description?: string }>;
};

type Client = {
  id: string;
  user_id: string | null;
  name: string;
  phone: string;
};

const EVENT_TYPES = [
  { value: 'wedding', label: 'Wedding', color: '#FF6B6B' },
  { value: 'portrait', label: 'Portrait', color: '#4ECDC4' },
  { value: 'corporate', label: 'Corporate', color: '#45B7D1' },
  { value: 'event', label: 'Event', color: '#96CEB4' },
  { value: 'graduation', label: 'Graduation', color: '#FFEAA7' },
  { value: 'other', label: 'Other', color: '#DDA0DD' },
];

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState('wedding');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formClientId, setFormClientId] = useState('');
  const [formSelectedClients, setFormSelectedClients] = useState<string[]>([]);
  const [formIsBusy, setFormIsBusy] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [busyDates, setBusyDates] = useState<Set<string>>(new Set());

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const loadEvents = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;

    const { data } = await supabase.rpc('get_calendar_events', {
      p_photographer_id: user.id,
      p_year: year,
      p_month: month,
    });

    const loadedEvents = (data || []).map((e: any) => ({
      ...e,
      clientName: e.client_name || 'No Client',
      is_busy: e.is_busy !== false,
    }));
    setEvents(loadedEvents);

    // Build busy dates set
    const busy = new Set<string>();
    loadedEvents.filter((e: Event) => e.is_busy && e.status === 'scheduled').forEach((e: Event) => {
      busy.add(e.event_date);
    });
    setBusyDates(busy);
    setLoading(false);
  }, [currentDate]);

  const loadClients = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('clients')
      .select('id, user_id, name, phone')
      .eq('owner_admin_id', user.id)
      .order('name');

    setClients(data || []);
  }, []);

  useEffect(() => {
    loadEvents();
    loadClients();
  }, [loadEvents, loadClients]);

  const getDaysInMonth = (date: Date): CalendarDay[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: CalendarDay[] = [];
    const today = new Date();
    const holidays = getHolidaysForYear(year);

    for (let i = 0; i < 42; i++) {
      const currentDay = new Date(startDate);
      currentDay.setDate(startDate.getDate() + i);

      const dayEvents = events.filter(e => {
        const eventDate = new Date(e.event_date);
        return eventDate.getDate() === currentDay.getDate() &&
               eventDate.getMonth() === currentDay.getMonth() &&
               eventDate.getFullYear() === currentDay.getFullYear();
      });

      const dayHolidays = holidays.filter(h => {
        return h.date.getDate() === currentDay.getDate() &&
               h.date.getMonth() === currentDay.getMonth();
      });

      days.push({
        date: currentDay,
        isCurrentMonth: currentDay.getMonth() === month,
        isToday: currentDay.toDateString() === today.toDateString(),
        events: dayEvents,
        holidays: dayHolidays,
      });
    }

    return days;
  };

  const handlePrevMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentDate(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentDate(newDate);
  };

  const handleDayClick = (day: CalendarDay) => {
    setSelectedDate(day.date);
    if (day.events.length === 0 && day.holidays.length === 0) {
      setFormDate(day.date.toISOString().split('T')[0]);
      setShowEventModal(true);
    }
  };

  const handleAddEvent = () => {
    setEditingEvent(null);
    setFormTitle('');
    setFormType('wedding');
    setFormDate(selectedDate ? selectedDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    setFormTime('');
    setFormLocation('');
    setFormNotes('');
    setFormClientId('');
    setFormSelectedClients([]);
    setFormIsBusy(true);
    setShowEventModal(true);
  };

  const handleEditEvent = async (event: Event) => {
    setEditingEvent(event);
    setFormTitle(event.title);
    setFormType(event.event_type);
    setFormDate(event.event_date);
    setFormTime(event.event_time || '');
    setFormLocation(event.location || '');
    setFormNotes(event.notes || '');
    setFormClientId(event.client_id || '');
    setFormIsBusy(event.is_busy !== false);

    // Load assigned clients
    const { data: assigned } = await supabase
      .from('event_clients')
      .select('client_id')
      .eq('event_id', event.id);
    setFormSelectedClients((assigned || []).map((a: any) => a.client_id));

    setShowEventModal(true);
  };

  const toggleClientSelection = (userId: string) => {
    setFormSelectedClients(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const sendEventNotifications = async (eventId: string, eventDate: string, eventTitle: string, userIds: string[]) => {
    // Send notifications to all selected clients
    const notifications = userIds.map(uid => ({
      user_id: uid,
      type: 'event',
      title: `New Booking: ${eventTitle}`,
      body: `You have a shoot scheduled for ${new Date(eventDate).toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
      data: { event_id: eventId },
    }));

    if (notifications.length > 0) {
      await supabase.from('notifications').insert(notifications);
    }
  };

  const handleSaveEvent = async () => {
    if (!formTitle.trim()) { showToast('Title is required'); return; }
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check for busy date conflict (only when creating new events)
      if (!editingEvent && busyDates.has(formDate)) {
        if (!confirm('This date already has a booked event. Create anyway?')) {
          setSaving(false);
          return;
        }
      }

      const eventData = {
        photographer_id: user.id,
        title: formTitle,
        event_type: formType,
        event_date: formDate,
        event_time: formTime || null,
        location: formLocation || null,
        notes: formNotes || null,
        client_id: formClientId || null,
        is_busy: formIsBusy,
        status: 'scheduled',
      };

      let eventId: string;

      if (editingEvent) {
        await supabase.from('events').update(eventData).eq('id', editingEvent.id);
        eventId = editingEvent.id;
        showToast('Event updated!');
      } else {
        const { data: newEvent } = await supabase.from('events').insert(eventData).select('id').single();
        eventId = newEvent?.id || '';
        showToast('Event created!');
      }

      // Save event_clients junction
      if (eventId) {
        // Delete existing assignments
        await supabase.from('event_clients').delete().eq('event_id', eventId);

        // Insert new assignments
        const allUserIds = [...new Set([...formSelectedClients, formClientId].filter(Boolean))];
        if (allUserIds.length > 0) {
          const assignments = allUserIds.map(uid => ({
            event_id: eventId,
            client_id: uid,
            notified: false,
          }));
          await supabase.from('event_clients').insert(assignments);

          // Send notifications
          await sendEventNotifications(eventId, formDate, formTitle, allUserIds);
        }
      }

      setShowEventModal(false);
      loadEvents();
    } catch (e: any) {
      showToast('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Delete this event?')) return;
    await supabase.from('events').delete().eq('id', eventId);
    showToast('Event deleted!');
    loadEvents();
  };

  const getEventTypeColor = (type: string) => {
    return EVENT_TYPES.find(t => t.value === type)?.color || '#8E8E93';
  };

  const days = getDaysInMonth(currentDate);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const scheduledEvents = events.filter(e => e.status === 'scheduled');
  const busyDaysCount = busyDates.size;
  const thisMonthEvents = events.length;

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 rounded-xl px-5 py-3 text-sm font-bold z-50" style={{ background: '#111118', border: '1px solid rgba(212,175,55,0.3)', color: '#D4AF37', backdropFilter: 'blur(20px)' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black">Calendar</h1>
          <p className="text-gray-400 mt-1">Manage your photography schedule</p>
        </div>
        <button onClick={handleAddEvent}
          className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold"
          style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}>
          <Plus size={18} /> Add Event
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Events', value: thisMonthEvents.toString(), color: '#D4AF37', icon: '📅' },
          { label: 'Scheduled', value: scheduledEvents.length.toString(), color: '#3B82F6', icon: '📌' },
          { label: 'Busy Days', value: busyDaysCount.toString(), color: '#F43F5E', icon: '🚫' },
          { label: 'This Month', value: currentDate.toLocaleDateString('en-KE', { month: 'short' }), color: '#10B981', icon: '📆' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl p-5 border border-white/5" style={{ background: '#111118' }}>
            <div className="text-2xl mb-3">{s.icon}</div>
            <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
            <p className="text-sm font-semibold text-white mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Calendar Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={handlePrevMonth}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}>
          <ChevronLeft size={18} /> Prev
        </button>
        <h2 className="text-xl font-bold text-white">
          {currentDate.toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })}
        </h2>
        <button onClick={handleNextMonth}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}>
          Next <ChevronRight size={18} />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: '#111118' }}>
        <div className="grid grid-cols-7 border-b border-white/5">
          {weekDays.map(day => (
            <div key={day} className="py-3 text-center text-sm font-bold text-gray-400">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, index) => {
            const isBusy = busyDates.has(day.date.toISOString().split('T')[0]);
            return (
              <div
                key={index}
                onClick={() => handleDayClick(day)}
                className="min-h-[100px] p-2 cursor-pointer transition-colors relative"
                style={{
                  borderRight: (index + 1) % 7 !== 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  borderBottom: index < 35 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  background: day.isToday ? 'rgba(212,175,55,0.1)' : isBusy ? 'rgba(244,63,94,0.05)' : 'transparent',
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium" style={{ color: day.isCurrentMonth ? (day.isToday ? '#D4AF37' : 'white') : 'rgba(255,255,255,0.2)' }}>
                    {day.date.getDate()}
                  </span>
                  {isBusy && day.isCurrentMonth && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(244,63,94,0.2)', color: '#F43F5E' }}>BUSY</span>
                  )}
                </div>
                {day.events.slice(0, 2).map((event) => (
                  <div key={event.id}
                    onClick={(e) => { e.stopPropagation(); handleEditEvent(event); }}
                    className="px-1.5 py-0.5 rounded text-[11px] mb-0.5 truncate cursor-pointer"
                    style={{ background: `${getEventTypeColor(event.event_type)}30`, borderLeft: `3px solid ${getEventTypeColor(event.event_type)}`, color: getEventTypeColor(event.event_type) }}>
                    {event.title}
                  </div>
                ))}
                {day.events.length > 2 && (
                  <div className="text-[10px] text-gray-500">+{day.events.length - 2} more</div>
                )}
                {day.holidays.slice(0, 1).map((holiday, i) => (
                  <div key={i} className="px-1.5 py-0.5 rounded text-[10px] mt-0.5"
                    style={{ background: `${getHolidayColor(holiday.type)}20`, color: getHolidayColor(holiday.type) }}>
                    {holiday.name}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Event Types Legend */}
      <div className="flex flex-wrap gap-3">
        {EVENT_TYPES.map((t) => (
          <div key={t.value} className="flex items-center gap-2 text-xs text-gray-400">
            <div className="w-3 h-3 rounded" style={{ background: t.color }} />
            {t.label}
          </div>
        ))}
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <div className="w-3 h-3 rounded" style={{ background: '#F43F5E' }} />
          Busy Day
        </div>
      </div>

      {/* Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}
          onClick={() => setShowEventModal(false)}>
          <div className="w-full max-w-lg rounded-2xl p-6 border border-white/10 max-h-[90vh] overflow-y-auto" style={{ background: '#111118' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">{editingEvent ? 'Edit Event' : 'New Event'}</h3>
              <button onClick={() => setShowEventModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Event Title *</label>
                <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm text-white border border-white/10 focus:outline-none focus:border-[#D4AF37]/50"
                  style={{ background: '#1A1A2E' }} placeholder="e.g., Smith Wedding" />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Event Type</label>
                <div className="flex flex-wrap gap-2">
                  {EVENT_TYPES.map((t) => (
                    <button key={t.value} onClick={() => setFormType(t.value)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                      style={{ background: formType === t.value ? t.color : 'rgba(255,255,255,0.05)', color: formType === t.value ? '#080810' : '#9CA3AF' }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Date *</label>
                  <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)}
                    className="w-full rounded-xl px-4 py-3 text-sm text-white border border-white/10 focus:outline-none"
                    style={{ background: '#1A1A2E' }} />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Time</label>
                  <input type="time" value={formTime} onChange={(e) => setFormTime(e.target.value)}
                    className="w-full rounded-xl px-4 py-3 text-sm text-white border border-white/10 focus:outline-none"
                    style={{ background: '#1A1A2E' }} />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Location</label>
                <input value={formLocation} onChange={(e) => setFormLocation(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm text-white border border-white/10 focus:outline-none"
                  style={{ background: '#1A1A2E' }} placeholder="e.g., Nairobi, Kenya" />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Notes</label>
                <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={2}
                  className="w-full rounded-xl px-4 py-3 text-sm text-white border border-white/10 focus:outline-none resize-none"
                  style={{ background: '#1A1A2E' }} placeholder="Additional notes..." />
              </div>

              {/* Primary Client */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Primary Client</label>
                <select value={formClientId} onChange={(e) => setFormClientId(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm text-white border border-white/10 focus:outline-none"
                  style={{ background: '#1A1A2E' }}>
                  <option value="">No client</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.user_id || c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Batch Client Selection */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  <Users size={14} className="inline mr-1" /> Assign to Clients ({formSelectedClients.length} selected)
                </label>
                <div className="max-h-40 overflow-y-auto rounded-xl border border-white/10 p-2 space-y-1" style={{ background: '#1A1A2E' }}>
                  {clients.length === 0 ? (
                    <p className="text-gray-500 text-xs text-center py-2">No clients yet</p>
                  ) : clients.map(c => {
                    const userId = c.user_id || c.id;
                    const isSelected = formSelectedClients.includes(userId);
                    return (
                      <div key={c.id} onClick={() => toggleClientSelection(userId)}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors"
                        style={{ background: isSelected ? 'rgba(212,175,55,0.1)' : 'transparent' }}>
                        <div className="w-5 h-5 rounded flex items-center justify-center border"
                          style={{ borderColor: isSelected ? '#D4AF37' : 'rgba(255,255,255,0.2)', background: isSelected ? '#D4AF37' : 'transparent' }}>
                          {isSelected && <Check size={12} color="#080810" />}
                        </div>
                        <span className="text-sm" style={{ color: isSelected ? '#D4AF37' : 'white' }}>{c.name}</span>
                        {c.phone && <span className="text-xs text-gray-500 ml-auto">{c.phone}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Block Date Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(244,63,94,0.05)', border: '1px solid rgba(244,63,94,0.1)' }}>
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} color="#F43F5E" />
                  <span className="text-sm text-white">Block date for other bookings</span>
                </div>
                <button onClick={() => setFormIsBusy(!formIsBusy)}
                  className="w-12 h-6 rounded-full transition-all relative"
                  style={{ background: formIsBusy ? '#F43F5E' : '#333' }}>
                  <div className="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all"
                    style={{ left: formIsBusy ? '26px' : '2px' }} />
                </button>
              </div>

              {formIsBusy && (
                <p className="text-xs text-gray-500 -mt-2">Other clients won't be able to book this date</p>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              {editingEvent && (
                <button onClick={() => { handleDeleteEvent(editingEvent.id); setShowEventModal(false); }}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: 'rgba(255,59,48,0.1)', color: '#FF3B30' }}>
                  Delete
                </button>
              )}
              <button onClick={handleSaveEvent} disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}>
                {saving ? 'Saving...' : editingEvent ? 'Update Event' : 'Create Event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
