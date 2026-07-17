import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Animated, Alert, Dimensions, ActivityIndicator, Platform, TextInput, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar, MapPin, Clock, Check, Edit3, Camera, ChevronRight, ChevronLeft, Star, Zap, User, Shield, Smartphone, X, Image as ImageIcon, ArrowRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { demoBookings, demoPackages } from '@/lib/demo';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';
import { useAssignmentStatus } from '@/hooks/useAssignmentStatus';
import UnassignedEmptyState from '@/components/UnassignedEmptyState';

type DBPackage = Database['public']['Tables']['packages']['Row'];
type Package = Omit<DBPackage, 'features'> & {
  is_popular?: boolean;
  description?: string | null;
  detailed_description?: string | null;
  duration?: string | null;
  cover_image_url?: string | null;
  features: string[];
  // Admin profile joined
  admin_profile?: { id: string; name: string | null; avatar_url: string | null } | null;
};
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
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, delay: index * 100, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, delay: index * 100, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
  }, [fadeAnim, slideAnim, index]);

  const admin = pkg.admin_profile;

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>
      <Pressable
        onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: Platform.OS !== 'web' }).start()}
        onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: Platform.OS !== 'web' }).start()}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSelect(); }}
      >
        <Animated.View style={[styles.packageCard, pkg.is_popular && styles.packageCardPopular, isSelected && styles.packageCardSelected, { transform: [{ scale: scaleAnim }] }]}>
          {pkg.is_popular && (
            <View style={styles.popularBadge}>
              <Star size={10} color={Colors.background} fill={Colors.background} />
              <Text style={styles.popularText}>Most Popular</Text>
            </View>
          )}
          
          {/* Cover Image Section */}
          {pkg.cover_image_url ? (
            <View style={styles.coverImageContainer}>
              <Image
                source={{ uri: pkg.cover_image_url }}
                style={styles.coverImage}
                contentFit="cover"
                cachePolicy="memory-disk"
                priority="high"
              />
            </View>
          ) : (
            <View style={styles.placeholderContainer}>
              <ImageIcon size={40} color={Colors.textMuted} />
              <Text style={styles.placeholderText}>No Cover Image</Text>
            </View>
          )}
          
          <View style={styles.packageContent}>
            {/* Admin attribution */}
            {admin && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.12)' }}>
                {admin.avatar_url ? (
                  <Image
                    source={{ uri: admin.avatar_url }}
                    style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)' }}
                    contentFit="cover"
                  />
                ) : (
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(212,175,55,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 10, color: Colors.gold, fontWeight: '700' }}>
                      {(admin.name || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={{ fontSize: 11, color: Colors.textMuted, fontWeight: '600' }} numberOfLines={1}>
                  {admin.name || 'Photographer'}
                </Text>
              </View>
            )}
            <Text style={styles.packageName}>{pkg.name}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.currency}>KES</Text>
              <Text style={styles.price}>{pkg.price.toLocaleString()}</Text>
            </View>
            <Text style={styles.packageDesc}>{pkg.description || pkg.detailed_description || 'No description'}</Text>
            {pkg.detailed_description && (
              <Text style={styles.packageDetailedDesc} numberOfLines={3}>{pkg.detailed_description}</Text>
            )}
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
                  {isSelected ? 'Selected' : 'Select Package'}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
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
  const searchParams = useLocalSearchParams<{ section?: string }>();
  const router = useRouter();
  const { user, isDemoMode } = useAuth();
  const { isAssigned, loading: assignmentLoading } = useAssignmentStatus();
  const [activeSection, setActiveSection] = useState<'bookings' | 'packages' | 'book'>('bookings');
  
  useEffect(() => {
    const section = searchParams.section;
    if (section === 'packages' || section === 'bookings' || section === 'book') {
      setActiveSection(section);
    }
  }, [searchParams.section]);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const [bookingStep, setBookingStep] = useState<number>(1);
  const [bookingTime, setBookingTime] = useState<string>('');
  const [bookingLocation, setBookingLocation] = useState<string>('');
  const stepAnim = useRef(new Animated.Value(0)).current;
  const prevStepRef = useRef(1);  const [packages, setPackages] = useState<Package[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  // Multi-admin dropdown state
  const [linkedAdmins, setLinkedAdmins] = useState<Array<{ id: string; name: string | null; avatar_url: string | null }>>([]);
  const [selectedAdminId, setSelectedAdminId] = useState<string | null>(null);
  const [showAdminDropdown, setShowAdminDropdown] = useState(false);
  const hasMultipleAdmins = linkedAdmins.length > 1;
  
  // Scroll refs for packages
  const packagesScrollRef = useRef<ScrollView>(null);
  const bookPackagesScrollRef = useRef<ScrollView>(null);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);
  
  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentPhone, setPaymentPhone] = useState('');
  const [paymentState, setPaymentState] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [pendingBookingId, setPendingBookingId] = useState<string | null>(null);

  const advanceStep = useCallback((toStep: number) => {
    const fromStep = prevStepRef.current;
    if (fromStep === toStep) return;
    prevStepRef.current = toStep;

    // Slide out current step to the left
    stepAnim.setValue(0);
    Animated.timing(stepAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      setBookingStep(toStep);
      // Slide in new step from the right
      stepAnim.setValue(-1);
      Animated.spring(stepAnim, {
        toValue: 0,
        tension: 65,
        friction: 11,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    });
  }, [stepAnim]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        if (isDemoMode) {
          setPackages(demoPackages as Package[]);
          setBookings(demoBookings as Booking[]);
          return;
        }

        // 1. Get all admins this user is linked to
        let myAdminIds: string[] = [];
        if (user) {
          const { data: myClients } = await supabase
            .from('clients')
            .select('owner_admin_id')
            .eq('user_id', user.id);
          myAdminIds = Array.from(
            new Set((myClients || []).map((c: any) => c.owner_admin_id).filter(Boolean))
          ) as string[];
        }

        // 2. Fetch admin profiles for the dropdown
        if (myAdminIds.length > 0) {
          const { data: adminProfiles } = await supabase
            .from('user_profiles')
            .select('id, name, avatar_url')
            .in('id', myAdminIds);
          const admins = adminProfiles || [];
          setLinkedAdmins(admins);

          // Auto-select: if only one admin, select it; otherwise keep null (show dropdown)
          if (admins.length === 1) {
            setSelectedAdminId(admins[0].id);
          }
        }

        // 3. Fetch packages — filter to user's linked admins (or all active if unlinked)
        const pkgQuery = supabase
          .from('packages')
          .select(`
            *,
            user_profiles:owner_admin_id (id, name, avatar_url)
          `)
          .eq('is_active', true)
          .order('price');

        // Only filter by admin if the user has linked admins
        const finalQuery = myAdminIds.length > 0
          ? pkgQuery.in('owner_admin_id', myAdminIds)
          : pkgQuery;

        const { data: packagesData } = await finalQuery;

        if (packagesData) {
          const normalized = packagesData.map((p: any) => ({
            ...p,
            is_popular: p.is_popular === true,
            description: p.description ?? null,
            detailed_description: p.detailed_description ?? null,
            duration: p.duration ?? null,
            cover_image_url: p.cover_image_url ?? null,
            features: Array.isArray(p.features) ? (p.features as string[]) : [],
            admin_profile: p.user_profiles ?? null,
          }));
          setPackages(normalized);
        }

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
  }, [isDemoMode, user]);

  // Check if packages need scroll indicator
  useEffect(() => {
    if (packages.length > 1) {
      setShowScrollIndicator(true);
    }
  }, [packages]);

  // Scroll to end function
  const scrollToPackagesEnd = useCallback(() => {
    if (packagesScrollRef.current) {
      packagesScrollRef.current.scrollToEnd({ animated: true });
    }
    if (bookPackagesScrollRef.current) {
      bookPackagesScrollRef.current.scrollToEnd({ animated: true });
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const busyDates = useMemo(() => {
    return bookings.map(b => {
      const d = new Date(b.date);
      return d.getDate();
    });
  }, [bookings]);

  // Handle M-Pesa payment for booking deposit
  const handlePaymentSubmit = useCallback(async () => {
    if (!paymentPhone || paymentPhone.length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid M-Pesa phone number (e.g., 254712345678)');
      return;
    }

    setPaymentState('processing');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const pkg = packages.find(p => p.id === selectedPackage);
      const depositAmount = Math.round((pkg?.price || 0) * 0.2); // 20% deposit

      if (isDemoMode) {
        const now = new Date();
        const bookingDate = `${selectedDate}${getOrdinalSuffix(selectedDate)} of ${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`;
        const demoBooking: Booking = {
          id: `demo-booking-${Date.now()}`,
          user_id: user?.id ?? 'demo-user',
          package_id: selectedPackage,
          status: 'confirmed',
          date: bookingDate,
          time: bookingTime || 'TBD',
          location: bookingLocation || 'TBD',
          created_at: new Date().toISOString(),
          packages: {
            name: pkg?.name ?? 'Selected Package',
          },
        };
        setBookings((prev) => [demoBooking, ...prev]);
        setPaymentState('success');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => {
          setShowPaymentModal(false);
          setActiveSection('bookings');
          setPaymentState('idle');
          setPaymentPhone('');
        }, 1200);
        return;
      }

      // Trigger STK Push via Edge Function
      // Pass the admin's owner_admin_id so payment routes to the correct photographer
      const adminId = pkg?.owner_admin_id ?? selectedAdminId;

      const { data, error } = await supabase.functions.invoke('stk_push', {
        body: {
          phone_number: paymentPhone,
          amount: depositAmount,
          reference: `Booking-${selectedPackage}-${selectedDate}`,
          description: `Deposit for ${pkg?.name} package`,
          owner_admin_id: adminId ?? null,
        },
      });

      if (error) throw error;

      // Create booking after payment initiated
      const now = new Date();
      const bookingDate = `${selectedDate}${getOrdinalSuffix(selectedDate)} of ${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`;
      
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          user_id: user?.id,
          package_id: selectedPackage,
          status: 'booked',
          date: bookingDate,
          time: bookingTime || 'TBD',
          location: bookingLocation || 'TBD',
          payment_phone: paymentPhone,
          deposit_amount: depositAmount,
          owner_admin_id: adminId ?? null,
        })
        .select()
        .single();

      if (bookingError) throw bookingError;
      setPendingBookingId(bookingData.id);

      // Poll for payment status
      pollPaymentStatus(bookingData.id);

    } catch (e: any) {
      console.error('Payment failed:', e);
      setPaymentState('error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [bookingLocation, bookingTime, isDemoMode, packages, paymentPhone, selectedDate, selectedPackage, user]);

  // Poll for payment status
  const pollPaymentStatus = useCallback(async (bookingId: string) => {
    if (isDemoMode) return;
    const maxAttempts = 30;
    let attempts = 0;

    const checkStatus = async () => {
      try {
        const { data } = await supabase
          .from('bookings')
          .select('status')
          .eq('id', bookingId)
          .single();

        if (data?.status === 'confirmed') {
          setPaymentState('success');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          
          // Reload bookings
          const { data: bookingsData } = await supabase
            .from('bookings')
            .select('*, packages(name)')
            .eq('user_id', user?.id)
            .order('date', { ascending: false });
          if (bookingsData) setBookings(bookingsData);
          
          setTimeout(() => {
            setShowPaymentModal(false);
            setActiveSection('bookings');
            setPaymentState('idle');
            setPaymentPhone('');
          }, 2000);
          return;
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 3000);
        } else {
          setPaymentState('error');
        }
      } catch (e) {
        console.error('Error checking payment status:', e);
        setPaymentState('error');
      }
    };

    checkStatus();
  }, [isDemoMode, user]);

  const handleConfirmBooking = useCallback(async () => {
    if (!selectedPackage) {
      Alert.alert('Select a Package', 'Please choose a package before booking.');
      return;
    }
    if (!selectedDate) {
      Alert.alert('Select a Date', 'Please pick a date on the calendar.');
      return;
    }

    // Show payment modal instead of direct booking
    const pkg = packages.find(p => p.id === selectedPackage);
    const depositAmount = Math.round((pkg?.price || 0) * 0.2);
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPaymentPhone(user?.user_metadata?.phone || '');
    setShowPaymentModal(true);
  }, [selectedPackage, selectedDate, packages, user]);

  const selectedPkg = packages.find(p => p.id === selectedPackage);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  // Show unassigned state fast — while assignment is loading, show spinner.
  // Once confirmed unassigned, show the card immediately (no data fetches run).
  if (!isDemoMode) {
    if (assignmentLoading) {
      return (
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color={Colors.gold} />
        </View>
      );
    }
    if (!isAssigned) {
      return <UnassignedEmptyState featureName="bookings and packages" />;
    }
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Bookings</Text>
        <Text style={styles.headerSubtitle}>Book your next session or track existing ones</Text>
      </View>

      <View style={styles.toggleRow}>
        {(['bookings', 'packages', 'book'] as const).map(section => (
          <Pressable
            key={section}
            style={[styles.toggleButton, activeSection === section && styles.toggleActive]}
            onPress={() => { 
              setActiveSection(section); 
              if (section === 'book') advanceStep(1);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); 
            }}
          >
            <Text style={[styles.toggleText, activeSection === section && styles.toggleTextActive]}>
              {section === 'bookings' ? 'My Bookings' : section === 'packages' ? 'Packages' : 'Book Now'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 120, 160) }}>
        {activeSection === 'bookings' && (
          <View style={styles.bookingsList}>
            {bookings.length === 0 ? (
              <View style={styles.emptyBookingsContainer}>
                <View style={styles.emptyBookingsIconWrapper}>
                  <Calendar size={32} color={Colors.gold} />
                </View>
                <Text style={styles.emptyBookingsTitle}>No bookings yet</Text>
                <Text style={styles.emptyBookingsDesc}>
                  You don't have any upcoming or past sessions. Let's create some magic together!
                </Text>
                <View style={styles.emptyBookingsActions}>
                  <Pressable 
                    style={styles.emptyBookingsPrimaryBtn}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setActiveSection('book');
                      advanceStep(1);
                    }}
                  >
                    <Text style={styles.emptyBookingsPrimaryBtnText}>Book Now</Text>
                  </Pressable>
                  <Pressable 
                    style={styles.emptyBookingsSecondaryBtn}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push('/(tabs)/chat');
                    }}
                  >
                    <Text style={styles.emptyBookingsSecondaryBtnText}>Custom Booking</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
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
            )}
          </View>
        )}

        {activeSection === 'packages' && (
          <View style={styles.packagesList}>
            <Text style={styles.packagesNote}>You won&apos;t be charged yet. Free reschedule policy.</Text>

            {/* Admin dropdown — only shown when user has multiple photographers */}
            {hasMultipleAdmins && (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 12, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                  Filter by Photographer
                </Text>
                <Pressable
                  onPress={() => setShowAdminDropdown(prev => !prev)}
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: showAdminDropdown ? Colors.gold : 'rgba(255,255,255,0.08)', gap: 10 }}
                >
                  {/* Selected admin avatar */}
                  {(() => {
                    const admin = selectedAdminId ? linkedAdmins.find(a => a.id === selectedAdminId) : null;
                    return admin?.avatar_url ? (
                      <Image source={{ uri: admin.avatar_url }} style={{ width: 28, height: 28, borderRadius: 14 }} contentFit="cover" />
                    ) : (
                      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(212,175,55,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 12, color: Colors.gold, fontWeight: '700' }}>
                          {admin ? (admin.name || '?').charAt(0).toUpperCase() : '◈'}
                        </Text>
                      </View>
                    );
                  })()}
                  <Text style={{ flex: 1, color: Colors.white, fontSize: 14, fontWeight: '600' }}>
                    {selectedAdminId
                      ? (linkedAdmins.find(a => a.id === selectedAdminId)?.name || 'Photographer')
                      : 'All Photographers'}
                  </Text>
                  <ChevronRight size={16} color={Colors.textMuted} style={{ transform: [{ rotate: showAdminDropdown ? '90deg' : '0deg' }] }} />
                </Pressable>

                {showAdminDropdown && (
                  <View style={{ marginTop: 4, backgroundColor: Colors.card, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                    {/* "All" option */}
                    <Pressable
                      onPress={() => { setSelectedAdminId(null); setShowAdminDropdown(false); setSelectedPackage(null); }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', backgroundColor: !selectedAdminId ? 'rgba(212,175,55,0.08)' : 'transparent' }}
                    >
                      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(212,175,55,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 14, color: Colors.gold }}>◈</Text>
                      </View>
                      <Text style={{ color: !selectedAdminId ? Colors.gold : Colors.white, fontWeight: '600', fontSize: 14 }}>All Photographers</Text>
                      {!selectedAdminId && <Check size={14} color={Colors.gold} style={{ marginLeft: 'auto' }} />}
                    </Pressable>
                    {linkedAdmins.map((admin, i) => (
                      <Pressable
                        key={admin.id}
                        onPress={() => { setSelectedAdminId(admin.id); setShowAdminDropdown(false); setSelectedPackage(null); }}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: i < linkedAdmins.length - 1 ? 1 : 0, borderBottomColor: 'rgba(255,255,255,0.05)', backgroundColor: selectedAdminId === admin.id ? 'rgba(212,175,55,0.08)' : 'transparent' }}
                      >
                        {admin.avatar_url ? (
                          <Image source={{ uri: admin.avatar_url }} style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' }} contentFit="cover" />
                        ) : (
                          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(212,175,55,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 12, color: Colors.gold, fontWeight: '700' }}>
                              {(admin.name || '?').charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <Text style={{ flex: 1, color: selectedAdminId === admin.id ? Colors.gold : Colors.white, fontWeight: '600', fontSize: 14 }}>
                          {admin.name || 'Photographer'}
                        </Text>
                        {selectedAdminId === admin.id && <Check size={14} color={Colors.gold} />}
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Package list — filtered by selected admin if dropdown is active */}
            {packages
              .filter(pkg => !selectedAdminId || pkg.owner_admin_id === selectedAdminId)
              .map((pkg, index) => (
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
            <View style={styles.stepperContainer}>
              {[1, 2, 3, 4].map(step => (
                <View key={step} style={styles.stepperStep}>
                  <View style={[styles.stepperCircle, bookingStep >= step && styles.stepperCircleActive]}>
                    {bookingStep > step ? (
                      <Check size={12} color={Colors.background} />
                    ) : (
                      <Text style={[styles.stepperNum, bookingStep >= step && styles.stepperNumActive]}>{step}</Text>
                    )}
                  </View>
                  <Text style={[styles.stepperLabel, bookingStep >= step && styles.stepperLabelActive]}>
                    {step === 1 ? 'Package' : step === 2 ? 'Date' : step === 3 ? 'Details' : 'Review'}
                  </Text>
                  {step < 4 && <View style={[styles.stepperLine, bookingStep > step && styles.stepperLineActive]} />}
                </View>
              ))}
            </View>

            {bookingStep === 1 && (
              <Animated.View style={[styles.stepContent, {
                transform: [{
                  translateX: stepAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -400],
                  }),
                }],
              }]}>
                <Text style={styles.stepTitle}>Select a Package</Text>

                {/* Admin dropdown — only shown when user has multiple photographers */}
                {hasMultipleAdmins && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 12, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                      Photographer
                    </Text>
                    <Pressable
                      onPress={() => setShowAdminDropdown(prev => !prev)}
                      style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: showAdminDropdown ? Colors.gold : 'rgba(255,255,255,0.08)', gap: 10 }}
                    >
                      {(() => {
                        const admin = selectedAdminId ? linkedAdmins.find(a => a.id === selectedAdminId) : null;
                        return admin?.avatar_url ? (
                          <Image source={{ uri: admin.avatar_url }} style={{ width: 24, height: 24, borderRadius: 12 }} contentFit="cover" />
                        ) : (
                          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(212,175,55,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 10, color: Colors.gold, fontWeight: '700' }}>
                              {admin ? (admin.name || '?').charAt(0).toUpperCase() : '◈'}
                            </Text>
                          </View>
                        );
                      })()}
                      <Text style={{ flex: 1, color: Colors.white, fontSize: 14, fontWeight: '600' }}>
                        {selectedAdminId ? (linkedAdmins.find(a => a.id === selectedAdminId)?.name || 'Photographer') : 'All Photographers'}
                      </Text>
                      <ChevronRight size={16} color={Colors.textMuted} style={{ transform: [{ rotate: showAdminDropdown ? '90deg' : '0deg' }] }} />
                    </Pressable>
                    {showAdminDropdown && (
                      <View style={{ marginTop: 4, backgroundColor: Colors.card, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                        <Pressable onPress={() => { setSelectedAdminId(null); setShowAdminDropdown(false); setSelectedPackage(null); }}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', backgroundColor: !selectedAdminId ? 'rgba(212,175,55,0.08)' : 'transparent' }}>
                          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(212,175,55,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 12, color: Colors.gold }}>◈</Text>
                          </View>
                          <Text style={{ color: !selectedAdminId ? Colors.gold : Colors.white, fontWeight: '600', fontSize: 14 }}>All</Text>
                          {!selectedAdminId && <Check size={14} color={Colors.gold} style={{ marginLeft: 'auto' }} />}
                        </Pressable>
                        {linkedAdmins.map((admin, i) => (
                          <Pressable key={admin.id} onPress={() => { setSelectedAdminId(admin.id); setShowAdminDropdown(false); setSelectedPackage(null); }}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: i < linkedAdmins.length - 1 ? 1 : 0, borderBottomColor: 'rgba(255,255,255,0.05)', backgroundColor: selectedAdminId === admin.id ? 'rgba(212,175,55,0.08)' : 'transparent' }}>
                            {admin.avatar_url
                              ? <Image source={{ uri: admin.avatar_url }} style={{ width: 24, height: 24, borderRadius: 12 }} contentFit="cover" />
                              : <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(212,175,55,0.15)', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 10, color: Colors.gold, fontWeight: '700' }}>{(admin.name || '?').charAt(0).toUpperCase()}</Text></View>}
                            <Text style={{ flex: 1, color: selectedAdminId === admin.id ? Colors.gold : Colors.white, fontWeight: '600', fontSize: 14 }}>{admin.name || 'Photographer'}</Text>
                            {selectedAdminId === admin.id && <Check size={14} color={Colors.gold} />}
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                {packages
                  .filter(pkg => !selectedAdminId || pkg.owner_admin_id === selectedAdminId)
                  .map((pkg, index) => (
                    <PackageCard
                      key={pkg.id}
                      pkg={pkg}
                      index={index}
                      isSelected={selectedPackage === pkg.id}
                      onSelect={() => {
                        setSelectedPackage(pkg.id);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        setTimeout(() => advanceStep(2), 400);
                      }}
                    />
                  ))}
              </Animated.View>
            )}

            {bookingStep === 2 && (
              <Animated.View style={[styles.stepContent, {
                transform: [{
                  translateX: stepAnim.interpolate({
                    inputRange: [-1, 0, 1],
                    outputRange: [400, 0, -400],
                  }),
                }],
              }]}>
                <Text style={styles.stepTitle}>Select a Date</Text>
                <MiniCalendar
                  selectedDate={selectedDate}
                  onSelectDate={(day) => {
                    setSelectedDate(day);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setTimeout(() => advanceStep(3), 400);
                  }}
                  busyDates={busyDates}
                />
                <View style={styles.wizardRow}>
                  <Pressable style={styles.wizardBackButton} onPress={() => advanceStep(1)}>
                    <Text style={styles.wizardBackText}>Back</Text>
                  </Pressable>
                </View>
              </Animated.View>
            )}

            {bookingStep === 3 && (
              <Animated.View style={[styles.stepContent, {
                transform: [{
                  translateX: stepAnim.interpolate({
                    inputRange: [-1, 0, 1],
                    outputRange: [400, 0, -400],
                  }),
                }],
              }]}>
                <Text style={styles.stepTitle}>Shoot Details</Text>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Preferred Time (Optional)</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. 10:00 AM, Morning, Golden Hour"
                    placeholderTextColor={Colors.textMuted}
                    value={bookingTime}
                    onChangeText={setBookingTime}
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Location (Optional)</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. Studio, CBD, Outside town"
                    placeholderTextColor={Colors.textMuted}
                    value={bookingLocation}
                    onChangeText={setBookingLocation}
                  />
                </View>
                <View style={styles.wizardRow}>
                  <Pressable style={styles.wizardBackButton} onPress={() => advanceStep(2)}>
                    <Text style={styles.wizardBackText}>Back</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.wizardButton, { flex: 1 }]}
                    onPress={() => advanceStep(4)}
                  >
                    <Text style={styles.wizardButtonText}>Next: Review</Text>
                  </Pressable>
                </View>
              </Animated.View>
            )}

            {bookingStep === 4 && selectedPkg && selectedDate && (
              <Animated.View style={[styles.stepContent, {
                transform: [{
                  translateX: stepAnim.interpolate({
                    inputRange: [-1, 0, 1],
                    outputRange: [400, 0, -400],
                  }),
                }],
              }]}>
                <Text style={styles.stepTitle}>Review Booking</Text>
                <View style={styles.bookingSummary}>
                  <Text style={styles.summaryTitle}>Booking Summary</Text>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Package</Text>
                    <Text style={styles.summaryValue}>{selectedPkg.name}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Date</Text>
                    <Text style={styles.summaryValue}>{selectedDate}{getOrdinalSuffix(selectedDate)} of this month</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Time</Text>
                    <Text style={styles.summaryValue}>{bookingTime || 'To be discussed'}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Location</Text>
                    <Text style={styles.summaryValue}>{bookingLocation || 'To be discussed'}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Duration</Text>
                    <Text style={styles.summaryValue}>{selectedPkg.duration}</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Total Amount</Text>
                    <Text style={styles.summaryTotal}>KES {selectedPkg.price.toLocaleString()}</Text>
                  </View>
                </View>

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

                <View style={styles.wizardRow}>
                  <Pressable style={styles.wizardBackButton} onPress={() => advanceStep(3)}>
                    <Text style={styles.wizardBackText}>Back</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.payDepositButton, (!selectedPackage || !selectedDate) && styles.confirmBookingButtonDisabled]}
                    onPress={() => {
                      if (!selectedPackage || !selectedDate) return;
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setShowPaymentModal(true);
                    }}
                    disabled={!selectedPackage || !selectedDate}
                  >
                    <LinearGradient
                      colors={[Colors.gold, Colors.goldDark]}
                      style={styles.payDepositGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Smartphone size={18} color={Colors.white} />
                      <Text style={styles.confirmBookingText}>Book & Pay</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              </Animated.View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Payment Modal */}
      <Modal
        visible={showPaymentModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (paymentState !== 'processing') {
            setShowPaymentModal(false);
            setPaymentState('idle');
          }
        }}
      >
        <View style={paymentStyles.modalOverlay}>
          <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={paymentStyles.modalContent}>
            {paymentState === 'idle' && (
              <>
                <Text style={paymentStyles.modalTitle}>Complete Booking</Text>
                <Text style={paymentStyles.modalSubtitle}>
                  A 20% deposit is required to secure your date
                </Text>
                
                <View style={paymentStyles.depositInfo}>
                  <Text style={paymentStyles.depositLabel}>Deposit Amount</Text>
                  <Text style={paymentStyles.depositAmount}>
                    KES {Math.round((selectedPkg?.price || 0) * 0.2).toLocaleString()}
                  </Text>
                </View>

                <TextInput
                  style={paymentStyles.phoneInput}
                  placeholder="M-Pesa Phone Number"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="phone-pad"
                  value={paymentPhone}
                  onChangeText={setPaymentPhone}
                  maxLength={12}
                />

                <Pressable 
                  style={[paymentStyles.payButton, !paymentPhone && paymentStyles.payButtonDisabled]}
                  onPress={handlePaymentSubmit}
                  disabled={!paymentPhone || paymentPhone.length < 10}
                >
                  <LinearGradient
                    colors={[Colors.gold, Colors.goldDark]}
                    style={paymentStyles.payButtonGradient}
                  >
                    <Smartphone size={18} color={Colors.background} />
                    <Text style={paymentStyles.payButtonText}>Pay with M-Pesa</Text>
                  </LinearGradient>
                </Pressable>

                <Pressable 
                  style={paymentStyles.cancelButton}
                  onPress={() => {
                    setShowPaymentModal(false);
                    setPaymentState('idle');
                  }}
                >
                  <Text style={paymentStyles.cancelButtonText}>Cancel</Text>
                </Pressable>
              </>
            )}

            {paymentState === 'processing' && (
              <View style={paymentStyles.processingContainer}>
                <ActivityIndicator size="large" color={Colors.gold} />
                <Text style={paymentStyles.processingText}>Processing Payment...</Text>
                <Text style={paymentStyles.processingSubtext}>
                  Check your phone for the M-Pesa prompt
                </Text>
              </View>
            )}

            {paymentState === 'success' && (
              <View style={paymentStyles.successContainer}>
                <View style={paymentStyles.successIcon}>
                  <Check size={40} color={Colors.background} />
                </View>
                <Text style={paymentStyles.successText}>Payment Successful!</Text>
                <Text style={paymentStyles.successSubtext}>
                  Your booking has been confirmed
                </Text>
              </View>
            )}

            {paymentState === 'error' && (
              <View style={paymentStyles.errorContainer}>
                <Text style={paymentStyles.errorText}>Payment Failed</Text>
                <Text style={paymentStyles.errorSubtext}>
                  Please try again or contact support
                </Text>
                <Pressable 
                  style={paymentStyles.retryButton}
                  onPress={() => setPaymentState('idle')}
                >
                  <Text style={paymentStyles.retryButtonText}>Try Again</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const paymentStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalContent: {
    width: '100%',
    backgroundColor: Colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  depositInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  depositLabel: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
  },
  depositAmount: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.gold,
  },
  phoneInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.white,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  payButton: {
    borderRadius: 16,
    overflow: 'hidden' as const,
    marginBottom: 16,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  payButtonDisabled: {
    opacity: 0.5,
  },
  payButtonGradient: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  payButtonText: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.background,
  },
  cancelButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  processingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  processingText: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.white,
    marginTop: 24,
    marginBottom: 10,
  },
  processingSubtext: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 24,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  successIcon: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  successText: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: Colors.white,
    marginBottom: 10,
  },
  successSubtext: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  errorText: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.error,
    marginBottom: 10,
  },
  errorSubtext: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: Colors.gold,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.background,
  },
});

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
  emptyBookingsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyBookingsIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(212,175,55,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  emptyBookingsTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 10,
  },
  emptyBookingsDesc: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  emptyBookingsActions: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
    justifyContent: 'center',
  },
  emptyBookingsPrimaryBtn: {
    backgroundColor: Colors.gold,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24,
    minWidth: 140,
    alignItems: 'center',
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyBookingsPrimaryBtnText: {
    color: Colors.background,
    fontSize: 15,
    fontWeight: '700',
  },
  emptyBookingsSecondaryBtn: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    minWidth: 140,
    alignItems: 'center',
  },
  emptyBookingsSecondaryBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '600',
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
    paddingTop: 10,
    paddingBottom: 30,
    gap: 16,
  },
  horizontalPackagesContainer: {
    gap: 16,
    paddingHorizontal: 0,
  },
  packageCardWrapper: {
    width: 320,
    marginRight: 16,
  },
  packagesScrollContainer: {
    position: 'relative' as const,
  },
  scrollIndicator: {
    position: 'absolute' as const,
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  scrollIndicatorGradient: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
  },
  scrollIndicatorText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.gold,
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
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
    overflow: 'hidden' as const,
  },
  coverImageContainer: {
    width: '100%',
    height: 200,
    position: 'relative' as const,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverImageOverlay: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  placeholderContainer: {
    width: '100%',
    height: 200,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  placeholderText: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  packageContent: {
    padding: 20,
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
    marginBottom: 8,
  },
  packageDetailedDesc: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 16,
    lineHeight: 18,
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
  payDepositButton: {
    flex: 1,
    marginLeft: 12,
    borderRadius: 14,
    overflow: 'hidden' as const,
    height: 54,
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
  payDepositGradient: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
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
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 30,
    marginBottom: 30,
  },
  stepperStep: {
    alignItems: 'center',
    position: 'relative',
    width: 50,
  },
  stepperCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    zIndex: 2,
  },
  stepperCircleActive: {
    borderColor: Colors.gold,
    backgroundColor: Colors.gold,
  },
  stepperNum: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  stepperNumActive: {
    color: Colors.background,
  },
  stepperLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  stepperLabelActive: {
    color: Colors.gold,
    fontWeight: '600',
  },
  stepperLine: {
    position: 'absolute',
    top: 13,
    left: 40,
    width: Dimensions.get('window').width / 4 - 20,
    height: 2,
    backgroundColor: Colors.border,
    zIndex: 1,
  },
  stepperLineActive: {
    backgroundColor: Colors.gold,
  },
  stepContent: {
    paddingHorizontal: 20,
    gap: 16,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 8,
  },
  wizardRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  wizardButton: {
    backgroundColor: Colors.gold,
    borderRadius: 14,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  wizardButtonDisabled: {
    opacity: 0.5,
  },
  wizardButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.background,
  },
  wizardBackButton: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    height: 54,
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wizardBackText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
  bookNowButton: {
    flex: 1,
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(212,175,55,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
  },
  bookNowText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.gold,
  },
  formGroup: {
    marginBottom: 8,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    height: 50,
    paddingHorizontal: 16,
    color: Colors.white,
    fontSize: 15,
  },
});
