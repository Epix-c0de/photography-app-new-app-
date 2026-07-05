import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import {
  Search,
  Plus,
  Filter,
  Image as ImageIcon,
  Lock,
  Unlock,
  ChevronRight,
  Calendar,
  Users,
  MoreVertical,
  Trash2,
  Share2,
  Edit3,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const { width } = Dimensions.get('window');

type Gallery = {
  id: string;
  title: string;
  cover_url: string | null;
  photo_count: number;
  client_name: string;
  client_id: string;
  is_locked: boolean;
  access_code: string;
  status: 'active' | 'scheduled' | 'archived';
  created_at: string;
};

type FilterType = 'all' | 'active' | 'locked' | 'archived';

export default function GalleriesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedGallery, setSelectedGallery] = useState<string | null>(null);

  const loadGalleries = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('galleries')
        .select(`
          id,
          title,
          cover_url,
          photo_count,
          is_locked,
          access_code,
          status,
          created_at,
          client_id,
          clients!inner (
            id,
            user_profiles!inner (
              full_name
            )
          )
        `)
        .eq('owner_admin_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map((g: any) => ({
        id: g.id,
        title: g.title,
        cover_url: g.cover_url,
        photo_count: g.photo_count || 0,
        client_name: g.clients?.user_profiles?.full_name || 'Unknown',
        client_id: g.client_id,
        is_locked: g.is_locked,
        access_code: g.access_code,
        status: g.status || 'active',
        created_at: g.created_at,
      }));

      setGalleries(formatted);
    } catch (e) {
      console.warn('Failed to load galleries:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { loadGalleries(); }, [loadGalleries]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadGalleries();
  }, [loadGalleries]);

  const filteredGalleries = galleries.filter((g) => {
    const matchesSearch = g.title.toLowerCase().includes(search.toLowerCase()) ||
      g.client_name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' ||
      (filter === 'active' && g.status === 'active') ||
      (filter === 'locked' && g.is_locked) ||
      (filter === 'archived' && g.status === 'archived');
    return matchesSearch && matchesFilter;
  });

  const handleDelete = async (id: string) => {
    Alert.alert('Delete Gallery', 'Are you sure? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await supabase.from('galleries').delete().eq('id', id);
            setGalleries((prev) => prev.filter((g) => g.id !== id));
          } catch (e) {
            console.warn('Delete failed:', e);
          }
        },
      },
    ]);
  };

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'locked', label: 'Locked' },
    { key: 'archived', label: 'Archived' },
  ];

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Galleries</Text>
          <Text style={styles.subtitle}>{galleries.length} total</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/(admin)/upload/new')}
        >
          <Plus size={20} color="#080810" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Search size={16} color="rgba(255,255,255,0.4)" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search galleries..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {filters.map((f) => (
          <Pressable
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Gallery List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
      >
        {filteredGalleries.length === 0 ? (
          <View style={styles.empty}>
            <ImageIcon size={48} color="rgba(255,255,255,0.2)" />
            <Text style={styles.emptyTitle}>No galleries found</Text>
            <Text style={styles.emptySubtitle}>
              {search ? 'Try a different search' : 'Create your first gallery'}
            </Text>
          </View>
        ) : (
          filteredGalleries.map((gallery) => (
            <Pressable
              key={gallery.id}
              style={styles.galleryCard}
              onPress={() => router.push(`/(admin)/clients/gallery?clientId=${gallery.client_id}`)}
            >
              <Image
                source={{ uri: gallery.cover_url || 'https://via.placeholder.com/100' }}
                style={styles.galleryCover}
                contentFit="cover"
              />
              <View style={styles.galleryInfo}>
                <View style={styles.galleryHeader}>
                  <Text style={styles.galleryTitle} numberOfLines={1}>{gallery.title}</Text>
                  {gallery.is_locked ? (
                    <Lock size={14} color="#F59E0B" />
                  ) : (
                    <Unlock size={14} color="rgba(255,255,255,0.3)" />
                  )}
                </View>
                <Text style={styles.galleryClient}>{gallery.client_name}</Text>
                <View style={styles.galleryMeta}>
                  <Text style={styles.galleryMetaText}>{gallery.photo_count} photos</Text>
                  <Text style={styles.galleryMetaDot}>·</Text>
                  <Text style={styles.galleryMetaText}>
                    {new Date(gallery.created_at).toLocaleDateString()}
                  </Text>
                </View>
              </View>
              <View style={styles.galleryActions}>
                <Pressable
                  style={styles.galleryAction}
                  onPress={() => handleDelete(gallery.id)}
                >
                  <Trash2 size={16} color="#EF4444" />
                </Pressable>
              </View>
            </Pressable>
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
  filters: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  filterChipActive: {
    backgroundColor: Colors.gold,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  filterTextActive: {
    color: '#080810',
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
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 4,
  },
  galleryCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  galleryCover: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  galleryInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  galleryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  galleryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    marginRight: 8,
  },
  galleryClient: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 4,
  },
  galleryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  galleryMetaText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  galleryMetaDot: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    marginHorizontal: 6,
  },
  galleryActions: {
    justifyContent: 'center',
  },
  galleryAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
