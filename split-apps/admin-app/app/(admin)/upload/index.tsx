import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  Alert,
  Share,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import {
  Search,
  Plus,
  Image as ImageIcon,
  Lock,
  Camera,
  Eye,
  Archive,
  Sparkles,
  Grid3X3,
  List,
  ArrowUpDown,
  Share2,
  Trash2,
  Edit3,
  Check,
  X,
  DollarSign,
  Clock,
  MoreVertical,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;
const LIST_CARD_HEIGHT = 100;

type Gallery = {
  id: string;
  title: string;
  cover_url: string | null;
  photo_count: number;
  client_name: string;
  client_email: string;
  client_avatar: string;
  client_id: string;
  is_locked: boolean;
  access_code: string;
  shoot_type: string;
  price: number;
  status: 'active' | 'scheduled' | 'archived' | 'locked';
  created_at: string;
  views: number;
  last_activity: string | null;
};

type FilterType = 'all' | 'active' | 'locked' | 'archived';
type SortType = 'newest' | 'oldest' | 'name' | 'revenue' | 'views';
type ViewMode = 'grid' | 'list';

const SORT_OPTIONS: { key: SortType; label: string }[] = [
  { key: 'newest', label: 'Newest First' },
  { key: 'oldest', label: 'Oldest First' },
  { key: 'name', label: 'Name A-Z' },
  { key: 'revenue', label: 'Highest Revenue' },
  { key: 'views', label: 'Most Views' },
];

export default function GalleriesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showSortModal, setShowSortModal] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [activeGallery, setActiveGallery] = useState<Gallery | null>(null);

  const loadGalleries = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('galleries')
        .select(`
          id,
          name,
          cover_photo_url,
          is_locked,
          access_code,
          is_paid,
          created_at,
          client_id,
          shoot_type,
          price,
          clients (
            id,
            name,
            email,
            user_profiles (
              id,
              name,
              email,
              avatar_url
            )
          )
        `)
        .eq('owner_admin_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const galleryIds = (data || []).map((g: any) => g.id);
      let photoCountMap = new Map<string, number>();
      let thumbnailMap = new Map<string, string>();
      let viewsMap = new Map<string, number>();
      let lastActivityMap = new Map<string, string>();

      if (galleryIds.length > 0) {
        const results = await Promise.allSettled([
          supabase
            .from('gallery_photos')
            .select('gallery_id, photo_url')
            .in('gallery_id', galleryIds)
            .order('created_at', { ascending: false }),
          supabase
            .from('gallery_views')
            .select('gallery_id')
            .in('gallery_id', galleryIds),
        ]);

        if (results[0].status === 'fulfilled' && results[0].value.data) {
          (results[0].value.data as any[]).forEach((p: any) => {
            photoCountMap.set(p.gallery_id, (photoCountMap.get(p.gallery_id) || 0) + 1);
            if (!thumbnailMap.has(p.gallery_id) && p.photo_url) {
              thumbnailMap.set(p.gallery_id, p.photo_url);
            }
            if (!lastActivityMap.has(p.gallery_id) || p.created_at > (lastActivityMap.get(p.gallery_id) || '')) {
              lastActivityMap.set(p.gallery_id, p.created_at);
            }
          });
        }

        if (results[1].status === 'fulfilled' && results[1].value.data) {
          (results[1].value.data as any[]).forEach((v: any) => {
            viewsMap.set(v.gallery_id, (viewsMap.get(v.gallery_id) || 0) + 1);
          });
        }
      }

      const coverPaths = (data || [])
        .map((g: any) => {
          const cover = thumbnailMap.get(g.id) || g.cover_photo_url || '';
          if (!cover || cover.startsWith('http')) return null;
          return cover;
        })
        .filter(Boolean);

      const signedCoverMap = new Map<string, string>();
      if (coverPaths.length > 0) {
        const { data: signedUrls } = await supabase.storage
          .from('client-photos')
          .createSignedUrls(coverPaths, 3600);
        if (signedUrls) {
          signedUrls.forEach((s: any) => {
            if (s.path && s.signedUrl) signedCoverMap.set(s.path, s.signedUrl);
          });
        }
      }

      const formatted = (data || []).map((g: any) => {
        const rawCover = thumbnailMap.get(g.id) || g.cover_photo_url || '';
        let signedCover = rawCover;
        if (rawCover && !rawCover.startsWith('http')) {
          signedCover = signedCoverMap.get(rawCover) || '';
          if (!signedCover) {
            const { data: pubData } = supabase.storage.from('client-photos').getPublicUrl(rawCover);
            signedCover = pubData?.publicUrl || rawCover;
          }
        }

        return {
          id: g.id,
          title: g.name || 'Untitled',
          cover_url: signedCover,
          photo_count: photoCountMap.get(g.id) || 0,
          client_name: g.clients?.name || g.clients?.user_profiles?.name || 'Unknown',
          client_email: g.clients?.email || g.clients?.user_profiles?.email || '',
          client_avatar: g.clients?.user_profiles?.avatar_url || '',
          client_id: g.client_id,
          is_locked: g.is_locked,
          access_code: g.access_code,
          shoot_type: g.shoot_type || '',
          price: g.price || 0,
          status: (g.is_paid ? 'active' : (g.is_locked ? 'locked' : 'active')) as Gallery['status'],
          created_at: g.created_at,
          views: viewsMap.get(g.id) || 0,
          last_activity: lastActivityMap.get(g.id) || g.created_at,
        };
      });

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

  const filteredGalleries = galleries
    .filter((g) => {
      const matchesSearch = g.title.toLowerCase().includes(search.toLowerCase()) ||
        g.client_name.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filter === 'all' ||
        (filter === 'active' && g.status === 'active') ||
        (filter === 'locked' && g.is_locked) ||
        (filter === 'archived' && g.status === 'archived');
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'name': return a.title.localeCompare(b.title);
        case 'revenue': return b.price - a.price;
        case 'views': return b.views - a.views;
        default: return 0;
      }
    });

  const activeCount = galleries.filter((g) => g.status === 'active').length;
  const lockedCount = galleries.filter((g) => g.is_locked).length;
  const archivedCount = galleries.filter((g) => g.status === 'archived').length;
  const totalPhotos = galleries.reduce((sum, g) => sum + g.photo_count, 0);
  const totalRevenue = galleries.reduce((sum, g) => sum + g.price, 0);
  const totalViews = galleries.reduce((sum, g) => sum + g.views, 0);

  const filters: { key: FilterType; label: string; count: number; color: string }[] = [
    { key: 'all', label: 'All', count: galleries.length, color: Colors.gold },
    { key: 'active', label: 'Active', count: activeCount, color: '#34C759' },
    { key: 'locked', label: 'Locked', count: lockedCount, color: '#F59E0B' },
    { key: 'archived', label: 'Archived', count: archivedCount, color: '#8E8E93' },
  ];

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) setSelectionMode(false);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filteredGalleries.length) {
      setSelectedIds(new Set());
      setSelectionMode(false);
    } else {
      setSelectedIds(new Set(filteredGalleries.map(g => g.id)));
    }
  };

  const handleBulkDelete = () => {
    Alert.alert(
      'Delete Galleries',
      `Delete ${selectedIds.size} gallery(ies) and all their photos?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              for (const id of selectedIds) {
                await supabase.from('galleries').delete().eq('id', id);
              }
              setSelectedIds(new Set());
              setSelectionMode(false);
              loadGalleries();
            } catch (e) {
              Alert.alert('Error', 'Failed to delete galleries');
            }
          },
        },
      ]
    );
  };

  const handleBulkLock = async () => {
    try {
      for (const id of selectedIds) {
        await supabase.from('galleries').update({ is_locked: true }).eq('id', id);
      }
      setSelectedIds(new Set());
      setSelectionMode(false);
      loadGalleries();
    } catch (e) {
      Alert.alert('Error', 'Failed to lock galleries');
    }
  };

  const handleBulkArchive = async () => {
    try {
      for (const id of selectedIds) {
        await supabase.from('galleries').update({ is_paid: false }).eq('id', id);
      }
      setSelectedIds(new Set());
      setSelectionMode(false);
      loadGalleries();
    } catch (e) {
      Alert.alert('Error', 'Failed to archive galleries');
    }
  };

  const handleShare = async (gallery: Gallery) => {
    try {
      await Share.share({
        message: `Check out the gallery "${gallery.title}" with ${gallery.photo_count} photos from Epix Visuals`,
        title: gallery.title,
      });
    } catch (e) {}
  };

  const handleDelete = (gallery: Gallery) => {
    Alert.alert(
      'Delete Gallery',
      `Delete "${gallery.title}" and all its photos?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.from('galleries').delete().eq('id', gallery.id);
              loadGalleries();
            } catch (e) {
              Alert.alert('Error', 'Failed to delete gallery');
            }
          },
        },
      ]
    );
  };

  const handleLock = async (gallery: Gallery) => {
    try {
      await supabase.from('galleries').update({ is_locked: !gallery.is_locked }).eq('id', gallery.id);
      loadGalleries();
    } catch (e) {
      Alert.alert('Error', 'Failed to update gallery');
    }
  };

  const openActions = (gallery: Gallery) => {
    setActiveGallery(gallery);
    setShowActionsModal(true);
  };

  const formatTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
      >
        {/* Hero Header */}
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroTitle}>Galleries</Text>
              <Text style={styles.heroSubtitle}>Manage your photo collections</Text>
            </View>
            <View style={styles.heroActions}>
              <Pressable
                style={styles.heroIconBtn}
                onPress={() => setSelectionMode(!selectionMode)}
              >
                {selectionMode ? (
                  <X size={20} color={Colors.gold} strokeWidth={2} />
                ) : (
                  <Check size={20} color={Colors.gold} strokeWidth={2} />
                )}
              </Pressable>
              <Pressable
                style={styles.heroAddBtn}
                onPress={() => router.push('/(admin)/upload/new')}
              >
                <Plus size={22} color="#080810" strokeWidth={2.5} />
              </Pressable>
            </View>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Camera size={16} color={Colors.gold} />
              <Text style={styles.statValue}>{totalPhotos}</Text>
              <Text style={styles.statLabel}>Photos</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <ImageIcon size={16} color="#34C759" />
              <Text style={styles.statValue}>{galleries.length}</Text>
              <Text style={styles.statLabel}>Galleries</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <DollarSign size={16} color="#F59E0B" />
              <Text style={styles.statValue}>{totalRevenue.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Revenue</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Eye size={16} color="#A78BFA" />
              <Text style={styles.statValue}>{totalViews}</Text>
              <Text style={styles.statLabel}>Views</Text>
            </View>
          </View>
        </View>

        {/* Bulk Action Bar */}
        {selectionMode && (
          <View style={styles.bulkBar}>
            <Pressable style={styles.bulkSelectAll} onPress={selectAll}>
              <Check size={16} color={Colors.gold} />
              <Text style={styles.bulkSelectAllText}>
                {selectedIds.size === filteredGalleries.length ? 'Deselect All' : 'Select All'}
              </Text>
            </Pressable>
            <Text style={styles.bulkCount}>{selectedIds.size} selected</Text>
            <View style={styles.bulkActions}>
              <Pressable style={styles.bulkActionBtn} onPress={handleBulkLock}>
                <Lock size={16} color="#F59E0B" />
              </Pressable>
              <Pressable style={styles.bulkActionBtn} onPress={handleBulkArchive}>
                <Archive size={16} color="#8E8E93" />
              </Pressable>
              <Pressable style={[styles.bulkActionBtn, styles.bulkDeleteBtn]} onPress={handleBulkDelete}>
                <Trash2 size={16} color="#E74C3C" />
              </Pressable>
            </View>
          </View>
        )}

        {/* Search + Sort + View Toggle */}
        <View style={styles.searchSection}>
          <View style={styles.searchRow}>
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
            <Pressable style={styles.sortBtn} onPress={() => setShowSortModal(true)}>
              <ArrowUpDown size={16} color={Colors.gold} />
            </Pressable>
            <Pressable
              style={styles.viewToggle}
              onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            >
              {viewMode === 'grid' ? (
                <List size={16} color={Colors.gold} />
              ) : (
                <Grid3X3 size={16} color={Colors.gold} />
              )}
            </Pressable>
          </View>
          <View style={styles.activeSortRow}>
            <Text style={styles.activeSortLabel}>
              {SORT_OPTIONS.find(s => s.key === sortBy)?.label}
            </Text>
          </View>
        </View>

        {/* Filter Chips */}
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
              <View style={[styles.filterDot, { backgroundColor: f.color }]} />
              <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
                {f.label}
              </Text>
              <Text style={[styles.filterCount, filter === f.key && styles.filterCountActive]}>
                {f.count}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Gallery List/Grid */}
        {filteredGalleries.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <Sparkles size={32} color={Colors.gold} />
            </View>
            <Text style={styles.emptyTitle}>No galleries yet</Text>
            <Text style={styles.emptySubtitle}>
              {search ? 'Try a different search' : 'Create your first gallery to get started'}
            </Text>
            {!search && (
              <Pressable
                style={styles.emptyBtn}
                onPress={() => router.push('/(admin)/upload/new')}
              >
                <Plus size={16} color="#080810" />
                <Text style={styles.emptyBtnText}>Create Gallery</Text>
              </Pressable>
            )}
          </View>
        ) : viewMode === 'grid' ? (
          <View style={styles.grid}>
            {filteredGalleries.map((gallery) => (
              <GalleryGridCard
                key={gallery.id}
                gallery={gallery}
                selectionMode={selectionMode}
                isSelected={selectedIds.has(gallery.id)}
                onToggleSelection={() => toggleSelection(gallery.id)}
                onPress={() => {
                  if (selectionMode) {
                    toggleSelection(gallery.id);
                  } else {
                    router.push(`/(admin)/clients/${gallery.client_id}`);
                  }
                }}
                onLongPress={() => {
                  if (!selectionMode) {
                    setSelectionMode(true);
                    setSelectedIds(new Set([gallery.id]));
                  }
                }}
                onShare={() => handleShare(gallery)}
                onActions={() => openActions(gallery)}
                formatTimeAgo={formatTimeAgo}
              />
            ))}
          </View>
        ) : (
          <View style={styles.listContainer}>
            {filteredGalleries.map((gallery) => (
              <GalleryListCard
                key={gallery.id}
                gallery={gallery}
                selectionMode={selectionMode}
                isSelected={selectedIds.has(gallery.id)}
                onToggleSelection={() => toggleSelection(gallery.id)}
                onPress={() => {
                  if (selectionMode) {
                    toggleSelection(gallery.id);
                  } else {
                    router.push(`/(admin)/clients/${gallery.client_id}`);
                  }
                }}
                onLongPress={() => {
                  if (!selectionMode) {
                    setSelectionMode(true);
                    setSelectedIds(new Set([gallery.id]));
                  }
                }}
                onShare={() => handleShare(gallery)}
                onActions={() => openActions(gallery)}
                formatTimeAgo={formatTimeAgo}
              />
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Sort Modal */}
      <Modal visible={showSortModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowSortModal(false)}>
          <View style={styles.sortModal}>
            <Text style={styles.sortModalTitle}>Sort By</Text>
            {SORT_OPTIONS.map(opt => (
              <Pressable
                key={opt.key}
                style={[styles.sortOption, sortBy === opt.key && styles.sortOptionActive]}
                onPress={() => { setSortBy(opt.key); setShowSortModal(false); }}
              >
                <Text style={[styles.sortOptionText, sortBy === opt.key && styles.sortOptionTextActive]}>
                  {opt.label}
                </Text>
                {sortBy === opt.key && <Check size={16} color={Colors.gold} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Actions Modal */}
      <Modal visible={showActionsModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowActionsModal(false)}>
          <View style={styles.actionsModal}>
            <Text style={styles.actionsModalTitle}>{activeGallery?.title}</Text>
            <Pressable
              style={styles.actionItem}
              onPress={() => {
                setShowActionsModal(false);
                if (activeGallery) router.push(`/(admin)/clients/${activeGallery.client_id}`);
              }}
            >
              <Edit3 size={20} color={Colors.gold} />
              <Text style={styles.actionItemText}>View & Edit</Text>
            </Pressable>
            <Pressable
              style={styles.actionItem}
              onPress={() => {
                setShowActionsModal(false);
                if (activeGallery) handleShare(activeGallery);
              }}
            >
              <Share2 size={20} color="#34C759" />
              <Text style={styles.actionItemText}>Share Gallery</Text>
            </Pressable>
            <Pressable
              style={styles.actionItem}
              onPress={() => {
                setShowActionsModal(false);
                if (activeGallery) handleLock(activeGallery);
              }}
            >
              <Lock size={20} color="#F59E0B" />
              <Text style={styles.actionItemText}>{activeGallery?.is_locked ? 'Unlock Gallery' : 'Lock Gallery'}</Text>
            </Pressable>
            <Pressable
              style={[styles.actionItem, styles.actionItemDanger]}
              onPress={() => {
                setShowActionsModal(false);
                if (activeGallery) handleDelete(activeGallery);
              }}
            >
              <Trash2 size={20} color="#E74C3C" />
              <Text style={[styles.actionItemText, styles.actionItemDangerText]}>Delete Gallery</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function GalleryGridCard({
  gallery,
  selectionMode,
  isSelected,
  onToggleSelection,
  onPress,
  onLongPress,
  onShare,
  onActions,
  formatTimeAgo,
}: {
  gallery: Gallery;
  selectionMode: boolean;
  isSelected: boolean;
  onToggleSelection: () => void;
  onPress: () => void;
  onLongPress: () => void;
  onShare: () => void;
  onActions: () => void;
  formatTimeAgo: (d: string | null) => string;
}) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePressIn = () => {
    longPressTimer.current = setTimeout(() => {
      onLongPress();
    }, 500);
  };

  const handlePressOut = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
        isSelected && styles.cardSelected,
      ]}
      onPress={() => {
        handlePressOut();
        onPress();
      }}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <View style={styles.cardCoverWrap}>
        <Image
          source={{ uri: gallery.cover_url || undefined }}
          style={styles.cardCover}
          contentFit="cover"
          transition={300}
          cachePolicy="memory-disk"
        />
        <View style={styles.cardOverlay} />

        {selectionMode ? (
          <View style={[styles.selectBadge, isSelected && styles.selectBadgeActive]}>
            {isSelected && <Check size={14} color="#080810" strokeWidth={3} />}
          </View>
        ) : (
          <>
            <View style={[styles.statusBadge, gallery.is_locked && styles.statusBadgeLocked]}>
              {gallery.is_locked ? (
                <Lock size={10} color="#080810" />
              ) : (
                <Eye size={10} color="#080810" />
              )}
              <Text style={styles.statusText}>
                {gallery.is_locked ? 'Locked' : 'Live'}
              </Text>
            </View>
            <View style={styles.photoCountBadge}>
              <Text style={styles.photoCountText}>{gallery.photo_count}</Text>
            </View>
            <View style={styles.cardQuickActions}>
              <Pressable style={styles.quickActionBtn} onPress={onShare}>
                <Share2 size={14} color="white" />
              </Pressable>
              <Pressable style={styles.quickActionBtn} onPress={onActions}>
                <MoreVertical size={14} color="white" />
              </Pressable>
            </View>
          </>
        )}
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>{gallery.title}</Text>
        {gallery.shoot_type ? (
          <Text style={styles.cardShootType} numberOfLines={1}>{gallery.shoot_type}</Text>
        ) : null}
        <View style={styles.cardClientRow}>
          {gallery.client_avatar ? (
            <Image source={{ uri: gallery.client_avatar }} style={styles.cardClientAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.cardClientAvatar, styles.cardClientAvatarFallback]}>
              <Text style={styles.cardClientAvatarText}>{gallery.client_name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.cardClient} numberOfLines={1}>{gallery.client_name}</Text>
        </View>
        <View style={styles.cardStatsRow}>
          <View style={styles.cardStat}>
            <Eye size={10} color="rgba(255,255,255,0.4)" />
            <Text style={styles.cardStatText}>{gallery.views}</Text>
          </View>
          {gallery.price > 0 && (
            <View style={styles.cardStat}>
              <DollarSign size={10} color="rgba(255,255,255,0.4)" />
              <Text style={styles.cardStatText}>{gallery.price.toLocaleString()}</Text>
            </View>
          )}
          <View style={styles.cardStat}>
            <Clock size={10} color="rgba(255,255,255,0.4)" />
            <Text style={styles.cardStatText}>{formatTimeAgo(gallery.last_activity)}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function GalleryListCard({
  gallery,
  selectionMode,
  isSelected,
  onToggleSelection,
  onPress,
  onLongPress,
  onShare,
  onActions,
  formatTimeAgo,
}: {
  gallery: Gallery;
  selectionMode: boolean;
  isSelected: boolean;
  onToggleSelection: () => void;
  onPress: () => void;
  onLongPress: () => void;
  onShare: () => void;
  onActions: () => void;
  formatTimeAgo: (d: string | null) => string;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.listCard,
        pressed && styles.cardPressed,
        isSelected && styles.cardSelected,
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      {selectionMode ? (
        <View style={[styles.listSelectBadge, isSelected && styles.selectBadgeActive]}>
          {isSelected && <Check size={14} color="#080810" strokeWidth={3} />}
        </View>
      ) : null}
      <Image
        source={{ uri: gallery.cover_url || undefined }}
        style={styles.listCardCover}
        contentFit="cover"
        transition={300}
        cachePolicy="memory-disk"
      />
      <View style={styles.listCardBody}>
        <View style={styles.listCardTop}>
          <View style={styles.listCardTitleRow}>
            <Text style={styles.listCardTitle} numberOfLines={1}>{gallery.title}</Text>
            <View style={[styles.listStatusDot, { backgroundColor: gallery.is_locked ? '#F59E0B' : '#34C759' }]} />
          </View>
          <Text style={styles.listCardClient} numberOfLines={1}>{gallery.client_name}</Text>
        </View>
        <View style={styles.listCardMeta}>
          {gallery.shoot_type ? (
            <Text style={styles.listCardShootType}>{gallery.shoot_type}</Text>
          ) : null}
          <Text style={styles.listCardDate}>{gallery.photo_count} photos</Text>
          {gallery.price > 0 && (
            <Text style={styles.listCardRevenue}>KES {gallery.price.toLocaleString()}</Text>
          )}
          <View style={styles.listCardViewsRow}>
            <Eye size={10} color="rgba(255,255,255,0.35)" />
            <Text style={styles.listCardViews}>{gallery.views}</Text>
          </View>
          <Text style={styles.listCardActivity}>{formatTimeAgo(gallery.last_activity)}</Text>
        </View>
      </View>
      <View style={styles.listCardActions}>
        <Pressable style={styles.listActionBtn} onPress={onShare}>
          <Share2 size={16} color="rgba(255,255,255,0.4)" />
        </Pressable>
        <Pressable style={styles.listActionBtn} onPress={onActions}>
          <MoreVertical size={16} color="rgba(255,255,255,0.4)" />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  // Hero
  hero: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  heroTitle: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  heroSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.45)', marginTop: 4 },
  heroActions: { flexDirection: 'row', gap: 8 },
  heroIconBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  heroAddBtn: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: Colors.gold,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.gold, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },

  // Stats
  statsRow: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 2 },
  statValue: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: '500' },

  // Bulk bar
  bulkBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(212,175,55,0.1)',
    marginHorizontal: 20, marginBottom: 8, padding: 12, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.gold + '30',
  },
  bulkSelectAll: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bulkSelectAllText: { fontSize: 13, fontWeight: '600', color: Colors.gold },
  bulkCount: { flex: 1, textAlign: 'center', fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  bulkActions: { flexDirection: 'row', gap: 8 },
  bulkActionBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },
  bulkDeleteBtn: { backgroundColor: 'rgba(231,76,60,0.15)' },

  // Search
  searchSection: { paddingHorizontal: 20, marginBottom: 8 },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14,
    paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  searchInput: { flex: 1, fontSize: 15, color: '#FFFFFF', marginLeft: 10 },
  sortBtn: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  viewToggle: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  activeSortRow: { marginTop: 6 },
  activeSortLabel: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: '500' },

  // Filters
  filters: { paddingHorizontal: 20, paddingVertical: 8, gap: 8 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)', gap: 6,
  },
  filterChipActive: { backgroundColor: Colors.gold },
  filterDot: { width: 6, height: 6, borderRadius: 3 },
  filterText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  filterTextActive: { color: '#080810' },
  filterCount: {
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8,
    overflow: 'hidden',
  },
  filterCountActive: { color: '#080810', backgroundColor: 'rgba(8,8,16,0.15)' },

  // Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 12 },

  // Card
  card: {
    width: CARD_WIDTH, backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden',
  },
  cardPressed: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: Colors.gold + '40', transform: [{ scale: 0.98 }] },
  cardSelected: { borderColor: Colors.gold, borderWidth: 2 },
  cardCoverWrap: { width: '100%', height: CARD_WIDTH * 0.85, position: 'relative' },
  cardCover: { width: '100%', height: '100%', backgroundColor: 'rgba(255,255,255,0.06)' },
  cardOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent' },
  statusBadge: {
    position: 'absolute', top: 10, left: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(52,199,89,0.9)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  statusBadgeLocked: { backgroundColor: 'rgba(245,158,11,0.9)' },
  statusText: { fontSize: 10, fontWeight: '700', color: '#080810' },
  photoCountBadge: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  photoCountText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  selectBadge: {
    position: 'absolute', top: 10, left: 10,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  selectBadgeActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  cardQuickActions: {
    position: 'absolute', bottom: 10, right: 10,
    flexDirection: 'row', gap: 6,
  },
  quickActionBtn: {
    width: 30, height: 30, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
    backdropFilter: 'blur(10px)',
  },

  // Card Body
  cardBody: { padding: 12 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', marginBottom: 3 },
  cardShootType: {
    fontSize: 11, color: '#D4AF37', fontWeight: '600',
    marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  cardClientRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  cardClient: { fontSize: 12, color: 'rgba(255,255,255,0.45)', flex: 1 },
  cardClientAvatar: { width: 18, height: 18, borderRadius: 9 },
  cardClientAvatarFallback: { backgroundColor: 'rgba(212,175,55,0.2)', alignItems: 'center', justifyContent: 'center' },
  cardClientAvatarText: { fontSize: 10, fontWeight: '700', color: '#D4AF37' },
  cardStatsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 8,
  },
  cardStat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cardStatText: { fontSize: 10, color: 'rgba(255,255,255,0.35)' },

  // List Card
  listContainer: { paddingHorizontal: 20, gap: 8 },
  listCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden', height: LIST_CARD_HEIGHT,
  },
  listCardCover: { width: LIST_CARD_HEIGHT, height: LIST_CARD_HEIGHT, backgroundColor: 'rgba(255,255,255,0.06)' },
  listCardBody: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center' },
  listCardTop: { marginBottom: 4 },
  listCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  listCardTitle: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', flex: 1 },
  listStatusDot: { width: 7, height: 7, borderRadius: 3.5 },
  listCardClient: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  listCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  listCardShootType: { fontSize: 10, color: '#D4AF37', fontWeight: '600', textTransform: 'uppercase' },
  listCardDate: { fontSize: 11, color: 'rgba(255,255,255,0.35)' },
  listCardRevenue: { fontSize: 11, color: '#34C759', fontWeight: '600' },
  listCardViewsRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  listCardViews: { fontSize: 11, color: 'rgba(255,255,255,0.35)' },
  listCardActivity: { fontSize: 11, color: 'rgba(255,255,255,0.35)' },
  listCardActions: { paddingRight: 12, gap: 8 },
  listActionBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },
  listSelectBadge: {
    width: 28, height: 28, borderRadius: 14, marginLeft: 12,
    backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },

  // Empty
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: 'rgba(212,175,55,0.1)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: 'rgba(255,255,255,0.7)', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.gold, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12,
  },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: '#080810' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  sortModal: {
    width: width - 60, backgroundColor: '#1A1A1A', borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  sortModalTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 16 },
  sortOption: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  sortOptionActive: {},
  sortOptionText: { fontSize: 15, color: 'rgba(255,255,255,0.6)' },
  sortOptionTextActive: { color: Colors.gold, fontWeight: '600' },

  actionsModal: {
    width: width - 60, backgroundColor: '#1A1A1A', borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  actionsModalTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 16 },
  actionItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  actionItemText: { fontSize: 15, color: 'rgba(255,255,255,0.7)' },
  actionItemDanger: { borderBottomWidth: 0 },
  actionItemDangerText: { color: '#E74C3C' },
});
