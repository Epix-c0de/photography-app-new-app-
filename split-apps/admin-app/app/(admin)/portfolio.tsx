import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, RefreshControl,
  ActivityIndicator, Alert, TextInput, Modal, Image, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import {
  Plus, Search, Star, Trash2, Upload, X, Crown, Sparkles, Camera, Images, ChevronDown,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { compressImage } from '@/lib/image-utils';

type PortfolioItem = {
  id: string;
  title: string;
  description: string | null;
  photo_url: string;
  images: { url: string; caption?: string | null }[] | null;
  category: string;
  is_featured: boolean;
  is_top_rated?: boolean;
  display_order: number;
  created_at: string;
  package_id: string | null;
};

type PackageRow = {
  id: string;
  name: string;
  price: number;
  category: string | null;
};

const CATEGORIES = ['All', 'Wedding', 'Portrait', 'Corporate', 'Event', 'Maternity', 'Newborn', 'Fashion', 'BTS', 'Other'];

export default function PortfolioScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [uploadImages, setUploadImages] = useState<string[]>([]);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadCategory, setUploadCategory] = useState('Wedding');
  const [uploadFeatured, setUploadFeatured] = useState(false);
  const [uploadPackageId, setUploadPackageId] = useState<string | null>(null);

  const [packages, setPackages] = useState<PackageRow[]>([]);

  const loadPortfolio = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('portfolio_items')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems((data || []) as PortfolioItem[]);
    } catch (e: any) {
      if (!e?.message?.includes('does not exist')) {
        console.warn('Portfolio load error:', e);
      }
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  const loadPackages = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('packages')
        .select('id, name, price, category')
        .eq('owner_admin_id', user.id)
        .eq('is_active', true)
        .order('price', { ascending: true });
      if (error) throw error;
      setPackages((data || []) as PackageRow[]);
    } catch {
      setPackages([]);
    }
  }, [user?.id]);

  useEffect(() => { loadPortfolio(); loadPackages(); }, [loadPortfolio, loadPackages]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPortfolio();
  }, [loadPortfolio]);

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      setUploadImages((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
    }
  };

  const removeUploadImage = (index: number) => {
    setUploadImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (uploadImages.length === 0 || !uploadTitle.trim() || !user?.id) return;
    setUploading(true);
    try {
      const uploadedUrls: { url: string; caption: string | null }[] = [];

      for (let i = 0; i < uploadImages.length; i++) {
        const compressed = await compressImage(uploadImages[i]);
        const fileName = `portfolio/${user.id}/${Date.now()}_${i}.jpg`;
        const response = await fetch(compressed.uri);
        const blob = await response.blob();
        const { error: uploadError } = await supabase.storage
          .from('portfolio')
          .upload(fileName, blob, { contentType: 'image/jpeg' });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('portfolio').getPublicUrl(fileName);
        uploadedUrls.push({ url: publicUrl, caption: null });
      }

      const coverUrl = uploadedUrls[0].url;
      const { error: insertError } = await supabase.from('portfolio_items').insert({
        admin_id: user.id,
        created_by: user.id,
        title: uploadTitle.trim(),
        description: uploadDesc.trim() || null,
        photo_url: coverUrl,
        media_url: coverUrl,
        images: uploadedUrls.length > 1 ? uploadedUrls : null,
        category: uploadCategory,
        is_featured: uploadFeatured,
        package_id: uploadPackageId || null,
      } as any);
      if (insertError) throw insertError;
      setShowUploadModal(false);
      resetUploadForm();
      loadPortfolio();
    } catch (e: any) {
      Alert.alert('Upload Failed', e.message || 'Failed to upload portfolio item');
    }
    setUploading(false);
  };

  const resetUploadForm = () => {
    setUploadImages([]);
    setUploadTitle('');
    setUploadDesc('');
    setUploadCategory('Wedding');
    setUploadFeatured(false);
    setUploadPackageId(null);
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Delete Item', 'Remove this from your portfolio?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await supabase.from('portfolio_items').delete().eq('id', id);
          setItems((prev) => prev.filter((i) => i.id !== id));
        },
      },
    ]);
  };

  const toggleFeatured = async (id: string, current: boolean) => {
    await supabase.from('portfolio_items').update({ is_featured: !current }).eq('id', id);
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, is_featured: !current } : i));
  };

  const filtered = items.filter((i) => {
    const matchesSearch = i.title.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === 'All' || i.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const getImageCount = (item: PortfolioItem) => {
    if (item.images && Array.isArray(item.images)) return item.images.length;
    return 1;
  };

  const renderCard = ({ item }: { item: PortfolioItem }) => (
    <View style={styles.portfolioCard}>
      <Image source={{ uri: item.photo_url }} style={styles.portfolioImage} contentFit="cover" transition={300} />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={styles.portfolioGradient}>
        <View style={styles.portfolioActions}>
          <Pressable
            style={[styles.actionDot, item.is_featured && styles.actionDotGold]}
            onPress={() => toggleFeatured(item.id, item.is_featured)}
          >
            <Star size={12} color={item.is_featured ? '#000' : '#fff'} fill={item.is_featured ? '#000' : 'transparent'} />
          </Pressable>
          <Pressable style={styles.actionDot} onPress={() => handleDelete(item.id)}>
            <Trash2 size={12} color="#FF6B6B" />
          </Pressable>
        </View>
      </LinearGradient>
      <View style={styles.portfolioInfo}>
        <Text style={styles.portfolioTitle} numberOfLines={1}>{item.title}</Text>
        <View style={styles.portfolioMeta}>
          <Text style={styles.portfolioCategory}>{item.category}</Text>
          {getImageCount(item) > 1 && (
            <View style={styles.imageCountBadge}>
              <Images size={8} color={Colors.gold} />
              <Text style={styles.imageCountText}>{getImageCount(item)}</Text>
            </View>
          )}
          {item.is_featured && (
            <View style={styles.featuredBadge}>
              <Crown size={8} color={Colors.gold} />
              <Text style={styles.featuredBadgeText}>Featured</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Portfolio</Text>
          <Text style={styles.subtitle}>{items.length} {items.length === 1 ? 'item' : 'items'}</Text>
        </View>
        <Pressable style={styles.fab} onPress={() => setShowUploadModal(true)}>
          <LinearGradient colors={[Colors.gold, Colors.goldDark]} style={styles.fabInner}>
            <Plus size={22} color="#000" strokeWidth={2.5} />
          </LinearGradient>
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Search size={16} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search portfolio..."
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <X size={14} color={Colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Categories */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat}
            style={[styles.categoryChip, activeCategory === cat && styles.categoryChipActive]}
            onPress={() => setActiveCategory(cat)}
          >
            <Text style={[styles.categoryText, activeCategory === cat && styles.categoryTextActive]}>{cat}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Grid */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.gridContent}
        columnWrapperStyle={styles.gridRow}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={Colors.gold} style={{ marginTop: 60 }} />
          ) : (
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <Camera size={32} color={Colors.gold} />
              </View>
              <Text style={styles.emptyTitle}>Build Your Portfolio</Text>
              <Text style={styles.emptySubtitle}>Showcase your best work to clients</Text>
            </View>
          )
        }
        renderItem={renderCard}
      />

      {/* Upload Modal */}
      <Modal visible={showUploadModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Portfolio Collection</Text>
              <Pressable onPress={() => { setShowUploadModal(false); resetUploadForm(); }} style={styles.modalClose}>
                <X size={20} color={Colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Multi-image picker */}
              <Pressable style={styles.imagePicker} onPress={pickImages}>
                {uploadImages.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imagePreviewRow}>
                    {uploadImages.map((uri, i) => (
                      <View key={i} style={styles.imagePreviewWrap}>
                        <Image source={{ uri }} style={styles.imagePreviewThumb} contentFit="cover" />
                        {i === 0 && (
                          <View style={styles.coverBadge}>
                            <Text style={styles.coverBadgeText}>Cover</Text>
                          </View>
                        )}
                        <Pressable style={styles.imageRemoveBtn} onPress={() => removeUploadImage(i)}>
                          <X size={12} color="#fff" />
                        </Pressable>
                      </View>
                    ))}
                    <Pressable style={styles.addMoreBtn} onPress={pickImages}>
                      <Plus size={20} color={Colors.gold} />
                      <Text style={styles.addMoreText}>Add More</Text>
                    </Pressable>
                  </ScrollView>
                ) : (
                  <View style={styles.imagePickerPlaceholder}>
                    <View style={styles.imagePickerIcon}>
                      <Images size={28} color={Colors.gold} />
                    </View>
                    <Text style={styles.imagePickerText}>Tap to select photos</Text>
                    <Text style={styles.imagePickerHint}>Add multiple photos for a collection</Text>
                  </View>
                )}
              </Pressable>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Title</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="Wedding at Safari Park..."
                  placeholderTextColor={Colors.textMuted}
                  value={uploadTitle}
                  onChangeText={setUploadTitle}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Description</Text>
                <TextInput
                  style={[styles.fieldInput, styles.textArea]}
                  placeholder="Describe this work..."
                  placeholderTextColor={Colors.textMuted}
                  value={uploadDesc}
                  onChangeText={setUploadDesc}
                  multiline
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                    <Pressable
                      key={cat}
                      style={[styles.chip, uploadCategory === cat && styles.chipActive]}
                      onPress={() => setUploadCategory(cat)}
                    >
                      <Text style={[styles.chipText, uploadCategory === cat && styles.chipTextActive]}>{cat}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Link to Package */}
              {packages.length > 0 && (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Link to Package (Optional)</Text>
                  <Text style={styles.fieldHint}>Clients can book this package from the portfolio</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                    {packages.filter(p => !p.category || p.category === uploadCategory).map((pkg) => (
                      <Pressable
                        key={pkg.id}
                        style={[styles.chip, uploadPackageId === pkg.id && styles.chipActive]}
                        onPress={() => setUploadPackageId(uploadPackageId === pkg.id ? null : pkg.id)}
                      >
                        <Text style={[styles.chipText, uploadPackageId === pkg.id && styles.chipTextActive]}>
                          {pkg.name} — KES {pkg.price.toLocaleString()}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              <Pressable
                style={[styles.featuredToggle, uploadFeatured && styles.featuredToggleActive]}
                onPress={() => setUploadFeatured(!uploadFeatured)}
              >
                <Crown size={16} color={uploadFeatured ? '#000' : Colors.textMuted} />
                <Text style={[styles.featuredText, uploadFeatured && styles.featuredTextActive]}>
                  {uploadFeatured ? 'Featured' : 'Mark as Featured'}
                </Text>
              </Pressable>

              <Pressable
                style={[styles.uploadBtn, (uploadImages.length === 0 || !uploadTitle.trim() || uploading) && styles.uploadBtnDisabled]}
                onPress={handleUpload}
                disabled={uploadImages.length === 0 || !uploadTitle.trim() || uploading}
              >
                {uploading ? (
                  <View style={styles.uploadLoading}>
                    <ActivityIndicator color="#000" size="small" />
                    <Text style={styles.uploadBtnText}>Uploading...</Text>
                  </View>
                ) : (
                  <Text style={styles.uploadBtnText}>
                    {uploadImages.length > 1 ? `Upload ${uploadImages.length} Photos` : 'Upload to Portfolio'}
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
  },
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  fab: { width: 48, height: 48, borderRadius: 16, overflow: 'hidden' },
  fabInner: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Search
  searchWrap: { paddingHorizontal: 20, paddingVertical: 10 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card,
    borderRadius: 14, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.textPrimary, marginLeft: 10 },

  // Categories
  categories: { paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
  categoryChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
  },
  categoryChipActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  categoryText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  categoryTextActive: { color: '#000' },

  // Grid
  gridContent: { paddingHorizontal: 20, paddingBottom: 40 },
  gridRow: { gap: 12, marginBottom: 12 },
  portfolioCard: {
    flex: 1, borderRadius: 16, overflow: 'hidden',
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
  },
  portfolioImage: { width: '100%', height: 160, backgroundColor: Colors.cardDark },
  portfolioGradient: {
    position: 'absolute', top: 0, right: 0, bottom: 0, width: 60,
    justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 8, paddingRight: 8,
  },
  portfolioActions: { flexDirection: 'row', gap: 6 },
  actionDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
    backdropFilter: 'blur(10px)',
  },
  actionDotGold: { backgroundColor: Colors.gold },
  portfolioInfo: { padding: 12 },
  portfolioTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  portfolioMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  portfolioCategory: { fontSize: 11, color: Colors.textMuted },
  imageCountBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(212,175,55,0.12)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4,
  },
  imageCountText: { fontSize: 9, color: Colors.gold, fontWeight: '700' },
  featuredBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(212,175,55,0.12)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4,
  },
  featuredBadgeText: { fontSize: 9, color: Colors.gold, fontWeight: '700' },

  // Empty
  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyIconWrap: {
    width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(212,175,55,0.1)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  emptySubtitle: { fontSize: 14, color: Colors.textMuted },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '90%', borderWidth: 1, borderColor: Colors.border, borderBottomWidth: 0,
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  modalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },

  // Image Picker
  imagePicker: { marginBottom: 16, borderRadius: 16, overflow: 'hidden' },
  imagePreviewRow: { gap: 10, paddingVertical: 4 },
  imagePreviewWrap: { position: 'relative', width: 120, height: 120 },
  imagePreviewThumb: { width: 120, height: 120, borderRadius: 12 },
  coverBadge: {
    position: 'absolute', top: 6, left: 6,
    backgroundColor: Colors.gold, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  coverBadgeText: { fontSize: 9, fontWeight: '800', color: '#000' },
  imageRemoveBtn: {
    position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center',
  },
  addMoreBtn: {
    width: 120, height: 120, borderRadius: 12,
    borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', gap: 4,
  },
  addMoreText: { fontSize: 11, fontWeight: '600', color: Colors.gold },
  imagePickerPlaceholder: {
    height: 160, backgroundColor: Colors.background, borderRadius: 16,
    borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', gap: 6,
  },
  imagePickerIcon: {
    width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(212,175,55,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  imagePickerText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  imagePickerHint: { fontSize: 11, color: Colors.textMuted },

  // Fields
  fieldGroup: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  fieldHint: { fontSize: 11, color: Colors.textMuted, marginBottom: 8 },
  fieldInput: {
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, padding: 14, fontSize: 14, color: Colors.textPrimary,
  },
  textArea: { height: 80, textAlignVertical: 'top' },

  // Chips
  chipRow: { gap: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  chipTextActive: { color: '#000' },

  // Featured Toggle
  featuredToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, marginBottom: 16,
    paddingHorizontal: 14, borderRadius: 12, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
  },
  featuredToggleActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  featuredText: { fontSize: 14, color: Colors.textMuted, fontWeight: '600' },
  featuredTextActive: { color: '#000' },

  // Upload
  uploadBtn: {
    backgroundColor: Colors.gold, borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 20,
  },
  uploadBtnDisabled: { opacity: 0.5 },
  uploadBtnText: { fontSize: 15, fontWeight: '700', color: '#000' },
  uploadLoading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
