import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Animated, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import {
  Check,
  X,
  Clock,
  MapPin,
  CalendarDays,
  RefreshCw,
  DollarSign,
  AlertCircle,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

// TODO: Implement Booking type based on DB schema when available
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
};

// Placeholder until Bookings table is implemented
const adminBookings: AdminBooking[] = [];

type FilterType = 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled';

const statusConfig: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  pending: { color: Colors.warning, label: 'Pending', icon: <Clock size={14} color={Colors.warning} /> },
  confirmed: { color: Colors.success, label: 'Confirmed', icon: <Check size={14} color={Colors.success} /> },
  completed: { color: '#6C9AED', label: 'Completed', icon: <Check size={14} color="#6C9AED" /> },
  cancelled: { color: Colors.error, label: 'Cancelled', icon: <X size={14} color={Colors.error} /> },
};

function formatCurrency(amount: number): string {
  return `KES ${amount.toLocaleString()}`;
}

function BookingCard({ booking, index }: { booking: AdminBooking; index: number }) {
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
      { text: 'Confirm', style: 'default' },
    ]);
  }, [booking]);

  const handleReschedule = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Reschedule', `Reschedule ${booking.clientName}'s booking?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reschedule', style: 'default' },
    ]);
  }, [booking]);

  const handleCancel = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert('Cancel Booking', `Cancel ${booking.clientName}'s ${booking.type} booking? This action cannot be undone.`, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Cancel Booking', style: 'destructive' },
    ]);
  }, [booking]);

  return (
    <Pressable
      onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start()}
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

        {(booking.status === 'pending' || booking.status === 'confirmed') && (
          <View style={styles.cardActions}>
            {booking.status === 'pending' && (
              <Pressable style={styles.confirmBtn} onPress={handleConfirm}>
                <Check size={14} color={Colors.background} />
                <Text style={styles.confirmBtnText}>Confirm</Text>
              </Pressable>
            )}
            <Pressable style={styles.rescheduleBtn} onPress={handleReschedule}>
              <RefreshCw size={13} color={Colors.gold} />
              <Text style={styles.rescheduleBtnText}>Reschedule</Text>
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={handleCancel}>
              <X size={13} color={Colors.error} />
            </Pressable>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

export default function AdminBookingsScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<FilterType>('all');

  const filteredBookings = useMemo(() => {
    if (filter === 'all') return adminBookings;
    return adminBookings.filter(b => b.status === filter);
  }, [filter]);

  const counts = useMemo(() => ({
    all: adminBookings.length,
    pending: adminBookings.filter(b => b.status === 'pending').length,
    confirmed: adminBookings.filter(b => b.status === 'confirmed').length,
    completed: adminBookings.filter(b => b.status === 'completed').length,
    cancelled: adminBookings.filter(b => b.status === 'cancelled').length,
  }), []);

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
            <BookingCard key={booking.id} booking={booking} index={index} />
          ))
        ) : (
          <View style={styles.emptyState}>
            <CalendarDays size={48} color={Colors.textMuted} />
            <Text style={styles.emptyStateTitle}>No bookings</Text>
            <Text style={styles.emptyStateText}>No {filter !== 'all' ? filter : ''} bookings found</Text>
          </View>
        )}
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
});
