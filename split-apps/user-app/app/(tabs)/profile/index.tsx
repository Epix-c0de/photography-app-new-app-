import { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Animated, Alert, ActivityIndicator, Share, Platform } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, CreditCard, FileText, Download, Heart, Shield, Bell, HelpCircle, LogOut, Award, Camera, Gift, CheckCircle, AlertCircle, Share2, User, Star, Clock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';
import { demoBookings, demoGalleries, demoPayments } from '@/lib/demo';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';
import ProfileEditModal from '@/components/ProfileEditModal';
import { ErrorBoundary } from '@/components/ErrorBoundary';

import { useBranding } from '@/contexts/BrandingContext';

type PaymentRow = Database['public']['Tables']['payments']['Row'];
type GalleryRow = Database['public']['Tables']['galleries']['Row'];

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  action?: () => void;
  badge?: string;
}

function MenuRow({ item }: { item: MenuItem }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  return (
    <Pressable
      onPressIn={() => Animated.timing(scaleAnim, { toValue: 0.97, duration: 100, useNativeDriver: true }).start()}
      onPressOut={() => Animated.timing(scaleAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start()}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); item.action?.(); }}
    >
      <Animated.View style={[styles.premiumMenuRow, { transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.premiumMenuIcon}>{item.icon}</View>
        <View style={styles.premiumMenuContent}>
          <Text style={styles.premiumMenuLabel}>{item.label}</Text>
          {item.subtitle && <Text style={styles.premiumMenuSubtitle}>{item.subtitle}</Text>}
        </View>
        {item.badge ? (
          <View style={styles.premiumMenuBadge}>
            <Text style={styles.premiumMenuBadgeText}>{item.badge}</Text>
          </View>
        ) : (
          <View style={styles.premiumChevronContainer}>
            <ChevronRight size={18} color={Colors.gold} />
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

function InvoiceCard({ payment }: { payment: PaymentRow }) {
  const statusColor = payment.status === 'paid' ? Colors.success : payment.status === 'pending' ? Colors.warning : Colors.error;
  const StatusIcon = payment.status === 'paid' ? CheckCircle : AlertCircle;
  const dateStr = new Date(payment.created_at).toLocaleDateString();

  return (
    <Pressable
      style={styles.invoiceCard}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Alert.alert('Payment Details', `Amount: KES ${payment.amount.toLocaleString()}\nStatus: ${payment.status.toUpperCase()}\nDate: ${dateStr}`);
      }}
    >
      <View style={[styles.invoiceStatusDot, { backgroundColor: statusColor + '20' }]}>
        <StatusIcon size={16} color={statusColor} />
      </View>
      <View style={styles.invoiceInfo}>
        <Text style={styles.invoiceDesc} numberOfLines={1}>Gallery Payment</Text>
        <Text style={styles.invoiceDate}>{dateStr}</Text>
      </View>
      <View style={styles.invoiceRight}>
        <Text style={[styles.invoiceAmount, { color: statusColor }]}>KES {payment.amount.toLocaleString()}</Text>
        <Text style={[styles.invoiceStatus, { color: statusColor }]}>{payment.status}</Text>
      </View>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, logout, isDemoMode } = useAuth();
  const { referralLink } = useBranding();
  const [showInvoices, setShowInvoices] = useState<boolean>(false);

  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [galleries, setGalleries] = useState<GalleryRow[]>([]);
  const [sessionCount, setSessionCount] = useState<number>(0);
  const [totalPhotos, setTotalPhotos] = useState<number>(0);
  const [nextBooking, setNextBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const isSharingRef = useRef(false);

  useEffect(() => {
    setAvatarUrl((profile as any)?.avatar_url ?? null);
  }, [profile]);

  useEffect(() => {
    async function loadData() {
      if (!user) return;

      try {
        setLoading(true);
        if (isDemoMode) {
          setPayments(demoPayments);
          setGalleries(demoGalleries);
          setTotalPhotos(demoGalleries.length * 8);
          setNextBooking(demoBookings[0] ?? null);
          setSessionCount(demoBookings.length);
          setLoading(false);
          return;
        }
        // Get ALL client IDs for this user (multi-admin support)
        const { data: clientRows } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', user.id);

        const allClientIds = (clientRows || []).map((c: any) => c.id).filter(Boolean);

        // Fetch client galleries — use join fallback when no client IDs exist
        let clientGalleries: any[] = [];
        if (allClientIds.length > 0) {
            const { data: paymentsData } = await supabase
              .from('payments')
              .select('*')
              .in('client_id', allClientIds)
              .order('created_at', { ascending: false });

            if (paymentsData) setPayments(paymentsData);

            const { data } = await supabase
              .from('galleries')
              .select('*')
              .in('client_id', allClientIds);
            clientGalleries = data || [];
        } else {
            // Fallback: join through clients table to find galleries for this user
            const { data } = await supabase
              .from('galleries')
              .select('*, clients!inner(user_id)')
              .eq('clients.user_id', user.id);
            clientGalleries = (data || []).map((g: any) => {
              const { clients, ...rest } = g;
              return rest;
            });
        }

            const { data: unlockedGalleries } = await supabase
              .from('unlocked_galleries')
              .select('galleries(*)')
              .eq('user_id', user.id);

            const unlockedItems = (unlockedGalleries ?? [])
              .map((row: any) => row.galleries as GalleryRow | null)
              .filter((row): row is GalleryRow => !!row);

            const mergedGalleries = [...(clientGalleries ?? []), ...unlockedItems]
              .filter((gallery, index, self) => index === self.findIndex((item) => item.id === gallery.id));

            setGalleries(mergedGalleries);

            if (mergedGalleries.length > 0) {
              const galleryIds = mergedGalleries.map((gallery) => gallery.id);
              const { count: photosCount } = await supabase
                .from('gallery_photos')
                .select('id', { count: 'exact', head: true })
                .in('gallery_id', galleryIds);
              setTotalPhotos(photosCount ?? 0);
            } else {
              setTotalPhotos(0);
            }

            const today = new Date().toISOString().split('T')[0];
            const { data: bookingData } = await supabase
              .from('bookings')
              .select('date, time, location')
              .eq('user_id', user.id)
              .gte('date', today)
              .order('date', { ascending: true })
              .limit(1)
              .maybeSingle();
            
            setNextBooking(bookingData);

            const { count: bookingsCount } = await supabase
              .from('bookings')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', user.id);
            setSessionCount(bookingsCount ?? 0);
          }
      } catch (e) {
        console.error('Error loading profile data:', e);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [isDemoMode, user]);

  const unlockedGalleries = galleries.filter(g => !g.is_locked);
  const totalSpent = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
  const metadata = (user?.user_metadata as any) ?? {};
  const displayName =
    profile?.name ||
    metadata.display_name ||
    metadata.name ||
    (user?.email ? user.email.split('@')[0] : null) ||
    'Guest';
  const displayEmail = profile?.email || user?.email || 'Not signed in';
  const resolvedAvatarUrl = (() => {
    const candidate = avatarUrl;
    if (!candidate) return null;
    if (candidate.startsWith('http')) return candidate;
    try {
      const { data } = supabase.storage.from('avatars').getPublicUrl(candidate);
      return data.publicUrl;
    } catch {
      return candidate;
    }
  })();

  const handleAvatarUpdate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditModalVisible(true);
  };

  const handleModalOptionSelect = async (option: 'camera' | 'library' | 'remove') => {
    switch (option) {
      case 'remove':
        if (!user) return;
        if (isDemoMode) {
          setAvatarUrl(null);
          Alert.alert('Success', 'Demo profile picture removed locally.');
          return;
        }
        try {
          setLoading(true);
          const { error } = await supabase
            .from('user_profiles')
            .update({ avatar_url: null })
            .eq('id', user.id);
          if (error) throw error;
          setAvatarUrl(null);
          Alert.alert('Success', 'Profile picture removed.');
        } catch (e: any) {
          Alert.alert('Error', e.message);
        } finally {
          setLoading(false);
        }
        break;

      case 'library':
        const libraryResult = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.5,
        });

        if (!libraryResult.canceled && libraryResult.assets[0]) {
          uploadAvatar(libraryResult.assets[0]);
        }
        break;

      case 'camera':
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (permission.status !== 'granted') {
          Alert.alert('Permission needed', 'Camera permission is required to take photos.');
          return;
        }
        const cameraResult = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.5,
        });
        if (!cameraResult.canceled && cameraResult.assets[0]) {
          uploadAvatar(cameraResult.assets[0]);
        }
        break;
    }
  };

  const uploadAvatar = async (asset: ImagePicker.ImagePickerAsset) => {
    try {
      setLoading(true);

      if (isDemoMode) {
        setAvatarUrl(asset.uri);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Success', 'Demo profile picture updated locally.');
        return;
      }

      // Attempt to ensure bucket exists via Edge Function
      try {
        await supabase.functions.invoke('ensure_buckets', {
          body: { buckets: ['avatars'], public: true }
        });
      } catch (invokeError) {
        console.warn('Failed to invoke ensure_buckets:', invokeError);
      }

      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        Alert.alert('Error', 'Image must be smaller than 5MB.');
        setLoading(false);
        return;
      }

      const response = await fetch(asset.uri);
      const arrayBuffer = await response.arrayBuffer();
      const fileExt = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';

      if (!user) {
        Alert.alert('Error', 'You must be logged in to update your profile.');
        return;
      }

      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, arrayBuffer, {
          contentType: asset.mimeType ?? 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        const msg = (uploadError as any)?.message || String(uploadError);
        const lowerMsg = msg.toLowerCase();

        if (lowerMsg.includes('bucket') && lowerMsg.includes('not found')) {
          Alert.alert(
            'Storage Error',
            'The "avatars" bucket was not found. Please create it manually in your Supabase Dashboard > Storage with "Public" access enabled.',
            [{ text: 'OK' }]
          );
          return;
        }

        if (lowerMsg.includes('forbidden') || lowerMsg.includes('unauthorized') || lowerMsg.includes('permission denied')) {
          Alert.alert(
            'Permission Denied',
            'You do not have permission to upload to the "avatars" bucket. Check your Supabase Storage RLS policies.',
            [{ text: 'OK' }]
          );
          return;
        }

        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;
      setAvatarUrl(publicUrl);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Profile picture updated.');

    } catch (e: any) {
      console.error('Avatar upload failed:', e);
      Alert.alert('Upload Failed', e.message || 'An unexpected error occurred during upload.');
    } finally {
      setLoading(false);
    }
  };

  const handleReferral = async () => {
    if (!user) return;
    // Guard against concurrent share calls which cause 'earlier share not completed' error
    if (isSharingRef.current) return;
    isSharingRef.current = true;
    const url = referralLink;
    const message = `Check out our studio! View our portfolio and app here: ${url}`;
    try {
      await Share.share({
        message,
        url, // iOS only
        title: 'Share Studio',
      });
    } catch (error: any) {
      if (!error?.message?.includes('share has not yet completed')) {
        Alert.alert('Error', error.message);
      }
    } finally {
      isSharingRef.current = false;
    }
  };

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              if (router.canGoBack()) {
                router.dismissAll();
              }
              router.replace('/login');
            } catch (e) {
              console.error('Logout failed:', e);
              router.replace('/login');
            }
          },
        },
      ]
    );
  }, [logout, router]);

  const accountItems: MenuItem[] = [
    ...(profile?.role === 'admin' ? [{
      icon: <Shield size={20} color={Colors.gold} />,
      label: 'Admin Dashboard',
      subtitle: 'Manage your studio',
      action: () => router.push('/(admin)/dashboard'),
    }] : []),
    {
      icon: <Share2 size={20} color={Colors.gold} />,
      label: 'Share Studio',
      subtitle: 'Spread the word',
      action: handleReferral,
    },
    {
      icon: <CreditCard size={20} color={Colors.gold} />,
      label: 'Payment History',
      subtitle: `Total spent: KES ${totalSpent.toLocaleString()}`,
      action: () => setShowInvoices(!showInvoices),
    },
    { icon: <Download size={20} color={Colors.gold} />, label: 'Downloads', subtitle: 'Re-download past galleries', badge: String(unlockedGalleries.length), action: () => router.push('/profile/settings/downloads') },
  ];

  const settingsItems: MenuItem[] = [
    { icon: <Bell size={20} color={Colors.textSecondary} />, label: 'Notifications', subtitle: 'Manage push preferences', action: () => router.push('/profile/settings/notifications') },
    { icon: <Shield size={20} color={Colors.textSecondary} />, label: 'Privacy & Security', subtitle: 'Password, data controls', action: () => router.push('/profile/settings/privacy-security') },
    { icon: <HelpCircle size={20} color={Colors.textSecondary} />, label: 'Help & Support', subtitle: 'Chat with us', action: () => router.push('/profile/settings/help-support') },
  ];

  return (
    <ErrorBoundary label="Profile Screen">
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 120, 160) }}>
        <BlurView intensity={80} tint="dark" style={[styles.premiumProfileHeader, { paddingTop: insets.top + 20 }]}>
          <View style={styles.premiumAvatarContainer}>
            {resolvedAvatarUrl ? (
              <View style={styles.avatarRing}>
                <Image
                  source={{ uri: resolvedAvatarUrl }}
                  style={styles.premiumAvatar}
                />
              </View>
            ) : (
              <View style={styles.avatarRing}>
                <LinearGradient colors={[Colors.gold, '#D4AF37', '#B8860B']} style={styles.premiumAvatar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Text style={styles.premiumAvatarInitials}>
                    {(displayName.split(' ')[0][0] || displayName[0] || 'U').toUpperCase()}
                  </Text>
                </LinearGradient>
              </View>
            )}
            <Pressable style={styles.premiumEditAvatarButton} onPress={handleAvatarUpdate}>
              <Camera size={14} color={Colors.white} />
            </Pressable>
          </View>
          <Text style={styles.premiumUserName}>{displayName}</Text>
          <Text style={styles.premiumUserEmail}>{displayEmail}</Text>

          <View style={styles.premiumStatsRow}>
            <View style={styles.premiumStatItem}>
              <LinearGradient colors={['rgba(212,175,55,0.2)', 'rgba(212,175,55,0.05)']} style={styles.premiumStatBadge}>
                <Text style={styles.premiumStatValue}>{sessionCount}</Text>
              </LinearGradient>
              <Text style={styles.premiumStatLabel}>Sessions</Text>
            </View>
            <View style={styles.premiumStatItem}>
              <LinearGradient colors={['rgba(212,175,55,0.2)', 'rgba(212,175,55,0.05)']} style={styles.premiumStatBadge}>
                <Text style={styles.premiumStatValue}>{totalPhotos}</Text>
              </LinearGradient>
              <Text style={styles.premiumStatLabel}>Photos</Text>
            </View>
            <View style={styles.premiumStatItem}>
              <LinearGradient colors={['rgba(212,175,55,0.2)', 'rgba(212,175,55,0.05)']} style={styles.premiumStatBadge}>
                <Text style={styles.premiumStatValue}>{unlockedGalleries.length}</Text>
              </LinearGradient>
              <Text style={styles.premiumStatLabel}>Galleries</Text>
            </View>
          </View>
        </BlurView>

        {(profile as any)?.loyalty_tier && (
          <View style={styles.loyaltyCard}>
            <LinearGradient
              colors={['rgba(212,175,55,0.15)', 'rgba(212,175,55,0.05)']}
              style={styles.loyaltyGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.loyaltyIcon}>
                <Award size={22} color={Colors.gold} />
              </View>
              <View style={styles.loyaltyInfo}>
                <Text style={styles.loyaltyTitle}>{(profile as any)?.loyalty_tier || 'Member'} Member</Text>
                <Text style={styles.loyaltyDesc}>Enjoy 10% off your next booking</Text>
              </View>
              <ChevronRight size={16} color={Colors.gold} />
            </LinearGradient>
          </View>
        )}

        <View style={styles.referralCard}>
          <LinearGradient
            colors={['rgba(59,130,246,0.15)', 'rgba(59,130,246,0.05)']}
            style={styles.referralGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.referralIcon}>
              <Share2 size={22} color="#3B82F6" />
            </View>
            <View style={styles.referralInfo}>
              <Text style={styles.referralTitle}>Love our work?</Text>
              <Text style={styles.referralDesc}>Share the experience with your friends</Text>
            </View>
            <Pressable style={styles.referralCta} onPress={handleReferral}>
              <Text style={styles.referralCtaText}>Share</Text>
            </Pressable>
          </LinearGradient>
        </View>

        {showInvoices && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Invoices & Payments</Text>
            </View>
            {loading ? (
              <ActivityIndicator color={Colors.gold} />
            ) : payments.length > 0 ? (
              payments.map((payment) => (
                <InvoiceCard key={payment.id} payment={payment} />
              ))
            ) : (
              <Text style={styles.emptyText}>No payment history found.</Text>
            )}
          </View>
        )}

        <View style={styles.premiumMenuSection}>
          <Text style={styles.premiumMenuSectionTitle}>ACCOUNT</Text>
          <BlurView intensity={40} tint="dark" style={styles.premiumMenuBlur}>
            {accountItems.map((item, index) => (
              <View key={index}>
                <MenuRow item={item} />
                {index < accountItems.length - 1 && <View style={styles.premiumMenuDivider} />}
              </View>
            ))}
          </BlurView>
        </View>

        <View style={styles.premiumMenuSection}>
          <Text style={styles.premiumMenuSectionTitle}>SETTINGS</Text>
          <BlurView intensity={40} tint="dark" style={styles.premiumMenuBlur}>
            {settingsItems.map((item, index) => (
              <View key={index}>
                <MenuRow item={item} />
                {index < settingsItems.length - 1 && <View style={styles.premiumMenuDivider} />}
              </View>
            ))}
          </BlurView>
        </View>

        <View style={styles.premiumSection}>
          <Text style={styles.premiumSectionTitle}>ACTIVITY</Text>
          <BlurView intensity={40} tint="dark" style={styles.premiumActivityBlur}>
            <View style={styles.activityItem}>
              <View style={[styles.activityIconBox, { backgroundColor: 'rgba(212,175,55,0.1)' }]}>
                <Star size={18} color={Colors.gold} fill={Colors.gold} />
              </View>
              <View style={styles.activityInfo}>
                <Text style={styles.activityLabel}>Your Rating</Text>
                <View style={styles.ratingRow}>
                  <Star size={12} color={Colors.textMuted} />
                  <Text style={[styles.ratingText, { color: Colors.textMuted }]}>No reviews yet</Text>
                </View>
              </View>
            </View>
            <View style={styles.activityDivider} />
            <View style={styles.activityItem}>
              <View style={[styles.activityIconBox, { backgroundColor: 'rgba(102,102,102,0.1)' }]}>
                <Clock size={18} color={Colors.textMuted} />
              </View>
              <View style={styles.activityInfo}>
                <Text style={styles.activityLabel}>Member Since</Text>
                <Text style={styles.activityValue}>
                  {user?.created_at 
                    ? new Date(user.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
                    : 'Explorer'}
                </Text>
              </View>
            </View>
            <View style={styles.activityDivider} />
            <View style={styles.activityItem}>
              <View style={[styles.activityIconBox, { backgroundColor: 'rgba(212,175,55,0.1)' }]}>
                <Camera size={18} color={Colors.gold} />
              </View>
              <View style={styles.activityInfo}>
                <Text style={styles.activityLabel}>Next Shoot</Text>
                <Text style={styles.activityValue}>
                  {nextBooking 
                    ? `${new Date(nextBooking.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}${nextBooking.location ? ` • ${nextBooking.location}` : ''}`
                    : 'No upcoming shoots'}
                </Text>
              </View>
            </View>
          </BlurView>
        </View>

        <View style={styles.premiumSection}>
          <Text style={styles.premiumSectionTitle}>ACHIEVEMENTS</Text>
          <BlurView intensity={40} tint="dark" style={styles.premiumAchievementsBlur}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.achievementsScroll}>
              <View style={[styles.achievementBadge, sessionCount >= 1 && styles.achievementUnlocked]}>
                <View style={styles.achievementIcon}>
                  <Camera size={24} color={sessionCount >= 1 ? Colors.gold : Colors.textMuted} />
                </View>
                <Text style={[styles.achievementTitle, sessionCount < 1 && styles.achievementLocked]}>First Shoot</Text>
                <Text style={[styles.achievementDesc, sessionCount < 1 && styles.achievementLocked]}>Booked your first session</Text>
              </View>
              
              <View style={[styles.achievementBadge, sessionCount >= 3 && styles.achievementUnlocked]}>
                <View style={styles.achievementIcon}>
                  <Star size={24} color={sessionCount >= 3 ? Colors.gold : Colors.textMuted} />
                </View>
                <Text style={[styles.achievementTitle, sessionCount < 3 && styles.achievementLocked]}>Regular</Text>
                <Text style={[styles.achievementDesc, sessionCount < 3 && styles.achievementLocked]}>3+ sessions booked</Text>
              </View>
              
              <View style={[styles.achievementBadge, unlockedGalleries.length >= 5 && styles.achievementUnlocked]}>
                <View style={styles.achievementIcon}>
                  <Heart size={24} color={unlockedGalleries.length >= 5 ? Colors.gold : Colors.textMuted} />
                </View>
                <Text style={[styles.achievementTitle, unlockedGalleries.length < 5 && styles.achievementLocked]}>Collector</Text>
                <Text style={[styles.achievementDesc, unlockedGalleries.length < 5 && styles.achievementLocked]}>5+ galleries unlocked</Text>
              </View>
              
              <View style={[styles.achievementBadge, totalSpent > 50000 && styles.achievementUnlocked]}>
                <View style={styles.achievementIcon}>
                  <Award size={24} color={totalSpent > 50000 ? Colors.gold : Colors.textMuted} />
                </View>
                <Text style={[styles.achievementTitle, totalSpent <= 50000 && styles.achievementLocked]}>VIP</Text>
                <Text style={[styles.achievementDesc, totalSpent <= 50000 && styles.achievementLocked]}>Spent KES 50K+</Text>
              </View>
            </ScrollView>
          </BlurView>
        </View>

        <Pressable style={styles.premiumLogoutButton} onPress={handleLogout}>
          <LinearGradient colors={['rgba(239,68,68,0.15)', 'rgba(239,68,68,0.05)']} style={styles.premiumLogoutGradient}>
            <LogOut size={20} color={Colors.error} />
            <Text style={styles.premiumLogoutText}>Sign Out</Text>
          </LinearGradient>
        </Pressable>
      </ScrollView>

      <ProfileEditModal
        visible={isEditModalVisible}
        onClose={() => setEditModalVisible(false)}
        onOptionSelect={handleModalOptionSelect}
        hasCurrentPhoto={!!avatarUrl}
      />
    </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  profileHeader: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 24,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.white,
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.gold,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    marginTop: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.border,
  },
  loyaltyCard: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  loyaltyGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  loyaltyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(212,175,55,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loyaltyInfo: {
    flex: 1,
  },
  loyaltyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.gold,
    marginBottom: 2,
  },
  loyaltyDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  referralCard: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
    backgroundColor: 'rgba(59,130,246,0.03)',
  },
  referralGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  referralIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(59,130,246,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  referralInfo: {
    flex: 1,
  },
  referralTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3B82F6',
    marginBottom: 2,
  },
  referralDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    opacity: 0.9,
  },
  referralCta: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  referralCtaText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
  activityCard: {
    marginHorizontal: 20,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  activityIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityInfo: {
    flex: 1,
  },
  activityLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  activityValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
    marginLeft: 6,
  },
  activityDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
    marginLeft: 48,
  },
  menuContainer: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  menuIcon: {
    width: 36,
    alignItems: 'center',
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 16,
    color: Colors.white,
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  menuBadge: {
    backgroundColor: Colors.card,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  menuBadgeText: {
    fontSize: 12,
    color: Colors.gold,
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    gap: 8,
    paddingVertical: 12,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.error,
  },
  section: {
    marginTop: 10,
    marginBottom: 10,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
  invoiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.card,
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  invoiceStatusDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  invoiceInfo: {
    flex: 1,
  },
  invoiceDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 2,
  },
  invoiceDate: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  invoiceRight: {
    alignItems: 'flex-end',
  },
  invoiceAmount: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  invoiceStatus: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  emptyText: {
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 10,
    fontSize: 14,
  },
  // Achievements styles
  achievementsContainer: {
    marginHorizontal: 20,
  },
  achievementsScroll: {
    paddingRight: 20,
    gap: 12,
  },
  achievementBadge: {
    width: 120,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    opacity: 0.6,
  },
  achievementUnlocked: {
    opacity: 1,
    borderColor: Colors.gold,
    backgroundColor: 'rgba(212,175,55,0.05)',
  },
  achievementIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(212,175,55,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  achievementTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 4,
    textAlign: 'center',
  },
  achievementDesc: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  achievementLocked: {
    color: Colors.textMuted,
  },
  // Premium styles
  premiumProfileHeader: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 28,
    backgroundColor: 'rgba(20,19,19,0.7)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,175,55,0.15)',
  },
  premiumAvatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    padding: 4,
    backgroundColor: 'rgba(212,175,55,0.3)',
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  premiumAvatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 2,
    borderColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumAvatarInitials: {
    fontSize: 40,
    fontWeight: '800',
    color: Colors.white,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  premiumEditAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.gold,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.background,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  premiumUserName: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.white,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  premiumUserEmail: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 24,
    fontWeight: '500',
  },
  premiumStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginTop: 8,
  },
  premiumStatItem: {
    alignItems: 'center',
    gap: 8,
  },
  premiumStatBadge: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
  },
  premiumStatValue: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.gold,
  },
  premiumStatLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Premium menu styles
  premiumMenuSection: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  premiumMenuSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.gold,
    marginBottom: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    opacity: 0.9,
  },
  premiumMenuBlur: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(28,28,30,0.4)',
  },
  premiumMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  premiumMenuIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(212,175,55,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.15)',
  },
  premiumMenuContent: {
    flex: 1,
  },
  premiumMenuLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 3,
  },
  premiumMenuSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  premiumMenuBadge: {
    backgroundColor: 'rgba(212,175,55,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
  },
  premiumMenuBadgeText: {
    fontSize: 12,
    color: Colors.gold,
    fontWeight: '800',
  },
  premiumChevronContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  premiumMenuDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginLeft: 76,
  },
  // Premium section styles
  premiumSection: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  premiumSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.gold,
    marginBottom: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    opacity: 0.9,
  },
  premiumActivityBlur: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(28,28,30,0.4)',
    padding: 20,
  },
  premiumAchievementsBlur: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(28,28,30,0.4)',
    paddingVertical: 16,
    paddingLeft: 16,
  },
  // Premium logout button
  premiumLogoutButton: {
    marginTop: 32,
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  premiumLogoutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  premiumLogoutText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.error,
  },
});
