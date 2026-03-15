import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Animated, Alert, Image, Modal, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Check,
  X,
  Clock,
  MapPin,
  CalendarDays,
  RefreshCw,
  DollarSign,
  AlertCircle,
  Edit3,
  MessageCircle,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { AdminService } from '@/services/admin';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/types/supabase';

type Booking = Database['public']['Tables']['bookings']['Row'] & {
  packages?: { name: string } | null;
  user_profiles?: { name: string; phone: string; avatar_url?: string } | null;
};

type AdminBooking = {
  id: string;
  clientName: string;
  clientAvatar: string;
  clientPhone: string;
  type: string;
  packageName: string;
  date: string;
  time: string;
  location: string;
  amount: number;
  depositPaid: boolean;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  notes?: string;
  clientId?: string;
};

type FilterType = 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled';

const statusConfig: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  booked: { color: Colors.warning, label: 'Booked', icon: <Clock size={14} color={Colors.warning} /> },
  pending: { color: Colors.warning, label: 'Pending', icon: <Clock size={14} color={Colors.warning} /> },
  confirmed: { color: Colors.success, label: 'Confirmed', icon: <Check size={14} color={Colors.success} /> },
  completed: { color: '#6C9AED', label: 'Completed', icon: <Check size={14} color="#6C9AED" /> },
  cancelled: { color: Colors.error, label: 'Cancelled', icon: <X size={14} color={Colors.error} /> },
  editing: { color: Colors.gold, label: 'Editing', icon: <Edit3 size={14} color={Colors.gold} /> },
  ready: { color: Colors.success, label: 'Ready', icon: <Check size={14} color={Colors.success} /> },
};

function formatCurrency(amount: number): string {
  return `KES ${amount.toLocaleString()}`;
}

function RescheduleModal({ visible, onClose, onConfirm, initialDate, initialTime }: { visible: boolean; onClose: () => void; onConfirm: (date: string, time: string) => void; initialDate: string; initialTime: string }) {
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);

  useEffect(() => {
    if (visible) {
      setDate(initialDate);
      setTime(initialTime);
    }
  }, [visible, initialDate, initialTime]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Reschedule Booking</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>New Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>New Time</Text>
            <TextInput
              style={styles.input}
              value={time}
              onChangeText={setTime}
              placeholder="e.g. 14:00"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
          <View style={styles.modalActions}>
            <Pressable style={styles.modalCancelBtn} onPress={onClose}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={styles.modalConfirmBtn}
              onPress={() => onConfirm(date, time)}
            >
              <Text style={styles.modalConfirmText}>Confirm</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function BookingCard({ 
  booking, 
  index, 
  onReschedule, 
  onUpdateStatus 
}: { 
  booking: AdminBooking; 
  index: number; 
  onReschedule: (booking: AdminBooking) => void; 
  onUpdateStatus: (id: string, status: 'confirmed' | 'cancelled' | 'completed' | 'pending') => void 
}) {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const config = statusConfig[booking.status];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, delay: index * 80, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, delay: index * 80, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim, index]);

  const handleConfirm = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Confirm Booking', `Confirm ${booking.clientName}'s ${booking.type} booking?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: 'default', onPress: () => onUpdateStatus(booking.id, 'confirmed') },
    ]);
  }, [booking, onUpdateStatus]);

  const handleReschedule = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onReschedule(booking);
  }, [booking, onReschedule]);

  const handleCancel = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert('Cancel Booking', `Cancel ${booking.clientName}'s ${booking.type} booking? This action cannot be undone.`, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Cancel Booking', style: 'destructive', onPress: () => onUpdateStatus(booking.id, 'cancelled') },
    ]);
  }, [booking, onUpdateStatus]);

  const handleComplete = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onUpdateStatus(booking.id, 'completed');
  }, [booking, onUpdateStatus]);

  const handleChat = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/(admin)/inbox',
      params: { clientId: booking.clientId }
    } as any);
  }, [booking.clientId, router]);


  return (
    <Pressable
      onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start()}
      onPress={() => {
        if (booking.clientId) {
          router.push({
            pathname: '/(admin)/clients',
            params: { clientId: booking.clientId }
          });
        }
      }}
    >
      <Animated.View style={[styles.bookingCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: scaleAnim }] }]}>
        <View style={styles.cardHeader}>
          <View style={styles.clientRow}>
            <Image source={{ uri: booking.clientAvatar }} style={styles.clientAvatar} />
            <View style={styles.clientInfo}>
              <Text style={styles.clientName}>{booking.clientName}</Text>
              <Text style={styles.clientPhone}>{booking.clientPhone}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: config.color + '18' }]}>
            {config.icon}
            <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <CalendarDays size={14} color={Colors.textMuted} />
              <Text style={styles.detailText}>{booking.date}</Text>
            </View>
            <View style={styles.detailItem}>
              <Clock size={14} color={Colors.textMuted} />
              <Text style={styles.detailText}>{booking.time}</Text>
            </View>
          </View>
          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <MapPin size={14} color={Colors.textMuted} />
              <Text style={styles.detailText}>{booking.location}</Text>
            </View>
          </View>

          <View style={styles.packageRow}>
            <View style={styles.packageBadge}>
              <Text style={styles.packageText}>{booking.packageName}</Text>
            </View>
            <View style={styles.typeBadge}>
              <Text style={styles.typeText}>{booking.type}</Text>
            </View>
            <View style={styles.amountBox}>
              <DollarSign size={12} color={Colors.gold} />
              <Text style={styles.amountText}>{formatCurrency(booking.amount)}</Text>
            </View>
          </View>

          {!booking.depositPaid && booking.status !== 'cancelled' && booking.status !== 'completed' && (
            <View style={styles.depositWarning}>
              <AlertCircle size={13} color={Colors.warning} />
              <Text style={styles.depositWarningText}>Deposit not paid</Text>
            </View>
          )}

          {booking.notes ? (
            <Text style={styles.notes} numberOfLines={2}>{booking.notes}</Text>
          ) : null}
        </View>

        <View style={styles.cardActions}>
          {booking.status === 'pending' ? (
            <Pressable style={styles.confirmBtn} onPress={handleConfirm}>
              <Check size={14} color={Colors.background} />
              <Text style={styles.confirmBtnText}>Confirm</Text>
            </Pressable>
          ) : (
            <Pressable style={[styles.rescheduleBtn, { borderColor: Colors.warning }]} onPress={() => onUpdateStatus(booking.id, 'pending')}>
              <Clock size={13} color={Colors.warning} />
              <Text style={[styles.rescheduleBtnText, { color: Colors.warning }]}>Set Pending</Text>
            </Pressable>
          )}
          
          {(booking.status === 'confirmed' || booking.status === 'pending') && (
            <>
              <Pressable style={styles.rescheduleBtn} onPress={handleReschedule}>
                <RefreshCw size={13} color={Colors.gold} />
                <Text style={styles.rescheduleBtnText}>Reschedule</Text>
              </Pressable>
              
              {booking.status === 'confirmed' && (
                <Pressable style={[styles.rescheduleBtn, { borderColor: Colors.success }]} onPress={handleComplete}>
                  <Check size={13} color={Colors.success} />
                  <Text style={[styles.rescheduleBtnText, { color: Colors.success }]}>Complete</Text>
                </Pressable>
              )}

              <Pressable style={styles.chatBtn} onPress={handleChat}>
                <MessageCircle size={14} color={Colors.gold} />
              </Pressable>

              <Pressable style={styles.cancelBtn} onPress={handleCancel}>
                <X size={13} color={Colors.error} />
              </Pressable>
            </>
          )}

          {booking.status === 'completed' && (
            <>
              <View style={[styles.statusBadge, { backgroundColor: Colors.success + '18', marginLeft: 0 }]}>
                <Check size={12} color={Colors.success} />
                <Text style={[styles.statusText, { color: Colors.success }]}>Completed</Text>
              </View>
              <Pressable style={[styles.chatBtn, { marginLeft: 'auto' }]} onPress={handleChat}>
                <MessageCircle size={14} color={Colors.gold} />
                <Text style={{color: Colors.gold, fontSize: 12, fontWeight: '600', marginLeft: 4}}>Chat</Text>
              </Pressable>
            </>
          )}

          {booking.status === 'cancelled' && (
            <>
              <View style={[styles.statusBadge, { backgroundColor: Colors.error + '18', marginLeft: 0 }]}>
                <X size={12} color={Colors.error} />
                <Text style={[styles.statusText, { color: Colors.error }]}>Cancelled</Text>
              </View>
              <Pressable 
                style={[styles.rescheduleBtn, { marginLeft: 'auto', borderColor: Colors.gold }]} 
                onPress={() => onUpdateStatus(booking.id, 'pending')}
              >
                <RefreshCw size={13} color={Colors.gold} />
                <Text style={styles.rescheduleBtnText}>Re-open</Text>
              </Pressable>
            </>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

export default function AdminBookingsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [filter, setFilter] = useState<FilterType>('all');
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<AdminBooking | null>(null);

  useEffect(() => {
    loadBookings();
  }, [user]);

  const loadBookings = useCallback(async () => {
    try {
      setLoading(true);
      
      if (!user) return;

      const data = await AdminService.bookings.list();

      // Load clients for mapping
      const { data: clients } = await supabase
        .from('clients')
        .select('id, user_id')
        .eq('owner_admin_id', user.id);
      
      const userIdToClientId = new Map((clients || []).map((c: any) => [c.user_id, c.id]));

      // Transform the data to match AdminBooking format
      const transformedBookings: AdminBooking[] = (data || []).map((booking: any) => ({
        id: booking.id,
        clientId: userIdToClientId.get(booking.user_id),
        clientName: booking.user_profiles?.name || 'Unknown Client',
        clientAvatar: booking.user_profiles?.avatar_url || 'https://via.placeholder.com/40x40/333333/FFFFFF?text=?',
        clientPhone: booking.user_profiles?.phone || 'No phone',
        type: 'Session',
        packageName: booking.packages?.name || 'Unknown Package',
        date: booking.date,
        time: booking.time,
        location: booking.location,
        amount: 0, // We'll need to get this from packages table
        depositPaid: false, // We'll need to implement payment tracking
        status: booking.status as 'pending' | 'confirmed' | 'completed' | 'cancelled',
        notes: booking.notes
      }));

      setBookings(transformedBookings);
    } catch (error) {
      console.error('Error loading bookings:', error);
      Alert.alert('Error', 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const handleUpdateStatus = useCallback(async (id: string, status: 'confirmed' | 'cancelled' | 'completed' | 'pending') => {
    try {
      setLoading(true);
      await AdminService.bookings.updateStatus(id, status);
      await loadBookings();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Error', 'Failed to update booking status');
    } finally {
      setLoading(false);
    }
  }, [loadBookings]);

  const handleRescheduleConfirm = useCallback(async (date: string, time: string) => {
    if (!selectedBooking) return;
    try {
      setLoading(true);
      await AdminService.bookings.reschedule(selectedBooking.id, date, time);
      setShowRescheduleModal(false);
      await loadBookings();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error rescheduling:', error);
      Alert.alert('Error', 'Failed to reschedule booking');
    } finally {
      setLoading(false);
    }
  }, [selectedBooking, loadBookings]);

  const filteredBookings = useMemo(() => {
    if (filter === 'all') return bookings;
    return bookings.filter(b => b.status === filter);
  }, [filter, bookings]);

  const counts = useMemo(() => ({
    all: bookings.length,
    pending: bookings.filter(b => b.status === 'pending').length,
    confirmed: bookings.filter(b => b.status === 'confirmed').length,
    completed: bookings.filter(b => b.status === 'completed').length,
    cancelled: bookings.filter(b => b.status === 'cancelled').length,
  }), [bookings]);

  const filters: { key: FilterType; label: string; color: string }[] = [
    { key: 'all', label: 'All', color: Colors.white },
    { key: 'pending', label: 'Pending', color: Colors.warning },
    { key: 'confirmed', label: 'Confirmed', color: Colors.success },
    { key: 'completed', label: 'Completed', color: '#6C9AED' },
    { key: 'cancelled', label: 'Cancelled', color: Colors.error },
  ];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.headerTitle}>Bookings</Text>
        <Text style={styles.headerSub}>{counts.pending} pending · {counts.confirmed} confirmed</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContainer}
        >
          {filters.map((f) => (
            <Pressable
              key={f.key}
              style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
              onPress={() => { setFilter(f.key); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            >
              <Text style={[styles.filterChipText, filter === f.key && { color: f.color }]}>
                {f.label} ({counts[f.key]})
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {filteredBookings.length > 0 ? (
          filteredBookings.map((booking, index) => (
            <BookingCard 
              key={booking.id} 
              booking={booking} 
              index={index}
              onUpdateStatus={handleUpdateStatus}
              onReschedule={(b) => {
                setSelectedBooking(b);
                setShowRescheduleModal(true);
              }}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <CalendarDays size={48} color={Colors.textMuted} />
            <Text style={styles.emptyStateTitle}>No bookings</Text>
            <Text style={styles.emptyStateText}>No {filter !== 'all' ? filter : ''} bookings found</Text>
          </View>
        )}
      </ScrollView>

      {selectedBooking && (
        <RescheduleModal
          visible={showRescheduleModal}
          onClose={() => setShowRescheduleModal(false)}
          onConfirm={handleRescheduleConfirm}
          initialDate={selectedBooking.date}
          initialTime={selectedBooking.time}
        />
      )}
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
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.white,
    marginBottom: 2,
  },
  headerSub: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 14,
  },
  filtersContainer: {
    gap: 8,
    paddingBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    borderColor: Colors.goldMuted,
    backgroundColor: 'rgba(212,175,55,0.08)',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 30,
  },
  bookingCard: {
    backgroundColor: '#141414',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    paddingBottom: 0,
  },
  clientRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  clientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  clientPhone: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  statusBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
  cardBody: {
    padding: 14,
  },
  detailRow: {
    flexDirection: 'row' as const,
    gap: 20,
    marginBottom: 8,
  },
  detailItem: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  packageRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  packageBadge: {
    backgroundColor: Colors.goldMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  packageText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.gold,
  },
  typeBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  amountBox: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 3,
    marginLeft: 'auto',
  },
  amountText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.gold,
  },
  depositWarning: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: 'rgba(243,156,18,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  depositWarningText: {
    fontSize: 11,
    color: Colors.warning,
    fontWeight: '500' as const,
  },
  notes: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 8,
    fontStyle: 'italic' as const,
    lineHeight: 18,
  },
  cardActions: {
    flexDirection: 'row' as const,
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 4,
  },
  confirmBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.success,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  confirmBtnText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.background,
  },
  rescheduleBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: Colors.goldMuted,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  rescheduleBtnText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.gold,
  },
  cancelBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(231,76,60,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 8,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  emptyStateText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 20,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.white,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalCancelText: {
    color: Colors.textMuted,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: Colors.gold,
  },
  modalConfirmText: {
    color: Colors.background,
    fontWeight: '700',
  },
  chatBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
