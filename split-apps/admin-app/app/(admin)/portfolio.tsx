import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, RefreshControl,
  ActivityIndicator, Alert, TextInput, Modal, Image, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import {
  Plus, Search, Star, Trash2, Edit3, Upload, X, Filter,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type PortfolioItem = {
  id: string;
  title: string;
  description: string | null;
  photo_url: string;
  category: string;
  is_featured: boolean;
  display_order: number;
  created_at: string;
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

  // Upload form
  const [uploadImage, setUploadImage] = useState<string | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadCategory, setUploadCategory] = useState('Wedding');
  const [uploadFeatured, setUploadFeatured] = useState(false);

  const loadPortfolio = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('portfolio_items')
        .select('*')
        .eq('admin_id', user.id)
        .order('display_order', { ascending: true });

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

  useEffect(() => { loadPortfolio(); }, [loadPortfolio]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPortfolio();
  }, [loadPortfolio]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setUploadImage(result.assets[0].uri);
    }
  };

  const handleUpload = async () => {
    if (!uploadImage || !uploadTitle.trim() || !user?.id) return;
    setUploading(true);
    try {
      const fileName = `portfolio/${user.id}/${Date.now()}.jpg`;
      const response = await fetch(uploadImage);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('portfolio')
        .upload(fileName, blob, { contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from('portfolio_items').insert({
        admin_id: user.id,
        title: uploadTitle.trim(),
        description: uploadDesc.trim() || null,
        photo_url: fileName,
        category: uploadCategory,
        is_featured: uploadFeatured,
        display_order: items.length,
      });

      if (insertError) throw insertError;

      setShowUploadModal(false);
      setUploadImage(null);
      setUploadTitle('');
      setUploadDesc('');
      setUploadCategory('Wedding');
      setUploadFeatured(false);
      loadPortfolio();
    } catch (e: any) {
      Alert.alert('Upload Failed', e.message || 'Failed to upload portfolio item');
    }
    setUploading(false);
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Portfolio</Text>
          <Text style={styles.subtitle}>{items.length} items</Text>
        </View>
        <Pressable style={styles.addButton} onPress={() => setShowUploadModal(true)}>
          <Plus size={20} color="#080810" strokeWidth={2.5} />
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Search size={16} color="rgba(255,255,255,0.4)" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search portfolio..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={search}
            onChangeText={setSearch}
          />
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
            <Text style={[styles.categoryText, activeCategory === cat && styles.categoryTextActive]}>
              {cat}
            </Text>
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
              <Text style={styles.emptyTitle}>No portfolio items</Text>
              <Text style={styles.emptySubtitle}>Upload your best work to showcase</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.portfolioCard}>
            <Image source={{ uri: item.photo_url }} style={styles.portfolioImage} contentFit="cover" />
            <View style={styles.portfolioOverlay}>
              <Pressable onPress={() => toggleFeatured(item.id, item.is_featured)}>
                <Star size={16} color={item.is_featured ? '#F59E0B' : 'rgba(255,255,255,0.5)'} fill={item.is_featured ? '#F59E0B' : 'transparent'} />
              </Pressable>
              <Pressable onPress={() => handleDelete(item.id)}>
                <Trash2 size={16} color="#EF4444" />
              </Pressable>
            </View>
            <View style={styles.portfolioInfo}>
              <Text style={styles.portfolioTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.portfolioCategory}>{item.category}</Text>
            </View>
          </View>
        )}
      />

      {/* Upload Modal */}
      <Modal visible={showUploadModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Portfolio Item</Text>
              <Pressable onPress={() => setShowUploadModal(false)}>
                <X size={24} color="rgba(255,255,255,0.5)" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Pressable style={styles.imagePicker} onPress={pickImage}>
                {uploadImage ? (
                  <Image source={{ uri: uploadImage }} style={styles.imagePreview} contentFit="cover" />
                ) : (
                  <>
                    <Upload size={32} color="rgba(255,255,255,0.3)" />
                    <Text style={styles.imagePickerText}>Tap to select photo</Text>
                  </>
                )}
              </Pressable>

              <TextInput
                style={styles.input}
                placeholder="Title"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={uploadTitle}
                onChangeText={setUploadTitle}
              />

              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Description (optional)"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={uploadDesc}
                onChangeText={setUploadDesc}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.label}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryPicker}>
                {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                  <Pressable
                    key={cat}
                    style={[styles.categoryChip, uploadCategory === cat && styles.categoryChipActive]}
                    onPress={() => setUploadCategory(cat)}
                  >
                    <Text style={[styles.categoryText, uploadCategory === cat && styles.categoryTextActive]}>
                      {cat}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Pressable
                style={styles.featuredToggle}
                onPress={() => setUploadFeatured(!uploadFeatured)}
              >
                <Star size={18} color={uploadFeatured ? '#F59E0B' : 'rgba(255,255,255,0.3)'} fill={uploadFeatured ? '#F59E0B' : 'transparent'} />
                <Text style={styles.featuredText}>{uploadFeatured ? 'Featured' : 'Mark as Featured'}</Text>
              </Pressable>

              <Pressable
                style={[styles.uploadButton, (!uploadImage || !uploadTitle.trim() || uploading) && styles.uploadButtonDisabled]}
                onPress={handleUpload}
                disabled={!uploadImage || !uploadTitle.trim() || uploading}
              >
                <Text style={styles.uploadButtonText}>{uploading ? 'Uploading...' : 'Upload'}</Text>
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
  title: { fontSize: 28, fontWeight: '900', color: '#FFFFFF' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  addButton: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.gold,
    justifyContent: 'center', alignItems: 'center',
  },
  searchContainer: { paddingHorizontal: 20, paddingVertical: 12 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12, paddingHorizontal: 12, height: 44,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#FFFFFF', marginLeft: 8 },
  categories: { paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
  categoryChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  categoryChipActive: { backgroundColor: Colors.gold },
  categoryText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  categoryTextActive: { color: '#080810' },
  gridContent: { paddingHorizontal: 20, paddingBottom: 40 },
  gridRow: { gap: 12, marginBottom: 12 },
  portfolioCard: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16,
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  portfolioImage: { width: '100%', height: 140, backgroundColor: 'rgba(255,255,255,0.06)' },
  portfolioOverlay: {
    position: 'absolute', top: 8, right: 8, flexDirection: 'row', gap: 8,
  },
  portfolioInfo: { padding: 12 },
  portfolioTitle: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', marginBottom: 2 },
  portfolioCategory: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },
  emptySubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.4)', marginTop: 4 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#111118', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  imagePicker: {
    height: 200, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16, overflow: 'hidden',
  },
  imagePreview: { width: '100%', height: '100%' },
  imagePickerText: { fontSize: 14, color: 'rgba(255,255,255,0.4)', marginTop: 8 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 14,
    fontSize: 15, color: '#FFFFFF', marginBottom: 12,
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  label: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginBottom: 8 },
  categoryPicker: { marginBottom: 16 },
  featuredToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, marginBottom: 16,
  },
  featuredText: { fontSize: 14, color: 'rgba(255,255,255,0.6)' },
  uploadButton: {
    backgroundColor: Colors.gold, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 20,
  },
  uploadButtonDisabled: { opacity: 0.5 },
  uploadButtonText: { fontSize: 16, fontWeight: '700', color: '#080810' },
});
