import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, Alert, RefreshControl, Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import {
  ArrowLeft, Phone, Mail, Camera, MessageSquare,
  Crown, Trash2, Images, DollarSign, Calendar,
  Copy, ChevronRight, FileText, Check,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { AdminService } from '@/services/admin';
import { supabase } from '@/lib/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const loyaltyColors: Record<string, string> = {
  Bronze: '#CD7F32', Silver: '#C0C0C0', Gold: '#D4AF37', Platinum: '#E5E4E2',
};

type ClientData = {
  id: string;
  user_id: string | null;
  name: string;
  phone: string;
  email: string;
  avatar_url: string | null;
  loyalty_level: string;
  total_spent: number;
  total_galleries: number;
  notes: string;
  last_shoot_date: string | null;
  created_at: string;
};

type GalleryData = {
  id: string;
  name: string;
  access_code: string;
  is_paid: boolean;
  is_locked: boolean;
  shoot_type: string;
  price: number;
  created_at: string;
  photo_count?: number;
};

export default function ClientDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [client, setClient] = useState<ClientData | null>(null);
  const [galleries, setGalleries] = useState<GalleryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const [clientList, galleryData] = await Promise.all([
        AdminService.clients.list(),
        supabase
          .from('galleries')
          .select('*')
          .eq('client_id', id)
          .order('created_at', { ascending: false }),
      ]);

      const found = clientList.find((c: any) => c.id === id);
      if (found) setClient(found);

      const { data: gals } = galleryData;
      if (gals) {
        const gIds = gals.map((g: any) => g.id);
        let photoCounts = new Map<string, number>();
        if (gIds.length > 0) {
          const { data: photos } = await supabase
            .from('gallery_photos')
            .select('gallery_id')
            .in('gallery_id', gIds);
          (photos || []).forEach((p: any) => {
            photoCounts.set(p.gallery_id, (photoCounts.get(p.gallery_id) || 0) + 1);
          });
        }
        setGalleries(gals.map((g: any) => ({
          ...g,
          photo_count: photoCounts.get(g.id) || 0,
        })));
      }
    } catch (e) {
      console.error('Failed to load client:', e);
    }
  }, [id]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadData();
      setLoading(false);
    })();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const copyPhone = async () => {
    if (client?.phone) {
      await Clipboard.setStringAsync(client.phone);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Copied', 'Phone number copied to clipboard');
    }
  };

  const copyAccessCode = async (code: string) => {
    await Clipboard.setStringAsync(code);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copied', `Access code ${code} copied`);
  };

  const toggleGallerySelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllGalleries = () => {
    if (selectedIds.size === galleries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(galleries.map(g => g.id)));
    }
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    Alert.alert(
      'Delete Galleries',
      `Delete ${selectedIds.size} gallery(ies) and all their photos? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const ids = Array.from(selectedIds);
              for (const gid of ids) {
                await supabase.from('gallery_photos').delete().eq('gallery_id', gid);
                await supabase.from('galleries').delete().eq('id', gid);
              }
              setGalleries(prev => prev.filter(g => !selectedIds.has(g.id)));
              setSelectedIds(new Set());
              setSelectMode(false);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to delete galleries');
            }
          }
        }
      ]
    );
  };

  const handleDeleteClient = () => {
    Alert.alert(
      'Delete Client',
      `Are you sure you want to delete ${client?.name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('clients').delete().eq('id', id!);
              if (error) throw error;
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to delete client');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.gold} />
        <Text style={styles.loadingText}>Loading client...</Text>
      </View>
    );
  }

  if (!client) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Client not found</Text>
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const totalSpent = galleries.reduce((sum, g) => sum + (g.price || 0), 0);
  const loyaltyColor = loyaltyColors[client.loyalty_level] || loyaltyColors.Bronze;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable style={styles.backBtn} onPress={() => { if (selectMode) { setSelectMode(false); setSelectedIds(new Set()); } else { router.back(); } }}>
            <ArrowLeft size={20} color={Colors.white} />
          </Pressable>
          <Text style={styles.headerTitle}>{selectMode ? `${selectedIds.size} selected` : 'Client Details'}</Text>
          {selectMode ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable style={[styles.deleteBtn, { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8, paddingHorizontal: 10 }]} onPress={selectAllGalleries}>
                <Text style={{ color: Colors.gold, fontSize: 12, fontWeight: '600' }}>{selectedIds.size === galleries.length ? 'None' : 'All'}</Text>
              </Pressable>
              {selectedIds.size > 0 && (
                <Pressable style={[styles.deleteBtn, { backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 8, paddingHorizontal: 10 }]} onPress={handleBatchDelete}>
                  <Trash2 size={16} color="#EF4444" />
                </Pressable>
              )}
            </View>
          ) : (
            <Pressable style={styles.deleteBtn} onPress={handleDeleteClient}>
              <Trash2 size={18} color={Colors.error} />
            </Pressable>
          )}
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <LinearGradient
            colors={[`${loyaltyColor}15`, 'rgba(255,255,255,0.02)']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={styles.profileRow}>
            <View style={[styles.avatar, { borderColor: loyaltyColor }]}>
              {client.avatar_url ? (
                <Image source={{ uri: client.avatar_url }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{(client.name || 'C')[0].toUpperCase()}</Text>
              )}
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.clientName}>{client.name}</Text>
              <Text style={styles.clientPhone}>{client.phone || 'No phone'}</Text>
              {client.email && <Text style={styles.clientEmail}>{client.email}</Text>}
            </View>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: `${Colors.gold}15` }]}>
                <Images size={14} color={Colors.gold} />
              </View>
              <Text style={styles.statValue}>{client.total_galleries || galleries.length}</Text>
              <Text style={styles.statLabel}>Galleries</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: 'rgba(46,204,113,0.15)' }]}>
                <DollarSign size={14} color={Colors.success} />
              </View>
              <Text style={styles.statValue}>KES {(totalSpent || client.total_spent || 0).toLocaleString()}</Text>
              <Text style={styles.statLabel}>Revenue</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: `${loyaltyColor}20` }]}>
                <Crown size={14} color={loyaltyColor} />
              </View>
              <Text style={[styles.statValue, { color: loyaltyColor }]}>{client.loyalty_level}</Text>
              <Text style={styles.statLabel}>Tier</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsRow}>
          <Pressable
            style={styles.actionCard}
            onPress={() => router.push(`/(admin)/upload/new?clientId=${client.id}` as any)}
          >
            <View style={[styles.actionIcon, { backgroundColor: `${Colors.gold}15` }]}>
              <Camera size={18} color={Colors.gold} />
            </View>
            <Text style={styles.actionText}>Upload</Text>
          </Pressable>

          <Pressable
            style={styles.actionCard}
            onPress={() => router.push('/(admin)/inbox' as any)}
          >
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
              <MessageSquare size={18} color="#3B82F6" />
            </View>
            <Text style={styles.actionText}>Chat</Text>
          </Pressable>

          <Pressable style={styles.actionCard} onPress={copyPhone}>
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(46,204,113,0.15)' }]}>
              <Phone size={18} color={Colors.success} />
            </View>
            <Text style={styles.actionText}>Call</Text>
          </Pressable>

          {client.email && (
            <Pressable style={styles.actionCard}>
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(139,92,246,0.15)' }]}>
                <Mail size={18} color="#8B5CF6" />
              </View>
              <Text style={styles.actionText}>Email</Text>
            </Pressable>
          )}
        </View>

        {/* Galleries Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Galleries</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {galleries.length > 0 && (
                <Pressable
                  onPress={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
                  style={{ backgroundColor: selectMode ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.06)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}
                >
                  <Text style={{ color: selectMode ? Colors.gold : Colors.textMuted, fontSize: 12, fontWeight: '600' }}>{selectMode ? 'Cancel' : 'Select'}</Text>
                </Pressable>
              )}
              <Text style={styles.sectionCount}>{galleries.length}</Text>
            </View>
          </View>

          {galleries.length === 0 ? (
            <View style={styles.emptyState}>
              <Images size={32} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No galleries yet</Text>
              <Pressable
                style={styles.emptyAction}
                onPress={() => router.push(`/(admin)/upload/new?clientId=${client.id}` as any)}
              >
                <Text style={styles.emptyActionText}>Create Gallery</Text>
              </Pressable>
            </View>
          ) : (
            galleries.map((gallery) => {
              const isSelected = selectedIds.has(gallery.id);
              return (
                <Pressable
                  key={gallery.id}
                  style={[styles.galleryCard, selectMode && isSelected && { borderColor: Colors.gold, borderWidth: 1 }]}
                  onPress={() => {
                    if (selectMode) {
                      toggleGallerySelect(gallery.id);
                    } else {
                      router.push(`/(admin)/clients/gallery/${gallery.id}` as any);
                    }
                  }}
                  onLongPress={() => {
                    if (!selectMode) {
                      setSelectMode(true);
                      setSelectedIds(new Set([gallery.id]));
                    }
                  }}
                >
                  {selectMode && (
                    <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: isSelected ? Colors.gold : 'rgba(255,255,255,0.2)', backgroundColor: isSelected ? Colors.gold : 'transparent', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                      {isSelected && <Check size={14} color={Colors.background} strokeWidth={3} />}
                    </View>
                  )}
                  <View style={styles.galleryInfo}>
                    <Text style={styles.galleryName}>{gallery.name}</Text>
                    <View style={styles.galleryMeta}>
                      <Text style={styles.galleryMetaText}>{gallery.shoot_type || 'Portrait'}</Text>
                      <Text style={styles.galleryDot}>•</Text>
                      <Text style={styles.galleryMetaText}>{gallery.photo_count || 0} photos</Text>
                      <Text style={styles.galleryDot}>•</Text>
                      <Text style={[styles.galleryMetaText, gallery.is_paid ? { color: Colors.success } : { color: Colors.textMuted }]}>
                        {gallery.is_paid ? 'Paid' : 'Free'}
                      </Text>
                    </View>
                    {gallery.price > 0 && (
                      <Text style={styles.galleryPrice}>KES {gallery.price.toLocaleString()}</Text>
                    )}
                  </View>
                  <View style={styles.galleryRight}>
                    <View style={[styles.codeBadge, gallery.is_locked && styles.codeBadgeLocked]}>
                      <Text style={styles.codeBadgeText}>{gallery.access_code}</Text>
                    </View>
                    {!selectMode && (
                      <Pressable onPress={() => copyAccessCode(gallery.access_code)}>
                        <Copy size={14} color={Colors.textMuted} />
                      </Pressable>
                    )}
                    <ChevronRight size={16} color={Colors.textMuted} />
                  </View>
                </Pressable>
              );
            })
          )}
        </View>

        {/* Client Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Information</Text>

          <View style={styles.infoRow}>
            <Calendar size={16} color={Colors.textMuted} />
            <Text style={styles.infoLabel}>Joined</Text>
            <Text style={styles.infoValue}>
              {client.created_at ? new Date(client.created_at).toLocaleDateString() : 'Unknown'}
            </Text>
          </View>

          {client.last_shoot_date && (
            <View style={styles.infoRow}>
              <Camera size={16} color={Colors.textMuted} />
              <Text style={styles.infoLabel}>Last Shoot</Text>
              <Text style={styles.infoValue}>
                {new Date(client.last_shoot_date).toLocaleDateString()}
              </Text>
            </View>
          )}

          {client.notes && (
            <View style={styles.infoRow}>
              <FileText size={16} color={Colors.textMuted} />
              <Text style={styles.infoLabel}>Notes</Text>
              <Text style={styles.infoValue}>{client.notes}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16 },
  loadingText: { fontSize: 14, color: Colors.textMuted, marginTop: 12 },
  errorText: { fontSize: 16, color: Colors.textMuted },
  backLink: { marginTop: 12 },
  backLinkText: { fontSize: 14, color: Colors.gold, fontWeight: '600' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: Colors.white },
  deleteBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(231,76,60,0.1)', alignItems: 'center', justifyContent: 'center',
  },
  profileCard: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    padding: 20, marginBottom: 16, overflow: 'hidden',
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  avatar: {
    width: 60, height: 60, borderRadius: 30, borderWidth: 2,
    backgroundColor: 'rgba(212,175,55,0.1)', alignItems: 'center', justifyContent: 'center',
  },
  avatarImage: { width: 56, height: 56, borderRadius: 28 },
  avatarText: { fontSize: 24, fontWeight: '800', color: Colors.gold },
  profileInfo: { flex: 1 },
  clientName: { fontSize: 20, fontWeight: '800', color: Colors.white, marginBottom: 2 },
  clientPhone: { fontSize: 14, color: Colors.textMuted },
  clientEmail: { fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 2 },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statIcon: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  statValue: { fontSize: 14, fontWeight: '700', color: Colors.white },
  statLabel: { fontSize: 11, color: Colors.textMuted },
  statDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.06)' },
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  actionCard: {
    flex: 1, alignItems: 'center', gap: 6, paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  actionIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  actionText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  section: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    padding: 16, marginBottom: 16,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.white, letterSpacing: 0.5 },
  sectionCount: {
    fontSize: 12, fontWeight: '700', color: Colors.gold,
    backgroundColor: 'rgba(212,175,55,0.12)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
  },
  emptyState: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyText: { fontSize: 14, color: Colors.textMuted },
  emptyAction: {
    marginTop: 8, paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: 'rgba(212,175,55,0.12)', borderRadius: 8,
  },
  emptyActionText: { fontSize: 13, fontWeight: '700', color: Colors.gold },
  galleryCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  galleryInfo: { flex: 1, marginRight: 12 },
  galleryName: { fontSize: 15, fontWeight: '700', color: Colors.white, marginBottom: 4 },
  galleryMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  galleryMetaText: { fontSize: 12, color: Colors.textMuted },
  galleryDot: { fontSize: 8, color: 'rgba(255,255,255,0.15)' },
  galleryPrice: { fontSize: 13, fontWeight: '700', color: Colors.gold, marginTop: 4 },
  galleryRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  codeBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    backgroundColor: 'rgba(212,175,55,0.1)',
  },
  codeBadgeLocked: { backgroundColor: 'rgba(231,76,60,0.1)' },
  codeBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.gold, letterSpacing: 0.5 },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  infoLabel: { flex: 1, fontSize: 13, color: Colors.textMuted },
  infoValue: { fontSize: 13, fontWeight: '600', color: Colors.white, textAlign: 'right', flex: 1.5 },
});
