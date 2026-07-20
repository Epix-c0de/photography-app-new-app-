'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, 
  Clock, MapPin, User, Loader2, Trash2, Edit, X 
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
};

type CalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: Event[];
  holidays: Array<{ name: string; type: string; description?: string }>;
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

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState('wedding');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formClientId, setFormClientId] = useState('');
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);

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

    setEvents((data || []).map((e: any) => ({
      ...e,
      clientName: e.client_name || 'No Client',
    })));
    setLoading(false);
  }, [currentDate]);

  const loadClients = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('clients')
      .select('id, name')
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
    setShowEventModal(true);
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setFormTitle(event.title);
    setFormType(event.event_type);
    setFormDate(event.event_date);
    setFormTime(event.event_time || '');
    setFormLocation(event.location || '');
    setFormNotes(event.notes || '');
    setFormClientId(event.client_id || '');
    setShowEventModal(true);
  };

  const handleSaveEvent = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const eventData = {
      photographer_id: user.id,
      title: formTitle,
      event_type: formType,
      event_date: formDate,
      event_time: formTime || null,
      location: formLocation || null,
      notes: formNotes || null,
      client_id: formClientId || null,
      status: 'scheduled',
    };

    if (editingEvent) {
      await supabase.from('events').update(eventData).eq('id', editingEvent.id);
      showToast('Event updated!');
    } else {
      await supabase.from('events').insert(eventData);
      showToast('Event created!');
    }

    setShowEventModal(false);
    loadEvents();
  };

  const handleDeleteEvent = async (eventId: string) => {
    await supabase.from('events').delete().eq('id', eventId);
    showToast('Event deleted!');
    loadEvents();
  };

  const getEventTypeColor = (type: string) => {
    return EVENT_TYPES.find(t => t.value === type)?.color || '#8E8E93';
  };

  const days = getDaysInMonth(currentDate);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 24px' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, background: 'rgba(26,26,46,0.95)',
          border: '1px solid rgba(212,175,55,0.3)', borderRadius: 14, padding: '12px 20px',
          color: '#D4AF37', fontWeight: 600, fontSize: 14, zIndex: 100, backdropFilter: 'blur(20px)',
        }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: 'white', marginBottom: 8 }}>Calendar</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
            Manage your photography schedule
          </p>
        </div>
        <button
          onClick={handleAddEvent}
          style={{
            padding: '12px 24px',
            borderRadius: 12,
            border: 'none',
            background: 'linear-gradient(135deg, #D4AF37, #F0D060)',
            color: '#080810',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Plus size={18} /> Add Event
        </button>
      </div>

      {/* Calendar Navigation */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
      }}>
        <button
          onClick={handlePrevMonth}
          style={{
            padding: '10px 16px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.05)',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <ChevronLeft size={18} /> Prev
        </button>

        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'white' }}>
          {currentDate.toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })}
        </h2>

        <button
          onClick={handleNextMonth}
          style={{
            padding: '10px 16px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.05)',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          Next <ChevronRight size={18} />
        </button>
      </div>

      {/* Calendar Grid */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 24,
      }}>
        {/* Week Days Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          {weekDays.map(day => (
            <div key={day} style={{
              padding: '12px 8px',
              textAlign: 'center',
              fontSize: 13,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.5)',
            }}>
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {days.map((day, index) => (
            <div
              key={index}
              onClick={() => handleDayClick(day)}
              style={{
                minHeight: 100,
                padding: 8,
                borderRight: (index + 1) % 7 !== 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                borderBottom: index < 35 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                background: day.isToday ? 'rgba(212,175,55,0.1)' : 'transparent',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!day.isToday) e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
              }}
              onMouseLeave={(e) => {
                if (!day.isToday) e.currentTarget.style.background = 'transparent';
              }}
            >
              <div style={{
                fontSize: 14,
                fontWeight: day.isToday ? 700 : 500,
                color: day.isCurrentMonth ? (day.isToday ? '#D4AF37' : 'white') : 'rgba(255,255,255,0.2)',
                marginBottom: 4,
              }}>
                {day.date.getDate()}
              </div>

              {/* Events */}
              {day.events.slice(0, 2).map((event) => (
                <div
                  key={event.id}
                  onClick={(e) => { e.stopPropagation(); handleEditEvent(event); }}
                  style={{
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: `${getEventTypeColor(event.event_type)}30`,
                    borderLeft: `3px solid ${getEventTypeColor(event.event_type)}`,
                    fontSize: 11,
                    color: getEventTypeColor(event.event_type),
                    marginBottom: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {event.title}
                </div>
              ))}

              {day.events.length > 2 && (
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                  +{day.events.length - 2} more
                </div>
              )}

              {/* Holidays */}
              {day.holidays.slice(0, 1).map((holiday, i) => (
                <div
                  key={i}
                  style={{
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: `${getHolidayColor(holiday.type)}20`,
                    fontSize: 10,
                    color: getHolidayColor(holiday.type),
                    marginTop: 2,
                  }}
                >
                  {holiday.name}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Event Type Legend */}
      <div style={{
        display: 'flex',
        gap: 12,
        flexWrap: 'wrap',
        marginBottom: 24,
      }}>
        {EVENT_TYPES.map(type => (
          <div key={type.value} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: type.color }} />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{type.label}</span>
          </div>
        ))}
      </div>

      {/* Upcoming Events */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16,
        padding: 24,
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'white', marginBottom: 16 }}>Upcoming Events</h3>
        {events.length === 0 ? (
          <p style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: 20 }}>
            No events scheduled this month
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {events.slice(0, 5).map(event => (
              <div
                key={event.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: 16,
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: `${getEventTypeColor(event.event_type)}20`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <CalendarIcon size={20} color={getEventTypeColor(event.event_type)} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: 'white', fontSize: 15, marginBottom: 2 }}>
                    {event.title}
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                    <span>{new Date(event.event_date).toLocaleDateString('en-KE', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                    {event.event_time && <span>• {event.event_time}</span>}
                    {event.location && <span>• {event.location}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleEditEvent(event)}
                    style={{
                      padding: 8,
                      borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.05)',
                      color: 'rgba(255,255,255,0.5)',
                      cursor: 'pointer',
                    }}
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteEvent(event.id)}
                    style={{
                      padding: 8,
                      borderRadius: 8,
                      border: '1px solid rgba(255,59,48,0.3)',
                      background: 'rgba(255,59,48,0.1)',
                      color: '#FF3B30',
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Event Modal */}
      {showEventModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: '#1a1a2e',
            borderRadius: 20,
            padding: 32,
            width: '90%',
            maxWidth: 500,
            maxHeight: '90vh',
            overflow: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'white' }}>
                {editingEvent ? 'Edit Event' : 'Add Event'}
              </h2>
              <button
                onClick={() => setShowEventModal(false)}
                style={{
                  padding: 8,
                  borderRadius: 8,
                  border: 'none',
                  background: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  cursor: 'pointer',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Title */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
                Event Title *
              </label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g., Smith Wedding"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'white',
                  fontSize: 14,
                }}
              />
            </div>

            {/* Event Type */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
                Event Type
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {EVENT_TYPES.map(type => (
                  <button
                    key={type.value}
                    onClick={() => setFormType(type.value)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: formType === type.value ? `2px solid ${type.color}` : '1px solid rgba(255,255,255,0.1)',
                      background: formType === type.value ? `${type.color}20` : 'rgba(255,255,255,0.03)',
                      color: formType === type.value ? type.color : 'rgba(255,255,255,0.5)',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date & Time */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
                  Date *
                </label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.05)',
                    color: 'white',
                    fontSize: 14,
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
                  Time
                </label>
                <input
                  type="time"
                  value={formTime}
                  onChange={(e) => setFormTime(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.05)',
                    color: 'white',
                    fontSize: 14,
                  }}
                />
              </div>
            </div>

            {/* Client */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
                Client
              </label>
              <select
                value={formClientId}
                onChange={(e) => setFormClientId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'white',
                  fontSize: 14,
                }}
              >
                <option value="">No client</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Location */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
                Location
              </label>
              <input
                type="text"
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
                placeholder="e.g., Nairobi, Kenya"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'white',
                  fontSize: 14,
                }}
              />
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
                Notes
              </label>
              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Additional notes..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'white',
                  fontSize: 14,
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowEventModal(false)}
                style={{
                  padding: '12px 24px',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.7)',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEvent}
                disabled={!formTitle || !formDate}
                style={{
                  padding: '12px 32px',
                  borderRadius: 10,
                  border: 'none',
                  background: (!formTitle || !formDate) ? 'rgba(212,175,55,0.3)' : 'linear-gradient(135deg, #D4AF37, #F0D060)',
                  color: '#080810',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: (!formTitle || !formDate) ? 'not-allowed' : 'pointer',
                }}
              >
                {editingEvent ? 'Update Event' : 'Create Event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
