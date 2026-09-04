import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator, TextInput, Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft, Calendar, Clock, MapPin, CheckCircle, XCircle, AlertCircle,
  MessageSquare, Phone, ChevronRight, Zap, RotateCcw,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  pending: { color: '#F59E0B', icon: <AlertCircle size={14} color="#F59E0B" />, label: 'Pending' },
  booked: { color: '#3B82F6', icon: <Calendar size={14} color="#3B82F6" />, label: 'Booked' },
  confirmed: { color: '#22C55E', icon: <CheckCircle size={14} color="#22C55E" />, label: 'Confirmed' },
  completed: { color: '#8B5CF6', icon: <CheckCircle size={14} color="#8B5CF6" />, label: 'Completed' },
  cancelled: { color: '#EF4444', icon: <XCircle size={14} color="#EF4444" />, label: 'Cancelled' },
  editing: { color: '#F59E0B', icon: <AlertCircle size={14} color="#F59E0B" />, label: 'Editing' },
  ready: { color: '#22C55E', icon: <Zap size={14} color="#22C55E" />, label: 'Ready' },
};

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [booking, setBooking] = useState<any>(null);
  const [pkgName, setPkgName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [rescheduleModal, setRescheduleModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState<number | null>(null);
  const [rescheduleMonth, setRescheduleMonth] = useState(new Date().getMonth());
  const rescheduleYear = new Date().getFullYear();
  const [busyDates, setBusyDates] = useState<string[]>([]);
  const [rescheduling, setRescheduling] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadBooking();
  }, [id]);

  const loadBooking = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      setBooking(data);

      if (data?.package_id) {
        const { data: pkg } = await supabase
          .from('packages')
          .select('name')
          .eq('id', data.package_id)
          .single();
        setPkgName(pkg?.name || '');
      }

      // Fetch busy dates for the admin
      if (data?.owner_admin_id) {
        const { data: existing } = await supabase
          .from('bookings')
          .select('date')
          .eq('owner_admin_id', data.owner_admin_id)
          .in('status', ['booked', 'confirmed', 'pending']);
        if (existing) {
          setBusyDates(existing.map((b: any) => b.date));
        }
      }
    } catch (e) {
      console.error('Error loading booking:', e);
      Alert.alert('Error', 'Failed to load booking details.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleDate || !booking) return;
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const newDate = `${rescheduleDate} of ${monthNames[rescheduleMonth]} ${rescheduleYear}`;

    setRescheduling(true);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ date: newDate, status: 'pending' })
        .eq('id', booking.id);
      if (error) throw error;

      setBooking((prev: any) => ({ ...prev, date: newDate, status: 'pending' }));
      setRescheduleModal(false);
      setRescheduleDate(null);
      Alert.alert('Rescheduled', `Your booking has been rescheduled to ${newDate}.`);
    } catch (e) {
      console.error('Reschedule error:', e);
      Alert.alert('Error', 'Failed to reschedule. Please try again.');
    } finally {
      setRescheduling(false);
    }
  };

  const handleCancel = () => {
    Alert.alert('Cancel Booking', 'Are you sure you want to cancel this booking?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel', style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase
              .from('bookings')
              .update({ status: 'cancelled' })
              .eq('id', booking.id);
            if (error) throw error;
            setBooking((prev: any) => ({ ...prev, status: 'cancelled' }));
            Alert.alert('Cancelled', 'Your booking has been cancelled.');
          } catch (e) {
            Alert.alert('Error', 'Failed to cancel booking.');
          }
        },
      },
    ]);
  };

  // Calendar grid for reschedule modal
  const getDaysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay();
  const daysInMonth = getDaysInMonth(rescheduleMonth, rescheduleYear);
  const firstDay = getFirstDayOfMonth(rescheduleMonth, rescheduleYear);
  const calendarDays: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  if (!booking) return null;

  const config = statusConfig[booking.status] || statusConfig.booked;
  const canReschedule = ['booked', 'confirmed', 'pending'].includes(booking.status);
  const canCancel = ['booked', 'confirmed', 'pending'].includes(booking.status);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Booking Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Status */}
        <View style={[styles.statusCard, { borderColor: config.color + '40' }]}>
          <View style={[styles.statusBadge, { backgroundColor: config.color + '20' }]}>
            {config.icon}
            <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
          </View>
          <Text style={styles.packageName}>{pkgName || 'Photography Session'}</Text>
        </View>

        {/* Details */}
        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Calendar size={18} color={Colors.gold} />
            <View style={styles.detailInfo}>
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue}>{booking.date}</Text>
            </View>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailRow}>
            <Clock size={18} color={Colors.gold} />
            <View style={styles.detailInfo}>
              <Text style={styles.detailLabel}>Time</Text>
              <Text style={styles.detailValue}>{booking.time}</Text>
            </View>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailRow}>
            <MapPin size={18} color={Colors.gold} />
            <View style={styles.detailInfo}>
              <Text style={styles.detailLabel}>Location</Text>
              <Text style={styles.detailValue}>{booking.location}</Text>
            </View>
          </View>
          {booking.notes && (
            <>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <MessageSquare size={18} color={Colors.gold} />
                <View style={styles.detailInfo}>
                  <Text style={styles.detailLabel}>Notes</Text>
                  <Text style={styles.detailValue}>{booking.notes}</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Actions */}
        {canReschedule && (
          <Pressable style={styles.actionBtn} onPress={() => setRescheduleModal(true)}>
            <LinearGradient colors={['rgba(212,175,55,0.15)', 'rgba(212,175,55,0.05)']} style={styles.actionBtnGradient}>
              <RotateCcw size={18} color={Colors.gold} />
              <Text style={styles.actionBtnText}>Reschedule</Text>
              <ChevronRight size={18} color={Colors.gold} />
            </LinearGradient>
          </Pressable>
        )}
        {canCancel && (
          <Pressable style={styles.actionBtn} onPress={handleCancel}>
            <View style={[styles.actionBtnGradient, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
              <XCircle size={18} color="#EF4444" />
              <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Cancel Booking</Text>
              <ChevronRight size={18} color="#EF4444" />
            </View>
          </Pressable>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Reschedule Modal */}
      <Modal visible={rescheduleModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reschedule Booking</Text>
            <Text style={styles.modalSubtitle}>Select a new date for your session</Text>

            {/* Month nav */}
            <View style={styles.monthNav}>
              <Pressable onPress={() => setRescheduleMonth(m => Math.max(0, m - 1))}>
                <Text style={styles.monthNavBtn}>{'<'}</Text>
              </Pressable>
              <Text style={styles.monthTitle}>{monthNames[rescheduleMonth]} {rescheduleYear}</Text>
              <Pressable onPress={() => setRescheduleMonth(m => Math.min(11, m + 1))}>
                <Text style={styles.monthNavBtn}>{'>'}</Text>
              </Pressable>
            </View>

            {/* Day headers */}
            <View style={styles.dayHeaders}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <Text key={i} style={styles.dayHeader}>{d}</Text>
              ))}
            </View>

            {/* Calendar grid */}
            <View style={styles.calendarGrid}>
              {calendarDays.map((day, i) => {
                if (!day) return <View key={`pad-${i}`} style={styles.dayCell} />;
                const dateStr = `${day} of ${monthNames[rescheduleMonth]} ${rescheduleYear}`;
                const isBusy = busyDates.includes(dateStr);
                const isSelected = rescheduleDate === day;
                const isPast = new Date(rescheduleYear, rescheduleMonth, day) < new Date(new Date().toDateString());
                const disabled = isBusy || isPast;

                return (
                  <Pressable
                    key={day}
                    style={[
                      styles.dayCell,
                      isSelected && styles.dayCellSelected,
                      disabled && styles.dayCellDisabled,
                    ]}
                    disabled={disabled}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setRescheduleDate(day);
                    }}
                  >
                    <Text style={[
                      styles.dayText,
                      isSelected && styles.dayTextSelected,
                      disabled && styles.dayTextDisabled,
                    ]}>{day}</Text>
                    {isBusy && <View style={styles.busyDot} />}
                  </Pressable>
                );
              })}
            </View>

            {/* Legend */}
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
                <Text style={styles.legendText}>Busy</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.gold }]} />
                <Text style={styles.legendText}>Selected</Text>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => { setRescheduleModal(false); setRescheduleDate(null); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalConfirm, !rescheduleDate && { opacity: 0.5 }]}
                disabled={!rescheduleDate || rescheduling}
                onPress={handleReschedule}
              >
                {rescheduling ? (
                  <ActivityIndicator size="small" color={Colors.background} />
                ) : (
                  <Text style={styles.modalConfirmText}>Confirm Reschedule</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.white },
  scroll: { flex: 1, paddingHorizontal: 16 },

  statusCard: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 12, backgroundColor: Colors.card },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 10 },
  statusText: { fontSize: 12, fontWeight: '600' },
  packageName: { fontSize: 20, fontWeight: '700', color: Colors.white },

  detailsCard: { backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  detailInfo: { flex: 1 },
  detailLabel: { fontSize: 12, color: Colors.textMuted, marginBottom: 2 },
  detailValue: { fontSize: 15, color: Colors.white, fontWeight: '500' },
  detailDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },

  actionBtn: { marginBottom: 8, borderRadius: 12, overflow: 'hidden' },
  actionBtnGradient: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, backgroundColor: 'rgba(212,175,55,0.1)' },
  actionBtnText: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.gold },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.white, marginBottom: 4 },
  modalSubtitle: { fontSize: 14, color: Colors.textMuted, marginBottom: 20 },

  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  monthNavBtn: { fontSize: 20, color: Colors.gold, fontWeight: '700', paddingHorizontal: 12 },
  monthTitle: { fontSize: 16, fontWeight: '600', color: Colors.white },

  dayHeaders: { flexDirection: 'row', marginBottom: 8 },
  dayHeader: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: Colors.textMuted },

  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  dayCellSelected: { backgroundColor: Colors.gold },
  dayCellDisabled: { opacity: 0.3 },
  dayText: { fontSize: 14, color: Colors.white },
  dayTextSelected: { color: Colors.background, fontWeight: '700' },
  dayTextDisabled: { color: Colors.textMuted },
  busyDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#EF4444', position: 'absolute', bottom: 4 },

  legend: { flexDirection: 'row', gap: 16, marginTop: 12, marginBottom: 20 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: Colors.textMuted },

  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center' },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: Colors.textMuted },
  modalConfirm: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: Colors.gold, alignItems: 'center' },
  modalConfirmText: { fontSize: 15, fontWeight: '700', color: Colors.background },
});
