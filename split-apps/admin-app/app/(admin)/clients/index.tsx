import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Animated,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  Search,
  UserPlus,
  Phone,
  Images,
  ChevronRight,
  Upload,
  MessageSquare,
  Crown,
  Trash2,
  Users,
  Star,
  TrendingUp,
  Filter,
  ArrowUpRight,
  Camera,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import Colors from '@/constants/colors';
import { AdminService } from '@/services/admin';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Client = {
  id: string;
  name: string;
  avatar: string;
  phone: string;
  total_galleries: number;
  loyalty_level: string;
  created_at: string;
};

type FilterType = 'all' | 'recent' | 'galleries';

const loyaltyColors: Record<string, string> = {
  Bronze: '#CD7F32',
  Silver: '#C0C0C0',
  Gold: '#D4AF37',
  Platinum: '#E5E4E2',
};

const loyaltyGradients: Record<string, readonly [string, string]> = {
  Bronze:   ['#CD7F32', '#8B5A2B'],
  Silver:   ['#C0C0C0', '#808080'],
  Gold:     ['#D4AF37', '#B8860B'],
  Platinum: ['#E5E4E2', '#A9A9A9'],
};

function ClientCard({ client, onPress, onUpload, onMessage, index }: {
  client: Client;
  onPress: () => void;
  onUpload: () => void;
  onMessage: () => void;
  index: number;
}) {
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        delay: index * 80,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const loyaltyGradient = (loyaltyGradients[client.loyalty_level] || ['#333333', '#222222']) as readonly [string, string];
  const hasGalleries = client.total_galleries > 0;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }], opacity: opacityAnim }}>
      <Pressable
        style={({ pressed }) => [styles.clientCard, pressed && styles.clientCardPressed]}
        onPress={onPress}
      >
        {/* Avatar with loyalty ring */}
        <View style={styles.avatarContainer}>
          <View style={[styles.avatarRing, { borderColor: loyaltyColors[client.loyalty_level] || '#333' }]}>
            <Image
              source={{ uri: client.avatar || 'https://via.placeholder.com/100' }}
              style={styles.clientAvatar}
              contentFit="cover"
            />
          </View>
          {hasGalleries && (
            <View style={styles.galleryBadge}>
              <Camera size={10} color="#FFF" />
            </View>
          )}
        </View>

        {/* Client Info */}
        <View style={styles.clientInfo}>
          <View style={styles.clientHeader}>
            <Text style={styles.clientName} numberOfLines={1}>{client.name}</Text>
            {client.loyalty_level && client.loyalty_level !== 'Unknown' && (
              <LinearGradient
                colors={loyaltyGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.loyaltyBadge}
              >
                <Crown size={9} color="#FFF" />
                <Text style={styles.loyaltyText}>{client.loyalty_level}</Text>
              </LinearGradient>
            )}
          </View>
          <View style={styles.clientMeta}>
            <Phone size={11} color="rgba(255,255,255,0.35)" />
            <Text style={styles.clientPhone}>{client.phone || 'No phone'}</Text>
          </View>
          <View style={styles.clientStats}>
            <View style={[styles.statPill, hasGalleries && styles.statPillActive]}>
              <Images size={10} color={hasGalleries ? Colors.gold : 'rgba(255,255,255,0.3)'} />
              <Text style={[styles.statPillText, hasGalleries && styles.statPillTextActive]}>
                {client.total_galleries} {client.total_galleries === 1 ? 'gallery' : 'galleries'}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.clientActions}>
          <Pressable
            style={[styles.actionBtn, styles.uploadBtn]}
            onPress={onUpload}
          >
            <Upload size={14} color={Colors.gold} />
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.messageBtn]}
            onPress={onMessage}
          >
            <MessageSquare size={14} color="#3B82F6" />
          </Pressable>
          <Pressable style={styles.chevronBtn} onPress={onPress}>
            <ChevronRight size={16} color="rgba(255,255,255,0.2)" />
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function ClientsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const loadClients = useCallback(async () => {
    if (!user?.id) return;
    try {
      const raw = await AdminService.clients.list();
      const mapped: Client[] = (raw || []).map((c: any) => ({
        id: c.id,
        name: c.name || 'Unknown',
        avatar: c.avatar_url || '',
        phone: c.phone || '',
        total_galleries: c.total_galleries ?? c.total_spent ?? 0,
        loyalty_level: c.loyalty_level || 'Bronze',
        created_at: c.created_at || new Date().toISOString(),
      }));
      setClients(mapped);
    } catch (e) {
      console.warn('Failed to load clients:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { loadClients(); }, [loadClients]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadClients();
  }, [loadClients]);

  const filteredClients = clients
    .filter((c) => {
      const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.phone?.includes(search);
      if (!matchesSearch) return false;
      if (activeFilter === 'recent') {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return new Date(c.created_at) > weekAgo;
      }
      if (activeFilter === 'galleries') return c.total_galleries > 0;
      return true;
    })
    .sort((a, b) => {
      if (activeFilter === 'galleries') return b.total_galleries - a.total_galleries;
      return 0;
    });

  const totalGalleries = clients.reduce((sum, c) => sum + c.total_galleries, 0);
  const topClient = [...clients].sort((a, b) => b.total_galleries - a.total_galleries)[0];

  const handleDelete = async (id: string) => {
    Alert.alert('Remove Client', 'Are you sure? This will remove their access.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await supabase.from('clients').delete().eq('id', id);
            setClients((prev) => prev.filter((c) => c.id !== id));
          } catch (e) {
            console.warn('Delete failed:', e);
          }
        },
      },
    ]);
  };

  const handleCopyPhone = async (phone: string) => {
    await Clipboard.setStringAsync(phone);
    Alert.alert('Copied', 'Phone number copied to clipboard');
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.gold} />
          <Text style={styles.loadingText}>Loading clients...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Hero Header */}
      <View style={styles.heroHeader}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroTitle}>Clients</Text>
            <Text style={styles.heroSubtitle}>Manage your client relationships</Text>
          </View>
          <Pressable
            style={styles.addButton}
            onPress={() => router.push('/(admin)/clients/new')}
          >
            <LinearGradient
              colors={[Colors.gold, Colors.goldDark || '#B8860B']}
              style={styles.addButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <UserPlus size={20} color="#080810" strokeWidth={2.5} />
            </LinearGradient>
          </Pressable>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: 'rgba(212,175,55,0.12)' }]}>
              <Users size={16} color={Colors.gold} />
            </View>
            <Text style={styles.statNumber}>{clients.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
              <Images size={16} color="#3B82F6" />
            </View>
            <Text style={styles.statNumber}>{totalGalleries}</Text>
            <Text style={styles.statLabel}>Galleries</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: 'rgba(46,204,113,0.12)' }]}>
              <Star size={16} color="#2ECC71" />
            </View>
            <Text style={styles.statNumber} numberOfLines={1}>
              {topClient ? topClient.name.split(' ')[0] : '—'}
            </Text>
            <Text style={styles.statLabel}>Top Client</Text>
          </View>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <Search size={16} color="rgba(255,255,255,0.3)" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or phone..."
            placeholderTextColor="rgba(255,255,255,0.25)"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <Text style={styles.clearSearch}>✕</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        {(['all', 'recent', 'galleries'] as FilterType[]).map((filter) => (
          <Pressable
            key={filter}
            style={[styles.filterChip, activeFilter === filter && styles.filterChipActive]}
            onPress={() => setActiveFilter(filter)}
          >
            <Text style={[styles.filterChipText, activeFilter === filter && styles.filterChipTextActive]}>
              {filter === 'all' ? 'All Clients' : filter === 'recent' ? 'Recent' : 'With Galleries'}
            </Text>
            {activeFilter === filter && (
              <View style={styles.filterDot} />
            )}
          </Pressable>
        ))}
      </View>

      {/* Client List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
      >
        {filteredClients.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <Users size={40} color="rgba(255,255,255,0.15)" />
            </View>
            <Text style={styles.emptyTitle}>
              {search ? 'No clients found' : 'No clients yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {search
                ? 'Try adjusting your search or filters'
                : 'Add your first client to get started'}
            </Text>
            {!search && (
              <Pressable
                style={styles.emptyAction}
                onPress={() => router.push('/(admin)/clients/new')}
              >
                <LinearGradient
                  colors={[Colors.gold, Colors.goldDark || '#B8860B']}
                  style={styles.emptyActionGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <UserPlus size={16} color="#080810" />
                  <Text style={styles.emptyActionText}>Add First Client</Text>
                </LinearGradient>
              </Pressable>
            )}
          </View>
        ) : (
          <>
            <Text style={styles.resultCount}>
              {filteredClients.length} client{filteredClients.length !== 1 ? 's' : ''}
            </Text>
            {filteredClients.map((client, index) => (
              <ClientCard
                key={client.id}
                client={client}
                index={index}
                onPress={() => router.push(`/(admin)/clients/${client.id}` as any)}
                onUpload={() => router.push(`/(admin)/upload/new?clientId=${client.id}`)}
                onMessage={() => {
                  if (client.phone) {
                    handleCopyPhone(client.phone);
                  } else {
                    Alert.alert('No Phone', 'This client has no phone number on file.');
                  }
                }}
              />
            ))}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '500',
  },
  // Hero Header
  heroHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 4,
  },
  addButton: {
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  addButtonGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Stats Row
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 4,
  },
  // Search
  searchSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
    marginLeft: 10,
  },
  clearSearch: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 4,
  },
  // Filter Chips
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  filterChipTextActive: {
    color: '#080810',
  },
  filterDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#080810',
  },
  // List
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  resultCount: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: '500',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Client Card
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  clientCardPressed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(212,175,55,0.2)',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    padding: 2,
  },
  clientAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  galleryBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  clientInfo: {
    flex: 1,
    marginLeft: 12,
  },
  clientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    marginRight: 8,
  },
  loyaltyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  loyaltyText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clientMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  clientPhone: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
  },
  clientStats: {
    flexDirection: 'row',
    gap: 6,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  statPillActive: {
    backgroundColor: 'rgba(212,175,55,0.1)',
  },
  statPillText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: '500',
  },
  statPillTextActive: {
    color: Colors.gold,
  },
  clientActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadBtn: {
    backgroundColor: 'rgba(212,175,55,0.1)',
  },
  messageBtn: {
    backgroundColor: 'rgba(59,130,246,0.1)',
  },
  chevronBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyAction: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  emptyActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  emptyActionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#080810',
  },
});
