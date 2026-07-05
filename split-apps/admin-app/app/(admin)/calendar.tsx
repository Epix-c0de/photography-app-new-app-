import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Dimensions, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Clock, MapPin } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { getHolidaysForYear, getHolidayColor } from '@/lib/kenyan-holidays';

type Event = {
  id: string;
  title: string;
  event_type: string;
  event_date: string;
  event_time: string | null;
  location: string | null;
  status: string;
  client_name?: string;
};

const EVENT_TYPES: Record<string, { color: string }> = {
  wedding: { color: '#FF6B6B' },
  portrait: { color: '#4ECDC4' },
  corporate: { color: '#45B7D1' },
  event: { color: '#96CEB4' },
  graduation: { color: '#FFEAA7' },
  other: { color: '#DDA0DD' },
};

const { width } = Dimensions.get('window');
const CELL_SIZE = (width - 40) / 7;

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

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

    setEvents(data || []);
    setLoading(false);
  }, [currentDate]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

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

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days = [];
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

  const days = getDaysInMonth();
  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Bookings</Text>
        <Text style={styles.subtitle}>{events.length} events this month</Text>
      </View>
      
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Month Navigation */}
        <View style={styles.monthNav}>
          <Pressable onPress={handlePrevMonth} style={styles.navBtn}>
            <ChevronLeft size={20} color={Colors.gold} />
          </Pressable>
          <Text style={styles.monthTitle}>
            {currentDate.toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })}
          </Text>
          <Pressable onPress={handleNextMonth} style={styles.navBtn}>
            <ChevronRight size={20} color={Colors.gold} />
          </Pressable>
        </View>

        {/* Calendar Grid */}
        <View style={styles.calendarCard}>
          {/* Week Days Header */}
          <View style={styles.weekHeader}>
            {weekDays.map((day, i) => (
              <View key={i} style={styles.weekDayCell}>
                <Text style={styles.weekDayText}>{day}</Text>
              </View>
            ))}
          </View>

          {/* Days Grid */}
          <View style={styles.daysGrid}>
            {days.map((day, index) => (
              <View
                key={index}
                style={[
                  styles.dayCell,
                  !day.isCurrentMonth && styles.dayCellInactive,
                  day.isToday && styles.dayCellToday,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    !day.isCurrentMonth && styles.dayTextInactive,
                    day.isToday && styles.dayTextToday,
                  ]}
                >
                  {day.date.getDate()}
                </Text>
                {day.events.length > 0 && (
                  <View style={styles.eventDot}>
                    <View style={[styles.eventDotInner, { backgroundColor: EVENT_TYPES[day.events[0].event_type]?.color || Colors.gold }]} />
                  </View>
                )}
                {day.holidays.length > 0 && (
                  <View style={styles.holidayDot}>
                    <View style={[styles.holidayDotInner, { backgroundColor: getHolidayColor(day.holidays[0].type) }]} />
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Upcoming Events */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Events</Text>
          {events.length === 0 ? (
            <View style={styles.emptyCard}>
              <CalendarIcon size={32} color="rgba(255,255,255,0.2)" />
              <Text style={styles.emptyText}>No events this month</Text>
            </View>
          ) : (
            events.slice(0, 5).map(event => (
              <View key={event.id} style={styles.eventCard}>
                <View style={[styles.eventTypeBar, { backgroundColor: EVENT_TYPES[event.event_type]?.color || Colors.gold }]} />
                <View style={styles.eventContent}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <View style={styles.eventMeta}>
                    <CalendarIcon size={12} color="rgba(255,255,255,0.5)" />
                    <Text style={styles.eventMetaText}>
                      {new Date(event.event_date).toLocaleDateString('en-KE', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </Text>
                    {event.event_time && (
                      <>
                        <Clock size={12} color="rgba(255,255,255,0.5)" />
                        <Text style={styles.eventMetaText}>{event.event_time}</Text>
                      </>
                    )}
                  </View>
                  {event.location && (
                    <View style={styles.eventMeta}>
                      <MapPin size={12} color="rgba(255,255,255,0.5)" />
                      <Text style={styles.eventMetaText}>{event.location}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
  calendarCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 24,
  },
  weekHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDayCell: {
    width: CELL_SIZE,
    alignItems: 'center',
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  dayCellInactive: {
    opacity: 0.3,
  },
  dayCellToday: {
    backgroundColor: 'rgba(212,175,55,0.15)',
    borderRadius: 8,
  },
  dayText: {
    fontSize: 14,
    color: Colors.white,
  },
  dayTextInactive: {
    color: 'rgba(255,255,255,0.3)',
  },
  dayTextToday: {
    color: Colors.gold,
    fontWeight: '700',
  },
  eventDot: {
    position: 'absolute',
    bottom: 4,
  },
  eventDotInner: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  holidayDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
  },
  holidayDotInner: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 8,
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  eventTypeBar: {
    width: 4,
  },
  eventContent: {
    flex: 1,
    padding: 12,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 4,
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  eventMetaText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
});
