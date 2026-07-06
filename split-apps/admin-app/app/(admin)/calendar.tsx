import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Dimensions, Alert, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Clock, MapPin, X, User, RotateCcw, Ban } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { getHolidaysForYear, getHolidayColor } from '@/lib/kenyan-holidays';

type Booking = {
  id: string;
  user_id: string;
  date: string;
  time: string;
  location: string;
  status: string;
  shoot_type?: string;
  notes?: string;
  client_name?: string;
  client_email?: string;
};

type CalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  bookings: Booking[];
  holidays: any[];
  isBusy: boolean;
};

const STATUS_COLORS: Record<string, string> = {
  booked: '#FF9F0A',
  pending: '#FF9F0A',
  confirmed: '#34C759',
  completed: '#3B82F6',
  cancelled: '#FF3B30',
  editing: '#AF52DE',
  ready: '#30D158',
  rescheduled: '#FF6B6B',
};

const { width } = Dimensions.get('window');
const CELL_SIZE = (width - 40) / 7;

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);

  const loadBookings = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;

    // Fetch bookings for this month (non-cancelled)
    const { data: bookingsData } = await supabase
      .from('bookings')
      .select('*')
      .gte('date', startDate)
      .lt('date', endDate)
      .neq('status', 'cancelled')
      .order('date', { ascending: true });

    // Fetch client names for each booking
    if (bookingsData && bookingsData.length > 0) {
      const userIds = [...new Set(bookingsData.map(b => b.user_id))];
      const { data: clients } = await supabase
        .from('user_profiles')
        .select('id, name, email')
        .in('id', userIds);

      const clientMap = new Map(clients?.map(c => [c.id, c]) || []);
      const enriched = bookingsData.map(b => ({
        ...b,
        client_name: clientMap.get(b.user_id)?.name || 'Unknown',
        client_email: clientMap.get(b.user_id)?.email || '',
      }));
      setBookings(enriched);
    } else {
      setBookings(bookingsData || []);
    }
    setLoading(false);
  }, [currentDate]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

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

  const getDaysInMonth = (): CalendarDay[] => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
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

      const dayBookings = bookings.filter(b => {
        const bookingDate = new Date(b.date);
        return bookingDate.getDate() === currentDay.getDate() &&
               bookingDate.getMonth() === currentDay.getMonth() &&
               bookingDate.getFullYear() === currentDay.getFullYear();
      });

      const dayHolidays = holidays.filter(h => {
        return h.date.getDate() === currentDay.getDate() &&
               h.date.getMonth() === currentDay.getMonth();
      });

      // Mark as busy if there are confirmed/booked bookings
      const isBusy = dayBookings.some(b => 
        ['booked', 'confirmed', 'pending'].includes(b.status)
      );

      days.push({
        date: currentDay,
        isCurrentMonth: currentDay.getMonth() === month,
        isToday: currentDay.toDateString() === today.toDateString(),
        bookings: dayBookings,
        holidays: dayHolidays,
        isBusy,
      });
    }

    return days;
  };

  const handleDayPress = (day: CalendarDay) => {
    if (day.bookings.length > 0 || day.holidays.length > 0) {
      setSelectedDay(day);
      setShowDayModal(true);
    }
  };

  const handleReject = async (booking: Booking) => {
    Alert.alert(
      'Reject Booking',
      `Reject ${booking.client_name}'s booking on ${new Date(booking.date).toLocaleDateString('en-KE', { weekday: 'long', month: 'long', day: 'numeric' })}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            await supabase
              .from('bookings')
              .update({ status: 'cancelled' })
              .eq('id', booking.id);
            
            setShowDayModal(false);
            loadBookings();
            
            // Check remaining bookings for this day
            const remaining = selectedDay?.bookings.filter(b => b.id !== booking.id && ['booked', 'confirmed', 'pending'].includes(b.status)) || [];
            if (remaining.length > 0) {
              Alert.alert(
                'Remaining Bookings',
                `${remaining.length} booking(s) still scheduled for this day`,
                [{ text: 'OK' }]
              );
            }
          },
        },
      ]
    );
  };

  const handleReschedule = (booking: Booking) => {
    setRescheduleBooking(booking);
    setShowRescheduleModal(true);
    setShowDayModal(false);
  };

  const confirmReschedule = async (newDate: string) => {
    if (!rescheduleBooking) return;
    
    await supabase
      .from('bookings')
      .update({ 
        date: newDate,
        status: 'booked'
      })
      .eq('id', rescheduleBooking.id);
    
    setShowRescheduleModal(false);
    setRescheduleBooking(null);
    loadBookings();
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
              <Pressable
                key={index}
                style={[
                  styles.dayCell,
                  !day.isCurrentMonth && styles.dayCellInactive,
                  day.isToday && styles.dayCellToday,
                  day.isBusy && styles.dayCellBusy,
                ]}
                onPress={() => handleDayPress(day)}
              >
                <Text
                  style={[
                    styles.dayText,
                    !day.isCurrentMonth && styles.dayTextInactive,
                    day.isToday && styles.dayTextToday,
                    day.isBusy && styles.dayTextBusy,
                  ]}
                >
                  {day.date.getDate()}
                </Text>
                {/* Booking dots */}
                {day.bookings.length > 0 && (
                  <View style={styles.bookingDots}>
                    {day.bookings.slice(0, 3).map((b, i) => (
                      <View
                        key={i}
                        style={[styles.bookingDot, { backgroundColor: STATUS_COLORS[b.status] || Colors.gold }]}
                      />
                    ))}
                  </View>
                )}
                {day.holidays.length > 0 && (
                  <View style={styles.holidayDot}>
                    <View style={[styles.holidayDotInner, { backgroundColor: getHolidayColor(day.holidays[0].type) }]} />
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {/* Upcoming Bookings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Bookings</Text>
          {bookings.length === 0 ? (
            <View style={styles.emptyCard}>
              <CalendarIcon size={32} color="rgba(255,255,255,0.2)" />
              <Text style={styles.emptyText}>No bookings this month</Text>
            </View>
          ) : (
            bookings.slice(0, 5).map(booking => (
              <View key={booking.id} style={styles.eventCard}>
                <View style={[styles.eventTypeBar, { backgroundColor: STATUS_COLORS[booking.status] || Colors.gold }]} />
                <View style={styles.eventContent}>
                  <Text style={styles.eventTitle}>{booking.client_name || 'Client'}</Text>
                  <View style={styles.eventMeta}>
                    <CalendarIcon size={12} color="rgba(255,255,255,0.5)" />
                    <Text style={styles.eventMetaText}>
                      {new Date(booking.date).toLocaleDateString('en-KE', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </Text>
                    {booking.time && (
                      <>
                        <Clock size={12} color="rgba(255,255,255,0.5)" />
                        <Text style={styles.eventMetaText}>{booking.time}</Text>
                      </>
                    )}
                  </View>
                  {booking.location && (
                    <View style={styles.eventMeta}>
                      <MapPin size={12} color="rgba(255,255,255,0.5)" />
                      <Text style={styles.eventMetaText}>{booking.location}</Text>
                    </View>
                  )}
                  <View style={styles.statusBadge}>
                    <Text style={[styles.statusText, { color: STATUS_COLORS[booking.status] || Colors.gold }]}>
                      {booking.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
                {/* Reject/Reschedule buttons for pending bookings */}
                {['booked', 'pending'].includes(booking.status) && (
                  <View style={styles.bookingActions}>
                    <Pressable style={styles.actionBtn} onPress={() => handleReschedule(booking)}>
                      <RotateCcw size={14} color={Colors.gold} />
                    </Pressable>
                    <Pressable style={[styles.actionBtn, styles.rejectBtn]} onPress={() => handleReject(booking)}>
                      <Ban size={14} color="#FF3B30" />
                    </Pressable>
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Day Detail Modal */}
      <Modal visible={showDayModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedDay?.date.toLocaleDateString('en-KE', { weekday: 'long', month: 'long', day: 'numeric' })}
              </Text>
              <Pressable onPress={() => setShowDayModal(false)}>
                <X size={20} color={Colors.textMuted} />
              </Pressable>
            </View>

            {/* Holidays */}
            {selectedDay?.holidays && selectedDay.holidays.length > 0 && (
              <View style={styles.holidaySection}>
                {selectedDay.holidays.map((h, i) => (
                  <View key={i} style={styles.holidayCard}>
                    <Text style={styles.holidayName}>{h.name}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Bookings for this day */}
            {selectedDay?.bookings && selectedDay.bookings.length > 0 ? (
              selectedDay.bookings.map(booking => (
                <View key={booking.id} style={styles.modalBookingCard}>
                  <View style={[styles.modalBookingStatus, { backgroundColor: STATUS_COLORS[booking.status] || Colors.gold }]} />
                  <View style={styles.modalBookingInfo}>
                    <View style={styles.modalBookingHeader}>
                      <User size={14} color={Colors.textMuted} />
                      <Text style={styles.modalBookingName}>{booking.client_name || 'Client'}</Text>
                    </View>
                    <Text style={styles.modalBookingTime}>{booking.time} • {booking.location}</Text>
                    <Text style={[styles.modalBookingStatusText, { color: STATUS_COLORS[booking.status] }]}>
                      {booking.status.toUpperCase()}
                    </Text>
                  </View>
                  {['booked', 'pending'].includes(booking.status) && (
                    <View style={styles.modalBookingActions}>
                      <Pressable style={styles.modalActionBtn} onPress={() => handleReschedule(booking)}>
                        <RotateCcw size={12} color={Colors.gold} />
                        <Text style={styles.modalActionText}>Reschedule</Text>
                      </Pressable>
                      <Pressable style={[styles.modalActionBtn, styles.modalRejectBtn]} onPress={() => handleReject(booking)}>
                        <Ban size={12} color="#FF3B30" />
                        <Text style={[styles.modalActionText, { color: '#FF3B30' }]}>Reject</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ))
            ) : (
              <View style={styles.modalEmpty}>
                <Text style={styles.modalEmptyText}>No bookings for this day</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Reschedule Modal */}
      <Modal visible={showRescheduleModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reschedule Booking</Text>
              <Pressable onPress={() => { setShowRescheduleModal(false); setRescheduleBooking(null); }}>
                <X size={20} color={Colors.textMuted} />
              </Pressable>
            </View>
            <Text style={styles.rescheduleInfo}>
              Current: {rescheduleBooking ? new Date(rescheduleBooking.date).toLocaleDateString('en-KE', { weekday: 'long', month: 'long', day: 'numeric' }) : ''}
            </Text>
            <Text style={styles.rescheduleHint}>Select a new date below</Text>
            
            {/* Simple date picker - show available dates */}
            <ScrollView style={styles.datePickerScroll} showsVerticalScrollIndicator={false}>
              {Array.from({ length: 30 }, (_, i) => {
                const date = new Date();
                date.setDate(date.getDate() + i + 1);
                const dateStr = date.toISOString().split('T')[0];
                const isBusy = bookings.some(b => 
                  b.date === dateStr && 
                  ['booked', 'confirmed', 'pending'].includes(b.status) &&
                  b.id !== rescheduleBooking?.id
                );
                return (
                  <Pressable
                    key={i}
                    style={[styles.dateOption, isBusy && styles.dateOptionBusy]}
                    onPress={() => !isBusy && confirmReschedule(dateStr)}
                    disabled={isBusy}
                  >
                    <Text style={[styles.dateOptionText, isBusy && styles.dateOptionTextBusy]}>
                      {date.toLocaleDateString('en-KE', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </Text>
                    {isBusy && <Text style={styles.busyLabel}>BUSY</Text>}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  dayCellBusy: {
    backgroundColor: 'rgba(255,59,48,0.1)',
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
  dayTextBusy: {
    color: '#FF6B6B',
  },
  bookingDots: {
    position: 'absolute',
    bottom: 4,
    flexDirection: 'row',
    gap: 2,
  },
  bookingDot: {
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
  statusBadge: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  bookingActions: {
    justifyContent: 'center',
    gap: 8,
    paddingRight: 12,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectBtn: {
    backgroundColor: 'rgba(255,59,48,0.1)',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
  holidaySection: {
    marginBottom: 16,
  },
  holidayCard: {
    backgroundColor: 'rgba(255,107,107,0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  holidayName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B6B',
  },
  modalBookingCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  modalBookingStatus: {
    width: 4,
  },
  modalBookingInfo: {
    flex: 1,
    padding: 12,
  },
  modalBookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  modalBookingName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  modalBookingTime: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 4,
  },
  modalBookingStatusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  modalBookingActions: {
    justifyContent: 'center',
    gap: 8,
    paddingRight: 12,
  },
  modalActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  modalRejectBtn: {
    backgroundColor: 'rgba(255,59,48,0.1)',
  },
  modalActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.gold,
  },
  modalEmpty: {
    padding: 32,
    alignItems: 'center',
  },
  modalEmptyText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
  },
  rescheduleInfo: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 4,
  },
  rescheduleHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 16,
  },
  datePickerScroll: {
    maxHeight: 300,
  },
  dateOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  dateOptionBusy: {
    opacity: 0.5,
  },
  dateOptionText: {
    fontSize: 14,
    color: Colors.white,
  },
  dateOptionTextBusy: {
    color: 'rgba(255,255,255,0.3)',
  },
  busyLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FF3B30',
    letterSpacing: 0.5,
  },
});
