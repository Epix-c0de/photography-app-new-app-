import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Animated, Alert, Dimensions, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar, MapPin, Clock, Check, Edit3, Camera, ChevronRight, ChevronLeft, Star, Zap, User, Shield } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';

type Package = Database['public']['Tables']['packages']['Row'];
type BookingRow = Database['public']['Tables']['bookings']['Row'];

interface Booking extends BookingRow {
  packages?: {
    name: string;
  } | null;
}

const { width } = Dimensions.get('window');
const CELL_SIZE = (width - 40 - 6 * 8) / 7;

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  booked: { color: '#3498DB', icon: <Calendar size={14} color="#3498DB" />, label: 'Booked' },
  confirmed: { color: Colors.gold, icon: <Check size={14} color={Colors.gold} />, label: 'Confirmed' },
  completed: { color: Colors.success, icon: <Camera size={14} color={Colors.success} />, label: 'Completed' },
  editing: { color: Colors.warning, icon: <Edit3 size={14} color={Colors.warning} />, label: 'Editing' },
  ready: { color: Colors.success, icon: <Check size={14} color={Colors.success} />, label: 'Ready' },
};

function MiniCalendar({ selectedDate, onSelectDate, busyDates = [], availableDates = [] }: { selectedDate: number | null; onSelectDate: (d: number) => void; busyDates?: number[]; availableDates?: number[] }) {
  const [monthOffset, setMonthOffset] = useState<number>(0);

  const now = new Date();
  const viewDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const monthName = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const days = useMemo(() => {
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [firstDay, daysInMonth]);

  const getDayStatus = useCallback((day: number) => {
    if (busyDates.includes(day)) return 'busy';
    if (availableDates.includes(day)) return 'available';
    return 'normal';
  }, [busyDates, availableDates]);

  return (
    <View style={calStyles.calendarContainer}>
      <View style={calStyles.calendarHeader}>
        <Pressable onPress={() => setMonthOffset(p => p - 1)} hitSlop={12}>
          <ChevronLeft size={20} color={Colors.textSecondary} />
        </Pressable>
        <Text style={calStyles.monthTitle}>{monthName}</Text>
        <Pressable onPress={() => setMonthOffset(p => p + 1)} hitSlop={12}>
          <ChevronRight size={20} color={Colors.textSecondary} />
        </Pressable>
      </View>
      <View style={calStyles.weekRow}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <Text key={i} style={calStyles.weekDay}>{d}</Text>
        ))}
      </View>
      <View style={calStyles.daysGrid}>
        {days.map((day, i) => {
          if (day === null) return <View key={`empty-${i}`} style={calStyles.dayCell} />;
          const status = getDayStatus(day);
          const isSelected = day === selectedDate && monthOffset === 0;
          const isBusy = status === 'busy';
          return (
            <Pressable
              key={day}
              style={[
                calStyles.dayCell,
                isSelected && calStyles.dayCellSelected,
                isBusy && calStyles.dayCellBusy,
              ]}
              onPress={() => {
                if (!isBusy) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onSelectDate(day);
                }
              }}
              disabled={isBusy}
            >
              <Text style={[
                calStyles.dayText,
                isSelected && calStyles.dayTextSelected,
                isBusy && calStyles.dayTextBusy,
                status === 'available' && !isSelected && calStyles.dayTextAvailable,
              ]}>
                {day}
              </Text>
              {status === 'available' && !isSelected && <View style={calStyles.availableDot} />}
              {isBusy && <View style={calStyles.busyDot} />}
            </Pressable>
          );
        })}
      </View>
      <View style={calStyles.legend}>
        <View style={calStyles.legendItem}>
          <View style={[calStyles.legendDot, { backgroundColor: Colors.gold }]} />
          <Text style={calStyles.legendText}>Available</Text>
        </View>
        <View style={calStyles.legendItem}>
          <View style={[calStyles.legendDot, { backgroundColor: Colors.error }]} />
          <Text style={calStyles.legendText}>Busy</Text>
        </View>
      </View>
    </View>
  );
}

function PackageCard({ pkg, index, isSelected, onSelect }: { pkg: Package; index: number; isSelected: boolean; onSelect: () => void }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, delay: index * 150, useNativeDriver: true }).start();
  }, [fadeAnim, index]);

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <Pressable
        onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start()}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSelect(); }}
      >
        <Animated.View style={[styles.packageCard, pkg.is_popular && styles.packageCardPopular, isSelected && styles.packageCardSelected, { transform: [{ scale: scaleAnim }] }]}>
          {pkg.is_popular && (
            <View style={styles.popularBadge}>
              <Star size={10} color={Colors.background} fill={Colors.background} />
              <Text style={styles.popularText}>Most Popular</Text>
            </View>
          )}
          <Text style={styles.packageName}>{pkg.name}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.currency}>KES</Text>
            <Text style={styles.price}>{pkg.price.toLocaleString()}</Text>
          </View>
          <Text style={styles.packageDesc}>{pkg.description}</Text>
          <View style={styles.divider} />
          {pkg.features.map((feature, i) => (
            <View key={i} style={styles.featureRow}>
              <Check size={14} color={Colors.gold} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
          <View style={styles.durationRow}>
            <Clock size={14} color={Colors.textMuted} />
            <Text style={styles.durationText}>{pkg.duration}</Text>
          </View>
          <Pressable style={styles.bookButton} onPress={onSelect}>
            <LinearGradient
              colors={isSelected ? [Colors.gold, Colors.goldDark] : pkg.is_popular ? [Colors.gold, Colors.goldDark] : [Colors.card, Colors.cardLight]}
              style={styles.bookButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={[styles.bookButtonText, (pkg.is_popular || isSelected) && styles.bookButtonTextPopular]}>
                {isSelected ? 'Selected ✓' : 'Select Package'}
              </Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

function BookingCard({ booking }: { booking: Booking }) {
  const config = statusConfig[booking.status] || statusConfig.booked;

  return (
    <Pressable style={styles.bookingCard} onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}>
      <View style={styles.bookingHeader}>
        <View style={[styles.statusBadge, { backgroundColor: config.color + '20' }]}>
          {config.icon}
          <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
        </View>
        <Text style={styles.bookingType}>Session</Text>
      </View>
      <Text style={styles.bookingPackage}>{booking.packages?.name || 'Unknown Package'}</Text>
      <View style={styles.bookingDetails}>
        <View style={styles.bookingDetail}>
          <Calendar size={14} color={Colors.textMuted} />
          <Text style={styles.bookingDetailText}>{booking.date}</Text>
        </View>
        <View style={styles.bookingDetail}>
          <Clock size={14} color={Colors.textMuted} />
          <Text style={styles.bookingDetailText}>{booking.time}</Text>
        </View>
        <View style={styles.bookingDetail}>
          <MapPin size={14} color={Colors.textMuted} />
          <Text style={styles.bookingDetailText}>{booking.location}</Text>
        </View>
      </View>
      {booking.status === 'ready' && (
        <Pressable style={styles.downloadBanner}>
          <LinearGradient colors={[Colors.goldMuted, 'rgba(212,175,55,0.05)']} style={styles.downloadBannerGradient}>
            <Zap size={16} color={Colors.gold} />
            <Text style={styles.downloadBannerText}>Your photos are ready!</Text>
            <ChevronRight size={16} color={Colors.gold} />
          </LinearGradient>
        </Pressable>
      )}
    </Pressable>
  );
}

export default function BookingsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<'bookings' | 'packages' | 'book'>('bookings');
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        
        const { data: packagesData } = await supabase
          .from('packages')
          .select('*')
          .order('price');
        
        if (packagesData) setPackages(packagesData);

        if (user) {
          const { data: bookingsData } = await supabase
            .from('bookings')
            .select('*, packages(name)')
            .eq('user_id', user.id)
            .order('date', { ascending: false });
          
          if (bookingsData) setBookings(bookingsData);
        }
      } catch (e) {
        console.error('Error loading booking data:', e);
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, [user]);

  const busyDates = useMemo(() => {
    return bookings.map(b => {
      const d = new Date(b.date);
      return d.getDate();
    });
  }, [bookings]);

  const handleConfirmBooking = useCallback(() => {
    if (!selectedPackage) {
      Alert.alert('Select a Package', 'Please choose a package before booking.');
      return;
    }
    if (!selectedDate) {
      Alert.alert('Select a Date', 'Please pick a date on the calendar.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const pkg = packages.find(p => p.id === selectedPackage);
    Alert.alert(
      'Booking Request Sent!',
      `${pkg?.name} Package on the ${selectedDate}th.\n\nYou won't be charged yet. We'll confirm availability shortly.`,
      [{ text: 'Great!', onPress: () => setActiveSection('bookings') }]
    );
  }, [selectedPackage, selectedDate, packages]);

  const selectedPkg = packages.find(p => p.id === selectedPackage);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.headerTitle}>Bookings</Text>
          <Text style={styles.headerSubtitle}>Book your next session or track existing ones</Text>
        </View>

        <View style={styles.toggleRow}>
          {(['bookings', 'packages', 'book'] as const).map(section => (
            <Pressable
              key={section}
              style={[styles.toggleButton, activeSection === section && styles.toggleActive]}
              onPress={() => { setActiveSection(section); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            >
              <Text style={[styles.toggleText, activeSection === section && styles.toggleTextActive]}>
                {section === 'bookings' ? 'My Bookings' : section === 'packages' ? 'Packages' : 'Book Now'}
              </Text>
            </Pressable>
          ))}
        </View>

        {activeSection === 'bookings' && (
          <View style={styles.bookingsList}>
            <View style={styles.timeline}>
              {bookings.map((booking, index) => (
                <View key={booking.id} style={styles.timelineItem}>
                  <View style={styles.timelineLine}>
                    <View style={[styles.timelineDot, { backgroundColor: statusConfig[booking.status]?.color || Colors.textMuted }]} />
                    {index < bookings.length - 1 && <View style={styles.timelineConnector} />}
                  </View>
                  <View style={styles.timelineContent}>
                    <BookingCard booking={booking} />
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {activeSection === 'packages' && (
          <View style={styles.packagesList}>
            <Text style={styles.packagesNote}>You won&apos;t be charged yet. Free reschedule policy.</Text>
            {packages.map((pkg, index) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                index={index}
                isSelected={selectedPackage === pkg.id}
                onSelect={() => setSelectedPackage(pkg.id)}
              />
            ))}
          </View>
        )}

        {activeSection === 'book' && (
          <View style={styles.bookSection}>
            <MiniCalendar selectedDate={selectedDate} onSelectDate={setSelectedDate} busyDates={busyDates} />

            <View style={styles.bookSectionLabel}>
              <Text style={styles.bookSectionLabelText}>Select Package</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pkgChipsRow}>
              {packages.map(pkg => (
                <Pressable
                  key={pkg.id}
                  style={[styles.pkgChip, selectedPackage === pkg.id && styles.pkgChipSelected]}
                  onPress={() => { setSelectedPackage(pkg.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                >
                  <Text style={[styles.pkgChipName, selectedPackage === pkg.id && styles.pkgChipNameSelected]}>{pkg.name}</Text>
                  <Text style={[styles.pkgChipPrice, selectedPackage === pkg.id && styles.pkgChipPriceSelected]}>KES {pkg.price.toLocaleString()}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {selectedPkg && selectedDate && (
              <View style={styles.bookingSummary}>
                <Text style={styles.summaryTitle}>Booking Summary</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Package</Text>
                  <Text style={styles.summaryValue}>{selectedPkg.name}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Date</Text>
                  <Text style={styles.summaryValue}>{selectedDate}th of this month</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Duration</Text>
                  <Text style={styles.summaryValue}>{selectedPkg.duration}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total</Text>
                  <Text style={styles.summaryTotal}>KES {selectedPkg.price.toLocaleString()}</Text>
                </View>
              </View>
            )}

            <View style={styles.trustSignals}>
              <View style={styles.trustSignal}>
                <Shield size={14} color={Colors.gold} />
                <Text style={styles.trustSignalText}>Free reschedule</Text>
              </View>
              <View style={styles.trustSignal}>
                <User size={14} color={Colors.gold} />
                <Text style={styles.trustSignalText}>No hidden fees</Text>
              </View>
            </View>

            <Pressable
              style={[styles.confirmBookingButton, (!selectedPackage || !selectedDate) && styles.confirmBookingButtonDisabled]}
              onPress={handleConfirmBooking}
              disabled={!selectedPackage || !selectedDate}
            >
              <LinearGradient
                colors={selectedPackage && selectedDate ? [Colors.gold, Colors.goldDark] : [Colors.card, Colors.cardLight]}
                style={styles.confirmBookingGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Camera size={18} color={selectedPackage && selectedDate ? Colors.background : Colors.textMuted} />
                <Text style={[styles.confirmBookingText, (!selectedPackage || !selectedDate) && styles.confirmBookingTextDisabled]}>
                  Confirm Booking
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const calStyles = StyleSheet.create({
  calendarContainer: {
    marginHorizontal: 20,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  calendarHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  weekRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  weekDay: {
    width: CELL_SIZE,
    textAlign: 'center' as const,
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  daysGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    justifyContent: 'flex-start',
  },
  dayCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
    borderRadius: CELL_SIZE / 2,
  },
  dayCellSelected: {
    backgroundColor: Colors.gold,
  },
  dayCellBusy: {
    opacity: 0.4,
  },
  dayText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  dayTextSelected: {
    color: Colors.background,
    fontWeight: '700' as const,
  },
  dayTextBusy: {
    color: Colors.textMuted,
    textDecorationLine: 'line-through' as const,
  },
  dayTextAvailable: {
    color: Colors.white,
  },
  availableDot: {
    position: 'absolute' as const,
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.gold,
  },
  busyDot: {
    position: 'absolute' as const,
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.error,
  },
  legend: {
    flexDirection: 'row' as const,
    justifyContent: 'center',
    gap: 20,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
  legendItem: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.white,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  toggleRow: {
    flexDirection: 'row' as const,
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 20,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.card,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toggleActive: {
    backgroundColor: Colors.goldMuted,
    borderColor: Colors.gold,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  toggleTextActive: {
    color: Colors.gold,
  },
  bookingsList: {
    paddingHorizontal: 20,
  },
  timeline: {
    gap: 0,
  },
  timelineItem: {
    flexDirection: 'row' as const,
  },
  timelineLine: {
    width: 24,
    alignItems: 'center',
    paddingTop: 6,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timelineConnector: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.border,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 16,
    paddingLeft: 8,
  },
  bookingCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bookingHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statusBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  bookingType: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  bookingPackage: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
    marginBottom: 12,
  },
  bookingDetails: {
    gap: 8,
  },
  bookingDetail: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 8,
  },
  bookingDetailText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  downloadBanner: {
    marginTop: 12,
    borderRadius: 10,
    overflow: 'hidden' as const,
  },
  downloadBannerGradient: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  downloadBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.gold,
  },
  packagesList: {
    paddingHorizontal: 20,
    gap: 16,
  },
  packagesNote: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    marginBottom: 8,
  },
  packageCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  packageCardPopular: {
    borderColor: Colors.gold,
  },
  packageCardSelected: {
    borderColor: Colors.gold,
    borderWidth: 2,
  },
  popularBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.gold,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start' as const,
    marginBottom: 12,
  },
  popularText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.background,
    textTransform: 'uppercase' as const,
  },
  packageName: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.white,
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row' as const,
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 8,
  },
  currency: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  price: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.gold,
  },
  packageDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 14,
  },
  featureRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  featureText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  durationRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  durationText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  bookButton: {
    borderRadius: 12,
    overflow: 'hidden' as const,
  },
  bookButtonGradient: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  bookButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  bookButtonTextPopular: {
    color: Colors.background,
  },
  bookSection: {
    paddingBottom: 20,
  },
  bookSectionLabel: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  bookSectionLabelText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  pkgChipsRow: {
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 20,
  },
  pkgChip: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    minWidth: 120,
  },
  pkgChipSelected: {
    borderColor: Colors.gold,
    backgroundColor: Colors.goldMuted,
  },
  pkgChipName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  pkgChipNameSelected: {
    color: Colors.gold,
  },
  pkgChipPrice: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  pkgChipPriceSelected: {
    color: Colors.gold,
  },
  bookingSummary: {
    marginHorizontal: 20,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.white,
  },
  summaryDivider: {
    height: 0.5,
    backgroundColor: Colors.border,
    marginVertical: 8,
  },
  summaryTotal: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.gold,
  },
  trustSignals: {
    flexDirection: 'row' as const,
    justifyContent: 'center',
    gap: 24,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  trustSignal: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 6,
  },
  trustSignalText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  confirmBookingButton: {
    marginHorizontal: 20,
    borderRadius: 14,
    overflow: 'hidden' as const,
  },
  confirmBookingButtonDisabled: {
    opacity: 0.6,
  },
  confirmBookingGradient: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    gap: 10,
  },
  confirmBookingText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.background,
  },
  confirmBookingTextDisabled: {
    color: Colors.textMuted,
  },
});
