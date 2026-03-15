import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Animated, Alert, ActivityIndicator, RefreshControl, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
  Trash2,
  Megaphone,
  Upload,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import Colors from '@/constants/colors';
import { AdminService } from '@/services/admin';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

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

function ClientCard({ client, onPress, onPressShortcut }: { client: AdminClient; onPress: () => void; onPressShortcut: (type: 'upload') => void }) {
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
        <Pressable 
          style={styles.uploadShortcut} 
          onPress={(e) => {
            e.stopPropagation();
            onPressShortcut('upload');
          }}
          hitSlop={12}
        >
          <Upload size={18} color={Colors.gold} />
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}

function GalleryCard({ gallery, onDeleted }: { gallery: AdminGallery; onDeleted: (id: string) => void }) {
  const router = useRouter();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);

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

  const handleDelete = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Delete Gallery',
      `Are you sure you want to delete "${gallery.title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              await AdminService.gallery.delete(gallery.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onDeleted(gallery.id);
            } catch (e) {
              const message = (e as any)?.message || 'Failed to delete gallery';
              Alert.alert('Error', message);
            } finally {
              setIsDeleting(false);
            }
          }
        }
      ]
    );
  }, [gallery]);

  const handlePromote = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Promote to Announcement',
      `Create an announcement for "${gallery.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Promote',
          style: 'default',
          onPress: async () => {
            try {
              setIsPromoting(true);
              await AdminService.gallery.promoteToAnnouncement(
                gallery.id,
                `New Gallery: ${gallery.title}`,
                `Check out the photos from ${gallery.title}!`
              );
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Success', 'Announcement created successfully');
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to promote gallery');
            } finally {
              setIsPromoting(false);
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
      onPress={() => {
        router.push({
          pathname: '/(admin)/clients/gallery/[id]',
          params: { id: gallery.id }
        });
      }}
    >
      <Animated.View style={[styles.galleryCard, { transform: [{ scale: scaleAnim }] }]}>
        <Image
          source={{ uri: gallery.coverImage }}
          style={styles.galleryCover}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.galleryOverlay} />

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
              <Text style={styles.galleryActionText}>Code</Text>
            </Pressable>
            <Pressable style={styles.galleryActionBtn} onPress={handleToggleLock}>
              {gallery.isLocked ? <Unlock size={13} color={Colors.success} /> : <Lock size={13} color={Colors.warning} />}
              <Text style={styles.galleryActionText}>{gallery.isLocked ? 'Unlock' : 'Lock'}</Text>
            </Pressable>
            <Pressable style={styles.galleryActionBtn} onPress={handlePromote} disabled={isPromoting}>
              {isPromoting ? <ActivityIndicator size="small" color={Colors.gold} /> : <Megaphone size={13} color={Colors.gold} />}
              <Text style={styles.galleryActionText}>Promote</Text>
            </Pressable>
            <Pressable style={[styles.galleryActionBtn, styles.deleteBtn]} onPress={handleDelete} disabled={isDeleting}>
              {isDeleting ? <ActivityIndicator size="small" color={Colors.error} /> : <Trash2 size={13} color={Colors.error} />}
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

function ClientDetailModal({ client, galleries, onClose }: { client: AdminClient; galleries: AdminGallery[]; onClose: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const clientGalleries = useMemo(
    () => galleries.filter(g => g.clientId === client.id),
    [client.id, galleries]
  );

  return (
    <Modal
      visible={true}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.fullScreenContainer, { paddingTop: insets.top }]}>
        <View style={styles.fullScreenHeader}>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <X size={24} color={Colors.white} />
          </Pressable>
          <Text style={styles.fullScreenTitle}>Client Details</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.fullScreenContent}>
          <View style={styles.modalHeader}>
            <Image source={{ uri: client.avatar }} style={styles.modalAvatar} />
            <Text style={styles.modalName}>{client.name}</Text>
            <View style={[styles.loyaltyBadge, { backgroundColor: (loyaltyColors[client.loyaltyLevel] || Colors.gold) + '20' }]}>
              <Crown size={12} color={loyaltyColors[client.loyaltyLevel] || Colors.gold} />
              <Text style={[styles.loyaltyText, { color: loyaltyColors[client.loyaltyLevel] || Colors.gold }]}>{client.loyaltyLevel}</Text>
            </View>
            <View style={styles.contactRow}>
              <Text style={styles.contactText}>{client.phone}</Text>
              {client.email && (
                <>
                  <Text style={styles.contactDot}>•</Text>
                  <Text style={styles.contactText}>{client.email}</Text>
                </>
              )}
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
              <Text style={styles.modalStatValue}>{client.loyaltyLevel}</Text>
              <Text style={styles.modalStatLabel}>Status</Text>
            </View>
          </View>
          
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Galleries ({clientGalleries.length})</Text>
          </View>

          {clientGalleries.length > 0 ? (
            clientGalleries.map(gallery => (
              <GalleryCard 
                key={gallery.id} 
                gallery={gallery} 
                onDeleted={() => {}} // No-op in modal, or handle deletion
              />
            ))
          ) : (
            <Text style={styles.emptyText}>No galleries found for this client.</Text>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function AdminClientsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const { verifyAdminGuard, user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('clients');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateClientModal, setShowCreateClientModal] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientNotes, setNewClientNotes] = useState('');

  const [selectedClient, setSelectedClient] = useState<AdminClient | null>(null);
  const [clients, setClients] = useState<AdminClient[]>(AdminService.cache.get('clients') || []);
  const [galleries, setGalleries] = useState<AdminGallery[]>(AdminService.cache.get('galleries') || []);

  useEffect(() => {
    if (clientId && clients.length > 0) {
      const client = clients.find((c) => c.id === clientId);
      if (client) {
        setSelectedClient(client);
      }
    }
  }, [clientId, clients]);

  const loadData = useCallback(async (force = false) => {
    try {
      // Always fetch fresh data when force=true, otherwise check cache
      if (!force) {
        const cachedClients = AdminService.cache.get('clients');
        const cachedGalleries = AdminService.cache.get('galleries');
        if (cachedClients && cachedGalleries && cachedClients.length > 0 && cachedGalleries.length > 0) {
          console.log('[AdminClients] Using cached data:', { clients: cachedClients.length, galleries: cachedGalleries.length });
          setClients(cachedClients);
          setGalleries(cachedGalleries);
          setLoading(false);
          return;
        }
      }

      if (!user) {
        console.warn('[AdminClients] No user, aborting loadData');
        setLoading(false);
        return;
      }

      setRefreshing(true);
      console.log('[AdminClients] Fetching fresh data...');
      console.log('[AdminClients] User:', user);
      
      const [clientsData, galleriesResult] = await Promise.all([
        AdminService.clients.list(),
        AdminService.gallery.list()
      ]);

      console.log('[AdminClients] Raw data:', { 
        clientsData: clientsData?.length || 0, 
        galleriesResult: galleriesResult?.length || 0,
        firstClient: clientsData?.[0],
        firstGallery: galleriesResult?.[0]
      });

      // Transform Clients
      const transformedClients: AdminClient[] = (clientsData || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        avatar: c.avatar_url || 'https://via.placeholder.com/150',
        phone: c.phone || '',
        email: c.email || '',
        loyaltyLevel: c.loyalty_level || 'Bronze',
        totalSpent: c.total_spent || 0,
        totalGalleries: c.total_galleries || 0,
        preferredPackage: c.preferred_package,
        notes: c.notes,
      }));

      // Transform Galleries with Signed URLs
      const transformedGalleries = (galleriesResult || []).map((g: any) => ({
        id: g.id,
        clientId: g.client_id,
        clientName: g.clients?.name || 'Unknown',
        title: g.name,
        coverImage: g.derived_cover_image || g.cover_photo_url || 'https://via.placeholder.com/400x300',
        photoCount: g.photo_count || 0,
        accessCode: g.access_code,
        isLocked: g.is_locked,
        isPaid: g.is_paid,
        price: g.price_quote || 0,
        status: g.status,
      }));

      console.log('[AdminClients] Transformed:', { clients: transformedClients.length, galleries: transformedGalleries.length });

      setClients(transformedClients);
      setGalleries(transformedGalleries);

    } catch (error: any) {
      console.error('Error loading data:', error);
      Alert.alert('Error', error.message || 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

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
    let unsubGalleries: (() => void) | undefined;
    let mounted = true;

    (async () => {
      const ok = await verifyAdminGuard('open_dashboard');
      if (!ok) {
        router.replace('/admin-login');
        return;
      }
      if (!mounted) return;
      // Force initial fetch to avoid stale empty cache
      await loadData(true);
      unsubClients = AdminService.clients.subscribe(() => loadData(true));
      unsubGalleries = AdminService.gallery.subscribe(() => loadData(true));
    })();

    return () => {
      mounted = false;
      if (unsubClients) unsubClients();
      if (unsubGalleries) unsubGalleries();
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
                onPressShortcut={(type) => {
                  if (type === 'upload') {
                    router.push({
                      pathname: '/(admin)/upload',
                      params: { userId: client.id }
                    } as any);
                  }
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
              <GalleryCard
                key={gallery.id}
                gallery={gallery}
                onDeleted={(id) => {
                  setGalleries((prev) => prev.filter((g) => g.id !== id));
                }}
              />
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
  fullScreenContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  fullScreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  fullScreenTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
  fullScreenContent: {
    padding: 20,
  },
  closeButton: {
    padding: 8,
    marginLeft: -8,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  contactText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  contactDot: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textMuted,
    fontStyle: 'italic',
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
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  deleteBtn: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
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
  uploadShortcut: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(212,175,55,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
