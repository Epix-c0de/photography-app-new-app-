import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Animated, Alert, ActivityIndicator, RefreshControl, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  Search,
  UserPlus,
  Phone,
  Images,
  ChevronRight,
  Lock,
  Unlock,
  Send,
  X,
  Crown,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import Colors from '@/constants/colors';
import { AdminService } from '@/services/admin';
import { useAuth } from '@/contexts/AuthContext';

// Types for UI
type AdminClient = {
  id: string;
  name: string;
  avatar: string;
  phone: string;
  email: string;
  loyaltyLevel: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  totalSpent: number;
  totalGalleries: number;
  preferredPackage?: string;
  notes?: string;
};

type AdminGallery = {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  coverImage: string;
  photoCount: number;
  accessCode: string;
  isLocked: boolean;
  isPaid: boolean;
  price: number;
  status: 'active' | 'scheduled' | 'archived';
};

function formatCurrency(amount: number): string {
  if (amount >= 1000) {
    return `KES ${(amount / 1000).toFixed(0)}K`;
  }
  return `KES ${amount}`;
}

const loyaltyColors: Record<string, string> = {
  Bronze: '#CD7F32',
  Silver: '#C0C0C0',
  Gold: '#D4AF37',
  Platinum: '#E5E4E2',
  Unknown: '#333333'
};

type ViewMode = 'clients' | 'galleries';

function ClientCard({ client, onPress }: { client: AdminClient; onPress: () => void }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  return (
    <Pressable
      onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start()}
      onPress={onPress}
    >
      <Animated.View style={[styles.clientCard, { transform: [{ scale: scaleAnim }] }]}>
        <Image 
          source={{ uri: client.avatar }} 
          style={styles.clientAvatar} 
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
        <View style={styles.clientInfo}>
          <View style={styles.clientNameRow}>
            <Text style={styles.clientName}>{client.name}</Text>
            <View style={[styles.loyaltyBadge, { backgroundColor: (loyaltyColors[client.loyaltyLevel] || Colors.gold) + '20' }]}>
              <Crown size={10} color={loyaltyColors[client.loyaltyLevel] || Colors.gold} />
              <Text style={[styles.loyaltyText, { color: loyaltyColors[client.loyaltyLevel] || Colors.gold }]}>{client.loyaltyLevel}</Text>
            </View>
          </View>
          <Text style={styles.clientPhone}>{client.phone}</Text>
          <View style={styles.clientMeta}>
            <Text style={styles.clientMetaText}>{client.totalGalleries} galleries</Text>
            <View style={styles.clientMetaDot} />
            <Text style={styles.clientMetaText}>{formatCurrency(client.totalSpent)}</Text>
          </View>
        </View>
        <ChevronRight size={18} color={Colors.textMuted} />
      </Animated.View>
    </Pressable>
  );
}

function GalleryCard({ gallery }: { gallery: AdminGallery }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleResendCode = useCallback(async () => {
    await Clipboard.setStringAsync(gallery.accessCode);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copied', `Access code ${gallery.accessCode} copied to clipboard`);
  }, [gallery]);

  const handleToggleLock = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      gallery.isLocked ? 'Unlock Gallery' : 'Lock Gallery',
      `Are you sure you want to ${gallery.isLocked ? 'unlock' : 'lock'} "${gallery.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm', 
          style: 'destructive',
          onPress: async () => {
             try {
               const { error } = await AdminService.gallery.update(gallery.id, { is_locked: !gallery.isLocked });
               if (error) throw error;
               // State will update via subscription
             } catch (e) {
               Alert.alert('Error', 'Failed to update gallery status');
             }
          }
        }
      ]
    );
  }, [gallery]);

  return (
    <Pressable
      onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start()}
    >
      <Animated.View style={[styles.galleryCard, { transform: [{ scale: scaleAnim }] }]}>
        <Image 
          source={{ uri: gallery.coverImage }} 
          style={styles.galleryCover} 
          contentFit="cover" 
          transition={200}
          cachePolicy="memory-disk"
        />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.galleryOverlay} />

        <View style={styles.galleryBadges}>
          <View style={[styles.statusBadge, { backgroundColor: gallery.isPaid ? Colors.success + '25' : Colors.warning + '25' }]}>
            <Text style={[styles.statusText, { color: gallery.isPaid ? Colors.success : Colors.warning }]}>
              {gallery.isPaid ? 'Paid' : 'Unpaid'}
            </Text>
          </View>
          {gallery.status === 'scheduled' && (
            <View style={[styles.statusBadge, { backgroundColor: '#6C9AED25' }]}>
              <Text style={[styles.statusText, { color: '#6C9AED' }]}>Scheduled</Text>
            </View>
          )}
        </View>

        <View style={styles.galleryContent}>
          <Text style={styles.galleryTitle}>{gallery.title}</Text>
          <Text style={styles.galleryClient}>{gallery.clientName} · {gallery.photoCount} photos</Text>
          <View style={styles.galleryCodeRow}>
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>{gallery.accessCode}</Text>
            </View>
            <Text style={styles.galleryPrice}>{formatCurrency(gallery.price)}</Text>
          </View>
          <View style={styles.galleryActions}>
            <Pressable style={styles.galleryActionBtn} onPress={handleResendCode}>
              <Send size={13} color={Colors.gold} />
              <Text style={styles.galleryActionText}>Resend Code</Text>
            </Pressable>
            <Pressable style={styles.galleryActionBtn} onPress={handleToggleLock}>
              {gallery.isLocked ? <Unlock size={13} color={Colors.success} /> : <Lock size={13} color={Colors.warning} />}
              <Text style={styles.galleryActionText}>{gallery.isLocked ? 'Unlock' : 'Lock'}</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

function ClientDetailModal({ client, galleries, onClose }: { client: AdminClient; galleries: AdminGallery[]; onClose: () => void }) {
  const router = useRouter();
  const clientGalleries = useMemo(
    () => galleries.filter(g => g.clientId === client.id),
    [client.id, galleries]
  );

  return (
    <View style={styles.modalOverlay}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <Animated.View style={styles.modalContent}>
        <View style={styles.modalHandle} />
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.modalHeader}>
            <Image source={{ uri: client.avatar }} style={styles.modalAvatar} />
            <Text style={styles.modalName}>{client.name}</Text>
            <View style={[styles.loyaltyBadge, { backgroundColor: (loyaltyColors[client.loyaltyLevel] || Colors.gold) + '20' }]}>
              <Crown size={12} color={loyaltyColors[client.loyaltyLevel] || Colors.gold} />
              <Text style={[styles.loyaltyText, { color: loyaltyColors[client.loyaltyLevel] || Colors.gold }]}>{client.loyaltyLevel}</Text>
            </View>
          </View>

          <View style={styles.modalStats}>
            <View style={styles.modalStat}>
              <Text style={styles.modalStatValue}>{formatCurrency(client.totalSpent)}</Text>
              <Text style={styles.modalStatLabel}>Total Spent</Text>
            </View>
            <View style={styles.modalStatDivider} />
            <View style={styles.modalStat}>
              <Text style={styles.modalStatValue}>{client.totalGalleries}</Text>
              <Text style={styles.modalStatLabel}>Galleries</Text>
            </View>
            <View style={styles.modalStatDivider} />
            <View style={styles.modalStat}>
              <Text style={styles.modalStatValue}>{client.preferredPackage || 'None'}</Text>
              <Text style={styles.modalStatLabel}>Package</Text>
            </View>
          </View>

          <View style={styles.modalInfoRow}>
            <Phone size={14} color={Colors.textMuted} />
            <Text style={styles.modalInfoText}>{client.phone}</Text>
          </View>

          {client.notes ? (
            <View style={styles.modalNotes}>
              <Text style={styles.modalNotesLabel}>Notes</Text>
              <Text style={styles.modalNotesText}>{client.notes}</Text>
            </View>
          ) : null}

          {clientGalleries.length > 0 && (
            <View style={styles.modalGalleries}>
              <Text style={styles.modalGalleriesTitle}>Galleries ({clientGalleries.length})</Text>
              {clientGalleries.map((g) => (
                <View key={g.id} style={styles.modalGalleryItem}>
                  <Image 
                    source={{ uri: g.coverImage }} 
                    style={styles.modalGalleryThumb} 
                    contentFit="cover" 
                    transition={200}
                    cachePolicy="memory-disk"
                  />
                  <View style={styles.modalGalleryInfo}>
                    <Text style={styles.modalGalleryTitle}>{g.title}</Text>
                    <Text style={styles.modalGallerySub}>{g.photoCount} photos · {g.accessCode}</Text>
                  </View>
                  <View style={[styles.miniStatusBadge, { backgroundColor: g.isPaid ? Colors.success + '20' : Colors.warning + '20' }]}>
                    <Text style={[styles.miniStatusText, { color: g.isPaid ? Colors.success : Colors.warning }]}>
                      {g.isPaid ? 'Paid' : 'Unpaid'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={styles.modalActions}>
            <Pressable
              style={styles.modalActionButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push({
                  pathname: '/(admin)/upload',
                  params: { clientId: client.id, clientName: client.name } as any,
                });
              }}
            >
              <LinearGradient colors={[Colors.gold, Colors.goldDark]} style={styles.modalActionGradient}>
                <Images size={16} color={Colors.background} />
                <Text style={styles.modalActionButtonText}>Upload Gallery</Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              style={styles.modalSecondaryButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Alert.alert('SMS', `Send SMS to ${client.name}`);
              }}
            >
              <Send size={16} color={Colors.gold} />
              <Text style={styles.modalSecondaryText}>Send SMS</Text>
            </Pressable>
          </View>
        </ScrollView>

        <Pressable style={styles.modalCloseBtn} onPress={onClose}>
          <X size={18} color={Colors.textMuted} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

export default function AdminClientsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { verifyAdminGuard } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('clients');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedClient, setSelectedClient] = useState<AdminClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateClientModal, setShowCreateClientModal] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientNotes, setNewClientNotes] = useState('');
  
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [galleries, setGalleries] = useState<AdminGallery[]>([]);

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [dbClients, dbGalleries] = await Promise.all([
        AdminService.clients.list(),
        AdminService.gallery.list()
      ]);

      // Transform Clients
      const transformedClients: AdminClient[] = (dbClients || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        avatar: c.user_profiles?.avatar_url || 'https://via.placeholder.com/150',
        phone: c.phone || 'No phone',
        email: c.email || '',
        loyaltyLevel: c.total_paid > 50000 ? 'Gold' : c.total_paid > 10000 ? 'Silver' : 'Bronze',
        totalSpent: c.total_paid || 0,
        totalGalleries: dbGalleries.filter((g: any) => g.client_id === c.id).length,
        preferredPackage: c.preferred_package,
        notes: c.notes
      }));

      // Transform Galleries
      const transformedGalleries: AdminGallery[] = (dbGalleries || []).map((g: any) => ({
        id: g.id,
        clientId: g.client_id,
        clientName: g.clients?.name || 'Unknown',
        title: g.name,
        coverImage: g.cover_photo_url || 'https://via.placeholder.com/400x300',
        photoCount: 0, // TODO: Count photos
        accessCode: g.access_code,
        isLocked: g.is_locked,
        isPaid: g.is_paid,
        price: g.price || 0,
        status: g.scheduled_release ? 'scheduled' : 'active'
      }));

      setClients(transformedClients);
      setGalleries(transformedGalleries);
    } catch (error) {
      console.error('Failed to load admin data:', error);
      const rawMessage =
        (error as any)?.message ||
        (error as any)?.details ||
        (error as any)?.hint ||
        String(error || '');
      const lowerMessage = rawMessage.toLowerCase();
      const status = (error as any)?.status || (error as any)?.code;
      if (
        lowerMessage.includes('not authenticated') ||
        lowerMessage.includes('auth session missing') ||
        lowerMessage.includes('jwt') ||
        lowerMessage.includes('unauthorized') ||
        lowerMessage.includes('forbidden') ||
        lowerMessage.includes('permission') ||
        lowerMessage.includes('row level security') ||
        status === 401 ||
        status === 403
      ) {
        Alert.alert(
          'Session Expired',
          'Please log in again to load clients and galleries.',
          [{ text: 'Login', onPress: () => router.replace('/admin-login') }]
        );
        return;
      }
      if (
        lowerMessage.includes('schema cache') ||
        lowerMessage.includes('does not exist') ||
        lowerMessage.includes('relation') ||
        lowerMessage.includes('missing')
      ) {
        Alert.alert(
          'Database Setup Required',
          `Some required tables or policies are missing. ${rawMessage}`
        );
        return;
      }
      if (
        lowerMessage.includes('failed to fetch') ||
        lowerMessage.includes('network') ||
        lowerMessage.includes('timeout')
      ) {
        Alert.alert(
          'Connection Error',
          'Unable to load clients and galleries. Please check your internet connection and try again.',
          [{ text: 'Retry', onPress: () => loadData() }]
        );
        return;
      }
      Alert.alert(
        'Load Failed',
        rawMessage || 'Unable to load clients and galleries.',
        [{ text: 'Retry', onPress: () => loadData() }]
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  const resetCreateClientForm = useCallback(() => {
    setNewClientName('');
    setNewClientPhone('');
    setNewClientEmail('');
    setNewClientNotes('');
  }, []);

  const handleCreateClient = useCallback(async () => {
    if (!newClientName.trim()) {
      Alert.alert('Missing Info', 'Please enter the client name.');
      return;
    }
    if (!newClientPhone.trim()) {
      Alert.alert('Missing Info', 'Please enter the client phone number.');
      return;
    }
    try {
      setCreatingClient(true);
      await AdminService.clients.create({
        name: newClientName.trim(),
        phone: newClientPhone.trim(),
        email: newClientEmail.trim() || undefined,
        notes: newClientNotes.trim() || undefined
      } as any);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowCreateClientModal(false);
      resetCreateClientForm();
      loadData(true);
    } catch (error: any) {
      Alert.alert('Client Creation Failed', error?.message || 'Unable to create client.');
    } finally {
      setCreatingClient(false);
    }
  }, [newClientName, newClientPhone, newClientEmail, newClientNotes, loadData, resetCreateClientForm]);

  useEffect(() => {
    let unsubClients: (() => void) | undefined;
    let mounted = true;

    (async () => {
      const ok = await verifyAdminGuard('open_dashboard');
      if (!ok) {
        router.replace('/admin-login');
        return;
      }
      if (!mounted) return;
      loadData();
      unsubClients = AdminService.clients.subscribe(() => loadData(true));
    })();

    return () => {
      mounted = false;
      if (unsubClients) unsubClients();
    };
  }, [loadData, router, verifyAdminGuard]);

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter(
      c => c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.email.toLowerCase().includes(q)
    );
  }, [searchQuery, clients]);

  const filteredGalleries = useMemo(() => {
    if (!searchQuery.trim()) return galleries;
    const q = searchQuery.toLowerCase();
    return galleries.filter(
      g => g.title.toLowerCase().includes(q) || g.clientName.toLowerCase().includes(q) || g.accessCode.toLowerCase().includes(q)
    );
  }, [searchQuery, galleries]);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.headerTitle}>Clients & Galleries</Text>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Search size={16} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder={viewMode === 'clients' ? 'Search clients...' : 'Search galleries...'}
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              testID="admin-search"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <X size={14} color={Colors.textMuted} />
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.viewToggle}>
          <Pressable
            style={[styles.toggleBtn, viewMode === 'clients' && styles.toggleBtnActive]}
            onPress={() => { setViewMode('clients'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          >
            <Text style={[styles.toggleText, viewMode === 'clients' && styles.toggleTextActive]}>
              Clients ({clients.length})
            </Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, viewMode === 'galleries' && styles.toggleBtnActive]}
            onPress={() => { setViewMode('galleries'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          >
            <Text style={[styles.toggleText, viewMode === 'galleries' && styles.toggleTextActive]}>
              Galleries ({galleries.length})
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={Colors.gold} />
        }
      >
        {viewMode === 'clients' ? (
          filteredClients.length > 0 ? (
            filteredClients.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedClient(client);
                }}
              />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Search size={40} color={Colors.textMuted} />
              <Text style={styles.emptyStateText}>No clients found</Text>
            </View>
          )
        ) : (
          filteredGalleries.length > 0 ? (
            filteredGalleries.map((gallery) => (
              <GalleryCard key={gallery.id} gallery={gallery} />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Images size={40} color={Colors.textMuted} />
              <Text style={styles.emptyStateText}>No galleries found</Text>
            </View>
          )
        )}
      </ScrollView>

      <Pressable
        style={styles.fab}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          setShowCreateClientModal(true);
        }}
      >
        <LinearGradient colors={[Colors.gold, Colors.goldDark]} style={styles.fabGradient}>
          <UserPlus size={22} color={Colors.background} />
        </LinearGradient>
      </Pressable>

      {selectedClient && (
        <ClientDetailModal client={selectedClient} galleries={galleries} onClose={() => setSelectedClient(null)} />
      )}

      <Modal
        visible={showCreateClientModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateClientModal(false)}
      >
        <View style={styles.createModalBackdrop}>
          <View style={styles.createModalCard}>
            <View style={styles.createModalHeader}>
              <Text style={styles.createModalTitle}>Create Client</Text>
              <Pressable onPress={() => setShowCreateClientModal(false)}>
                <X size={20} color={Colors.textMuted} />
              </Pressable>
            </View>
            <View style={styles.createModalBody}>
              <View style={styles.createModalInputRow}>
                <UserPlus size={18} color={Colors.textMuted} />
                <TextInput
                  style={styles.createModalInput}
                  placeholder="Client Name"
                  placeholderTextColor={Colors.textMuted}
                  value={newClientName}
                  onChangeText={setNewClientName}
                />
              </View>
              <View style={styles.createModalInputRow}>
                <Phone size={18} color={Colors.textMuted} />
                <TextInput
                  style={styles.createModalInput}
                  placeholder="Phone Number"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="phone-pad"
                  value={newClientPhone}
                  onChangeText={setNewClientPhone}
                />
              </View>
              <View style={styles.createModalInputRow}>
                <Send size={18} color={Colors.textMuted} />
                <TextInput
                  style={styles.createModalInput}
                  placeholder="Email (optional)"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="email-address"
                  value={newClientEmail}
                  onChangeText={setNewClientEmail}
                />
              </View>
              <View style={styles.createModalInputRow}>
                <TextInput
                  style={styles.createModalInput}
                  placeholder="Notes (optional)"
                  placeholderTextColor={Colors.textMuted}
                  value={newClientNotes}
                  onChangeText={setNewClientNotes}
                />
              </View>
            </View>
            <View style={styles.createModalActions}>
              <Pressable style={styles.createModalButton} onPress={() => setShowCreateClientModal(false)}>
                <Text style={styles.createModalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.createModalButton, styles.createModalPrimaryButton, creatingClient && styles.createModalButtonDisabled]}
                onPress={handleCreateClient}
                disabled={creatingClient}
              >
                <Text style={styles.createModalPrimaryButtonText}>{creatingClient ? 'Creating...' : 'Create'}</Text>
              </Pressable>
            </View>
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
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.white,
    marginBottom: 14,
  },
  searchRow: {
    marginBottom: 12,
  },
  searchBox: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.white,
  },
  viewToggle: {
    flexDirection: 'row' as const,
    gap: 0,
    backgroundColor: Colors.card,
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleBtnActive: {
    backgroundColor: Colors.goldMuted,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  toggleTextActive: {
    color: Colors.gold,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 100,
  },
  clientCard: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  clientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#333',
  },
  clientInfo: {
    flex: 1,
  },
  clientNameRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  clientName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  loyaltyBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  loyaltyText: {
    fontSize: 10,
    fontWeight: '600' as const,
  },
  clientPhone: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  clientMeta: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 6,
  },
  clientMetaText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  clientMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textMuted,
  },
  galleryCard: {
    borderRadius: 16,
    overflow: 'hidden' as const,
    marginBottom: 14,
    height: 240,
    backgroundColor: '#222',
  },
  galleryCover: {
    width: '100%',
    height: '100%',
  },
  galleryOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  galleryBadges: {
    position: 'absolute' as const,
    top: 12,
    left: 12,
    flexDirection: 'row' as const,
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
  },
  galleryContent: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
  },
  galleryTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.white,
    marginBottom: 2,
  },
  galleryClient: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  galleryCodeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  codeBox: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  codeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.gold,
    letterSpacing: 1,
  },
  galleryPrice: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  galleryActions: {
    flexDirection: 'row' as const,
    gap: 10,
  },
  galleryActionBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  galleryActionText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyStateText: {
    fontSize: 15,
    color: Colors.textMuted,
  },
  fab: {
    position: 'absolute' as const,
    bottom: 24,
    right: 20,
    borderRadius: 18,
    overflow: 'hidden' as const,
    elevation: 8,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  modalContent: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#111111',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textMuted,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  modalCloseBtn: {
    position: 'absolute' as const,
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalAvatar: {
    width: 72,
    height: 72,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: Colors.goldMuted,
    backgroundColor: '#333',
  },
  modalName: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.white,
    marginBottom: 8,
  },
  modalStats: {
    flexDirection: 'row' as const,
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  modalStat: {
    flex: 1,
    alignItems: 'center',
  },
  modalStatValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.white,
    marginBottom: 2,
  },
  modalStatLabel: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  modalStatDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },
  modalInfoRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  modalInfoText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  modalNotes: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  modalNotesLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  modalNotesText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  modalGalleries: {
    marginBottom: 20,
  },
  modalGalleriesTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.white,
    marginBottom: 10,
  },
  modalGalleryItem: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    gap: 10,
  },
  modalGalleryThumb: {
    width: 48,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#333',
  },
  modalGalleryInfo: {
    flex: 1,
  },
  modalGalleryTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  modalGallerySub: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  miniStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  miniStatusText: {
    fontSize: 9,
    fontWeight: '700' as const,
  },
  modalActions: {
    gap: 10,
  },
  modalActionButton: {
    borderRadius: 14,
    overflow: 'hidden' as const,
  },
  modalActionGradient: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    gap: 8,
    borderRadius: 14,
  },
  modalActionButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.background,
  },
  modalSecondaryButton: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.goldMuted,
  },
  modalSecondaryText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.gold,
  },
  createModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  createModalCard: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: Colors.card,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  createModalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  createModalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  createModalBody: {
    gap: 10,
  },
  createModalInputRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  createModalInput: {
    flex: 1,
    color: Colors.white,
    fontSize: 14,
  },
  createModalActions: {
    flexDirection: 'row' as const,
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  createModalButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  createModalButtonText: {
    color: Colors.textMuted,
    fontWeight: '600' as const,
  },
  createModalPrimaryButton: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },
  createModalPrimaryButtonText: {
    color: Colors.background,
    fontWeight: '700' as const,
  },
  createModalButtonDisabled: {
    opacity: 0.6,
  },
});
