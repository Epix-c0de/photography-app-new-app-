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
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import Colors from '@/constants/colors';
import { AdminService } from '@/services/admin';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

type Client = {
  id: string;
  name: string;
  avatar: string;
  phone: string;
  total_galleries: number;
  loyalty_level: string;
  created_at: string;
};

const loyaltyColors: Record<string, string> = {
  Bronze: '#CD7F32',
  Silver: '#C0C0C0',
  Gold: '#D4AF37',
  Platinum: '#E5E4E2',
};

function ClientCard({ client, onPress, onUpload, onMessage }: {
  client: Client;
  onPress: () => void;
  onUpload: () => void;
  onMessage: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.clientCard, pressed && styles.clientCardPressed]}
      onPress={onPress}
    >
      <Image
        source={{ uri: client.avatar || 'https://via.placeholder.com/100' }}
        style={styles.clientAvatar}
        contentFit="cover"
      />
      <View style={styles.clientInfo}>
        <View style={styles.clientHeader}>
          <Text style={styles.clientName} numberOfLines={1}>{client.name}</Text>
          {client.loyalty_level && client.loyalty_level !== 'Unknown' && (
            <View style={[styles.loyaltyBadge, { backgroundColor: (loyaltyColors[client.loyalty_level] || '#333') + '20' }]}>
              <Crown size={10} color={loyaltyColors[client.loyalty_level] || '#333'} />
              <Text style={[styles.loyaltyText, { color: loyaltyColors[client.loyalty_level] || '#333' }]}>
                {client.loyalty_level}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.clientPhone}>{client.phone}</Text>
        <Text style={styles.clientGalleries}>{client.total_galleries} galleries</Text>
      </View>
      <View style={styles.clientActions}>
        <Pressable style={styles.actionBtn} onPress={onUpload}>
          <Upload size={16} color={Colors.gold} />
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={onMessage}>
          <MessageSquare size={16} color="#3B82F6" />
        </Pressable>
      </View>
    </Pressable>
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

  const loadClients = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await AdminService.getClients(user.id);
      setClients(data);
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

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

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

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Clients</Text>
          <Text style={styles.subtitle}>{clients.length} total</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/(admin)/clients/new')}
        >
          <UserPlus size={20} color="#080810" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Search size={16} color="rgba(255,255,255,0.4)" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search clients..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {/* Client List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
      >
        {filteredClients.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No clients found</Text>
            <Text style={styles.emptySubtitle}>
              {search ? 'Try a different search' : 'Add your first client'}
            </Text>
          </View>
        ) : (
          filteredClients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onPress={() => router.push(`/(admin)/clients/${client.id}`)}
              onUpload={() => router.push(`/(admin)/upload/new?clientId=${client.id}`)}
              onMessage={() => Alert.alert('Message', `Send SMS to ${client.name}`)}
            />
          ))
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
    marginLeft: 8,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
  },
  emptySubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 4,
  },
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  clientCardPressed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  clientAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  clientInfo: {
    flex: 1,
    marginLeft: 12,
  },
  clientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
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
    borderRadius: 12,
    gap: 4,
  },
  loyaltyText: {
    fontSize: 10,
    fontWeight: '700',
  },
  clientPhone: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 2,
  },
  clientGalleries: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  clientActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
