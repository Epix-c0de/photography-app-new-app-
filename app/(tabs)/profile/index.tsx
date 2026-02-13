import { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Animated, Alert, ActivityIndicator, Share, Platform } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Settings, ChevronRight, CreditCard, FileText, Download, Heart, Shield, Bell, HelpCircle, LogOut, Award, Camera, Gift, CheckCircle, AlertCircle, Share2, User } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';
import ProfileEditModal from '@/components/ProfileEditModal';

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
      onPressIn={() => Animated.timing(scaleAnim, { toValue: 0.98, duration: 100, useNativeDriver: true }).start()}
      onPressOut={() => Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start()}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); item.action?.(); }}
    >
      <Animated.View style={[styles.menuRow, { transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.menuIcon}>{item.icon}</View>
        <View style={styles.menuContent}>
          <Text style={styles.menuLabel}>{item.label}</Text>
          {item.subtitle && <Text style={styles.menuSubtitle}>{item.subtitle}</Text>}
        </View>
        {item.badge ? (
          <View style={styles.menuBadge}>
            <Text style={styles.menuBadgeText}>{item.badge}</Text>
          </View>
        ) : (
          <ChevronRight size={16} color={Colors.textMuted} />
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
  const { user, logout } = useAuth();
  const [showInvoices, setShowInvoices] = useState<boolean>(false);
  
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [galleries, setGalleries] = useState<GalleryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditModalVisible, setEditModalVisible] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      
      try {
        setLoading(true);
        // Get client ID
        const { data: clientData } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (clientData) {
          const { data: paymentsData } = await supabase
            .from('payments')
            .select('*')
            .eq('client_id', clientData.id)
            .order('created_at', { ascending: false });
          
          if (paymentsData) setPayments(paymentsData);
          
          const { data: galleriesData } = await supabase
            .from('galleries')
            .select('*')
            .eq('client_id', clientData.id);
            
          if (galleriesData) setGalleries(galleriesData);
        }
      } catch (e) {
        console.error('Error loading profile data:', e);
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, [user]);

  const unlockedGalleries = galleries.filter(g => !g.is_locked);
  // Note: GalleryRow doesn't have photoCount, so we default to 0 for now.
  // Ideally we would fetch photo counts via a joined query or view.
  const totalPhotos = 0; 
  const totalSpent = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);

  const handleAvatarUpdate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditModalVisible(true);
  };

  const handleModalOptionSelect = async (option: 'camera' | 'library' | 'remove') => {
    // Modal closes automatically or we can force close if needed, but usually handled by onClose prop
    // However, for the actions, we might want to wait. 
    // The Modal component calls this and then closes.
    
    switch (option) {
      case 'remove':
        if (!user) return;
        try {
          setLoading(true);
          const { error } = await supabase
             .from('user_profiles')
             .update({ avatar_url: null })
             .eq('id', user.id);
          if (error) throw error;
          Alert.alert('Success', 'Profile picture removed.');
        } catch (e: any) {
          Alert.alert('Error', e.message);
        } finally {
          setLoading(false);
        }
        break;
        
      case 'library':
        const libraryResult = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
       
       // Ensure bucket exists
       await supabase.functions.invoke('ensure_buckets', {
         body: { buckets: ['avatars'], public: true }
       });
       
       if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
          Alert.alert('Error', 'Image must be smaller than 5MB.');
          setLoading(false);
          return;
       }

       const arrayBuffer = await fetch(asset.uri).then(res => res.arrayBuffer());
       const fileExt = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
       if (!user) return;
       const fileName = `${user.id}/${Date.now()}.${fileExt}`;
       
       const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, arrayBuffer, {
             contentType: asset.mimeType ?? 'image/jpeg',
             upsert: true,
          });

       if (uploadError) {
         const msg = (uploadError as any)?.message || String(uploadError);
         if (msg.includes('Bucket') && msg.includes('not found')) {
           Alert.alert('Storage Error', 'Bucket "avatars" not found. Please create it in Supabase Storage.');
           throw uploadError;
         }
         if (msg.toLowerCase().includes('forbidden') || msg.toLowerCase().includes('unauthorized')) {
           Alert.alert('Storage Error', 'Permission denied. Check storage bucket access policies and API keys.');
           throw uploadError;
         }
         throw uploadError;
       }

       const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);

       const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ avatar_url: publicUrl })
          .eq('id', user.id);

       if (updateError) throw updateError;
       
       Alert.alert('Success', 'Profile picture updated.');

     } catch (e: any) {
        Alert.alert('Error', e.message || 'Failed to upload image.');
     } finally {
        setLoading(false);
     }
  };

  const handleReferral = async () => {
     if (!user) return;
     const referralCode = user.id.substring(0, 8).toUpperCase();
     const url = `https://rork.app/refer/${referralCode}`;
     const message = `Hey! Use my code ${referralCode} to get KES 2,000 off your next booking with LenzArt! ${url}`;
     
     try {
       const result = await Share.share({
         message,
         url, // iOS only
         title: 'Refer a Friend',
       });
       
       if (result.action === Share.sharedAction) {
          // Track analytics if needed
       }
     } catch (error: any) {
       Alert.alert('Error', error.message);
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
              // Force navigation even if API fails
              router.replace('/login');
            }
          },
        },
      ]
    );
  }, [logout, router]);

  const accountItems: MenuItem[] = [
    {
      icon: <Award size={20} color={Colors.gold} />,
      label: 'Member Benefits',
      subtitle: '10% off & more',
      action: () => router.push('/profile/settings/member-benefits'),
    },
    {
      icon: <Share2 size={20} color={Colors.gold} />,
      label: 'Refer to Friend',
      subtitle: 'Both get KES 2,000 off',
      action: handleReferral,
    },
    {
      icon: <CreditCard size={20} color={Colors.gold} />,
      label: 'Payment History',
      subtitle: `Total spent: KES ${totalSpent.toLocaleString()}`,
      action: () => setShowInvoices(!showInvoices),
    },
    { 
      icon: <FileText size={20} color={Colors.gold} />, 
      label: 'Invoices', 
      subtitle: `${payments.length} invoices`, 
      badge: String(payments.filter(p => p.status === 'pending').length || ''), 
      action: () => router.push('/profile/settings/invoices') 
    },
    { icon: <Download size={20} color={Colors.gold} />, label: 'Downloads', subtitle: 'Re-download past galleries', badge: String(unlockedGalleries.length), action: () => router.push('/profile/settings/downloads') },
    { icon: <Heart size={20} color={Colors.gold} />, label: 'Favorites', subtitle: 'Your liked photos', badge: '12', action: () => router.push('/profile/settings/favorites') },
  ];

  const settingsItems: MenuItem[] = [
    { icon: <Bell size={20} color={Colors.textSecondary} />, label: 'Notifications', subtitle: 'Manage push preferences', action: () => router.push('/profile/settings/notifications') },
    { icon: <Shield size={20} color={Colors.textSecondary} />, label: 'Privacy & Security', subtitle: 'Password, data controls', action: () => router.push('/profile/settings/privacy-security') },
    { icon: <Settings size={20} color={Colors.textSecondary} />, label: 'App Settings', subtitle: 'Storage, data, display', action: () => router.push('/profile/settings/app-settings') },
    { icon: <HelpCircle size={20} color={Colors.textSecondary} />, label: 'Help & Support', subtitle: 'FAQs, contact us', action: () => router.push('/profile/settings/help-support') },
  ];

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={[styles.profileHeader, { paddingTop: insets.top + 16 }]}>
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: user?.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop' }}
              style={styles.avatar}
            />
            <Pressable style={styles.editAvatarButton} onPress={handleAvatarUpdate}>
              <Camera size={14} color={Colors.white} />
            </Pressable>
          </View>
          <Text style={styles.userName}>{user?.name || 'Guest'}</Text>
          <Text style={styles.userEmail}>{user?.email || 'Not signed in'}</Text>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{user?.totalBookings || 0}</Text>
              <Text style={styles.statLabel}>Sessions</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{totalPhotos}</Text>
              <Text style={styles.statLabel}>Photos</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{unlockedGalleries.length}</Text>
              <Text style={styles.statLabel}>Galleries</Text>
            </View>
          </View>
        </View>

        {user?.loyaltyTier && (
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
                <Text style={styles.loyaltyTitle}>{user.loyaltyTier} Member</Text>
                <Text style={styles.loyaltyDesc}>Enjoy 10% off your next booking</Text>
              </View>
              <ChevronRight size={16} color={Colors.gold} />
            </LinearGradient>
          </View>
        )}

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

        <View style={styles.menuContainer}>
          {accountItems.map((item, index) => (
            <MenuRow key={index} item={item} />
          ))}
        </View>

        <View style={styles.menuContainer}>
          {settingsItems.map((item, index) => (
            <MenuRow key={index} item={item} />
          ))}
        </View>

        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color={Colors.error} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </Pressable>
      </ScrollView>

      <ProfileEditModal
        visible={isEditModalVisible}
        onClose={() => setEditModalVisible(false)}
        onOptionSelect={handleModalOptionSelect}
        hasCurrentPhoto={!!user?.avatar}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  profileHeader: {
    alignItems: 'center',
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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
    paddingHorizontal: 40,
    justifyContent: 'space-between',
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
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
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
    borderRadius: 20,
    backgroundColor: 'rgba(59,130,246,0.1)',
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
  },
  referralCta: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  referralCtaText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
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
});
