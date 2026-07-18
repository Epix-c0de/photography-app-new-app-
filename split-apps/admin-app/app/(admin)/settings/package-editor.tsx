import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, TextInput, Switch, ActivityIndicator, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  ChevronLeft, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  X,
  Clock,
  Image as ImageIcon,
  Star,
  Upload,
  Trash,
  Link,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { AdminService } from '@/services/admin';
import { compressImage } from '@/lib/image-utils';
import Colors from '@/constants/colors';
import type { Database } from '@/types/supabase';

type Package = Database['public']['Tables']['packages']['Row'];

type LinkedPortfolio = {
  id: string;
  title: string;
  photo_url: string | null;
  category: string | null;
};

const PACKAGE_CATEGORIES = ['Wedding', 'Portrait', 'Corporate', 'Event', 'Maternity', 'Newborn', 'Fashion', 'Other'];

interface PackageFormState {
  name: string;
  price: number;
  sms_included: number;
  storage_limit_gb: number;
  features: string[];
  is_active: boolean;
  description?: string;
  detailed_description?: string;
  is_popular?: boolean;
  cover_image_url?: string | null;
  category?: string | null;
}

export default function PackageEditorScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PackageFormState | null>(null);
  const [linkedPortfolios, setLinkedPortfolios] = useState<LinkedPortfolio[]>([]);
  const [allPortfolios, setAllPortfolios] = useState<LinkedPortfolio[]>([]);

  // Helper functions to convert between Json and string[]
  const featuresToArray = (features: any): string[] => {
    if (Array.isArray(features)) {
      return features.filter((f): f is string => typeof f === 'string');
    }
    return [];
  };

  const arrayToFeatures = (features: string[]): any => {
    return features.length > 0 ? features : null;
  };

  useEffect(() => {
    loadPackages();
    loadAllPortfolios();
  }, []);

  const loadPackages = async () => {
    try {
      setLoading(true);
      
      // Get current user first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      console.log('Loading packages for admin:', user.id);
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .eq('owner_admin_id', user.id)
        .order('price', { ascending: true });
      
      console.log('Load packages result:', { data, error });
      if (error) throw error;
      setPackages(data || []);
    } catch (e: any) {
      console.error('Error loading packages:', e);
      const msg = e?.message || e?.error?.message || String(e);
      Alert.alert('Error', `Failed to load packages: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const loadAllPortfolios = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('portfolio_items')
        .select('id, title, photo_url, category')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });
      setAllPortfolios((data || []) as LinkedPortfolio[]);
    } catch {
      setAllPortfolios([]);
    }
  };

  const loadLinkedPortfolios = async (pkgId: string) => {
    try {
      const { data } = await supabase
        .from('portfolio_items')
        .select('id, title, photo_url, category')
        .eq('package_id', pkgId)
        .order('created_at', { ascending: false });
      setLinkedPortfolios((data || []) as LinkedPortfolio[]);
    } catch {
      setLinkedPortfolios([]);
    }
  };

  const handleLinkPortfolio = async (pkgId: string, portfolioId: string) => {
    try {
      const { error } = await supabase
        .from('portfolio_items')
        .update({ package_id: pkgId } as any)
        .eq('id', portfolioId);
      if (error) throw error;
      loadLinkedPortfolios(pkgId);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to link portfolio');
    }
  };

  const handleUnlinkPortfolio = async (portfolioId: string, pkgId: string) => {
    try {
      const { error } = await supabase
        .from('portfolio_items')
        .update({ package_id: null } as any)
        .eq('id', portfolioId);
      if (error) throw error;
      loadLinkedPortfolios(pkgId);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to unlink portfolio');
    }
  };

  const handleAddNew = async () => {
    console.log('handleAddNew called');
    try {
      // Get current user
      console.log('Getting current user...');
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log('User result:', { user, userError });
      if (userError) throw userError;
      if (!user) throw new Error('Not authenticated');

      const newPkg = {
        owner_admin_id: user.id,
        name: 'New Package',
        price: 5000,
        sms_included: 50,
        storage_limit_gb: 5,
        features: ['20 edited photos', 'Online gallery'],
        is_active: true,
        category: null,
      };
      console.log('Inserting package:', newPkg);

      const { data, error } = await supabase
        .from('packages')
        .insert(newPkg)
        .select()
        .single();
      
      console.log('Insert result:', { data, error });
      if (error) throw error;
      
      if (data) {
        console.log('Adding to packages state');
        const newPackages = [data, ...packages];
        console.log('New packages array:', newPackages);
        setPackages(newPackages);
        setEditingId(data.id);
        console.log('Setting editForm for package:', data.id);
        setEditForm({
          name: data.name,
          price: data.price,
          sms_included: data.sms_included,
          storage_limit_gb: data.storage_limit_gb,
          features: featuresToArray(data.features),
          is_active: data.is_active,
          category: (data as any).category || null,
        });
        console.log('editForm set:', {
          name: data.name,
          price: data.price,
          sms_included: data.sms_included,
          storage_limit_gb: data.storage_limit_gb,
          features: featuresToArray(data.features),
          is_active: data.is_active,
          category: (data as any).category || null,
        });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // Notify clients about new package
        AdminService.notifications.notifyAll({
          type: 'package_update',
          title: 'New Service Package Available! 🎁',
          body: `Check out our new "${data.name}" package now available for booking.`,
          data: { packageId: data.id }
        }).catch(err => console.error('Failed to send package notification:', err));
      }
    } catch (e: any) {
      console.error('Error adding package:', e);
      const msg = e?.message || e?.error?.message || String(e);
      Alert.alert('Error', `Failed to add package: ${msg}`);
    }
  };

  const handleSave = async () => {
    if (!editForm || !editingId) return;
    try {
      setSaving(true);
      const { error } = await supabase
        .from('packages')
        .update({
          name: editForm.name,
          price: editForm.price,
          sms_included: editForm.sms_included,
          storage_limit_gb: editForm.storage_limit_gb,
          features: arrayToFeatures(editForm.features),
          is_active: editForm.is_active,
          description: editForm.description,
          detailed_description: editForm.detailed_description,
          is_popular: editForm.is_popular,
          cover_image_url: editForm.cover_image_url,
          category: editForm.category,
        })
        .eq('id', editingId);
      
      if (error) throw error;
      
      // Update the local state with the changes
      setPackages(prev => prev.map(p => 
        p.id === editingId ? { 
          ...p, 
          name: editForm.name,
          price: editForm.price,
          sms_included: editForm.sms_included,
          storage_limit_gb: editForm.storage_limit_gb,
          features: arrayToFeatures(editForm.features),
          is_active: editForm.is_active,
          description: editForm.description,
          detailed_description: editForm.detailed_description,
          is_popular: editForm.is_popular,
          cover_image_url: editForm.cover_image_url ?? null,
          category: editForm.category ?? null,
        } : p
      ));
      
      setEditingId(null);
      setEditForm(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Notify clients about package update
      AdminService.notifications.notifyAll({
        type: 'package_update',
        title: 'Package Updated! ✨',
        body: `We've updated our "${editForm.name}" package. Check the latest features and pricing.`,
        data: { packageId: editingId }
      }).catch(err => console.error('Failed to send package update notification:', err));
    } catch (e) {
      console.error('Error saving package:', e);
      Alert.alert('Error', 'Failed to save package');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Delete Package', 'Are you sure you want to remove this package?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('packages').delete().eq('id', id);
            if (error) throw error;
            setPackages(prev => prev.filter(p => p.id !== id));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          } catch (e) {
            console.error('Error deleting package:', e);
            Alert.alert('Error', 'Failed to delete package');
          }
        }
      },
    ]);
  };

  const handleEdit = (pkg: Package) => {
    setEditingId(pkg.id);
    setEditForm({
      name: pkg.name,
      price: pkg.price,
      sms_included: pkg.sms_included,
      storage_limit_gb: pkg.storage_limit_gb,
      features: featuresToArray(pkg.features),
      is_active: pkg.is_active,
      description: (pkg as any).description || '',
      detailed_description: (pkg as any).detailed_description || '',
      is_popular: (pkg as any).is_popular || false,
      cover_image_url: (pkg as any).cover_image_url,
      category: (pkg as any).category || null,
    });
    loadLinkedPortfolios(pkg.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const featuresString = editForm?.features?.join('\n') || '';
  
  const handleFeaturesChange = (text: string) => {
    const features = text.split('\n').filter(f => f.trim());
    setEditForm(prev => prev ? { ...prev, features } : null);
  };

  const handleImageUpload = async () => {
    if (!editingId) return;
    
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      
      // Compress the image before upload
      const compressed = await compressImage(file.uri);
      
      const ext = 'jpg';
      const fileName = `package-${editingId}-${Date.now()}.${ext}`;
      const filePath = `package-covers/${editingId}/${fileName}`;

      const buf = await fetch(compressed.uri).then(r => r.arrayBuffer());
      const blob = new Blob([buf], { type: 'image/jpeg' });

      let uploadBucket = 'package-images';
      let { error: uploadError } = await supabase.storage
        .from(uploadBucket)
        .upload(filePath, blob, {
          contentType: file.mimeType || 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.warn('[Package] package-images bucket failed, trying media:', uploadError.message);
        uploadBucket = 'media';
        const fallbackPath = `announcements/packages/${editingId}/${fileName}`;
        const retry = await supabase.storage
          .from(uploadBucket)
          .upload(fallbackPath, blob, {
            contentType: file.mimeType || 'image/jpeg',
            upsert: true,
          });
        if (retry.error) throw retry.error;
        const { data: { publicUrl } } = supabase.storage.from(uploadBucket).getPublicUrl(fallbackPath);
        setEditForm(prev => prev ? { ...prev, cover_image_url: publicUrl } : null);
      } else {
        const { data: { publicUrl } } = supabase.storage.from(uploadBucket).getPublicUrl(filePath);
        setEditForm(prev => prev ? { ...prev, cover_image_url: publicUrl } : null);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to upload image. Please try again.');
    }
  };

  const handleImageRemove = () => {
    setEditForm(prev => prev ? { ...prev, cover_image_url: null } : null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Package Editor</Text>
        <Pressable style={styles.addBtn} onPress={() => {
          handleAddNew();
        }}>
          <Plus size={20} color={Colors.background} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Manage Packages</Text>
        <Text style={styles.sectionSub}>Edit the packages visible to clients on the booking screen.</Text>

        {packages.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No packages yet. Tap + to add one.</Text>
          </View>
        )}

        {packages.map((pkg) => (
          <View key={pkg.id} style={[styles.packageCard, editingId === pkg.id && styles.packageCardEditing]}>
            {editingId === pkg.id ? (
              <View style={styles.editForm}>
                <View style={styles.formRow}>
                  <Text style={styles.formLabel}>Package Name</Text>
                  <TextInput
                    style={styles.formInput}
                    value={editForm?.name}
                    onChangeText={text => setEditForm(prev => prev ? { ...prev, name: text } : null)}
                    placeholder="Wedding Gold"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>

                <View style={styles.formRow}>
                  <Text style={styles.formLabel}>Category</Text>
                  <Text style={styles.formSub}>Link this package to a portfolio category</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                    {PACKAGE_CATEGORIES.map(cat => (
                      <Pressable
                        key={cat}
                        onPress={() => setEditForm(prev => prev ? { ...prev, category: cat } : null)}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderRadius: 20,
                          marginRight: 8,
                          backgroundColor: editForm?.category === cat ? Colors.gold : 'rgba(255,255,255,0.08)',
                          borderWidth: 1,
                          borderColor: editForm?.category === cat ? Colors.gold : 'rgba(255,255,255,0.12)',
                        }}
                      >
                        <Text style={{
                          color: editForm?.category === cat ? '#000' : Colors.textMuted,
                          fontWeight: editForm?.category === cat ? '700' : '500',
                          fontSize: 13,
                        }}>{cat}</Text>
                      </Pressable>
                    ))}
                    <Pressable
                      onPress={() => setEditForm(prev => prev ? { ...prev, category: '' } : null)}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 20,
                        marginRight: 8,
                        backgroundColor: editForm?.category !== null && !PACKAGE_CATEGORIES.includes(editForm?.category || '') ? Colors.gold : 'rgba(255,255,255,0.08)',
                        borderWidth: 1,
                        borderColor: editForm?.category !== null && !PACKAGE_CATEGORIES.includes(editForm?.category || '') ? Colors.gold : 'rgba(255,255,255,0.12)',
                      }}
                    >
                      <Text style={{
                        color: editForm?.category !== null && !PACKAGE_CATEGORIES.includes(editForm?.category || '') ? '#000' : Colors.textMuted,
                        fontWeight: '500',
                        fontSize: 13,
                      }}>Custom</Text>
                    </Pressable>
                  </ScrollView>
                  {editForm?.category !== null && !PACKAGE_CATEGORIES.includes(editForm?.category || '') && (
                    <TextInput
                      style={styles.formInput}
                      value={editForm?.category || ''}
                      onChangeText={text => setEditForm(prev => prev ? { ...prev, category: text } : null)}
                      placeholder="e.g. Landscape, Product, Food"
                      placeholderTextColor={Colors.textMuted}
                    />
                  )}
                </View>

                <View style={styles.formRow}>
                  <Text style={styles.formLabel}>SMS Included</Text>
                  <TextInput
                    style={styles.formInput}
                    value={editForm?.sms_included.toString()}
                    onChangeText={text => setEditForm(prev => prev ? { ...prev, sms_included: parseInt(text) || 0 } : null)}
                    keyboardType="numeric"
                    placeholder="50"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>

                <View style={styles.formGrid}>
                  <View style={[styles.formRow, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.formLabel}>Price (KES)</Text>
                    <TextInput
                      style={styles.formInput}
                      value={editForm?.price.toString()}
                      onChangeText={text => setEditForm(prev => prev ? { ...prev, price: parseInt(text) || 0 } : null)}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[styles.formRow, { flex: 1, marginLeft: 8 }]}>
                    <Text style={styles.formLabel}>Storage Limit (GB)</Text>
                    <TextInput
                      style={styles.formInput}
                      value={editForm?.storage_limit_gb.toString()}
                      onChangeText={text => setEditForm(prev => prev ? { ...prev, storage_limit_gb: parseFloat(text) || 0 } : null)}
                      keyboardType="numeric"
                      placeholder="5"
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>
                </View>

                <View style={styles.formRow}>
                  <Text style={styles.formLabel}>Features (one per line)</Text>
                  <TextInput
                    style={[styles.formInput, styles.textArea]}
                    value={featuresString}
                    onChangeText={handleFeaturesChange}
                    multiline
                    numberOfLines={4}
                    placeholder="20 edited photos\nOnline gallery\nPrint release"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>

                <View style={styles.formRow}>
                  <Text style={styles.formLabel}>Short Description (Client-Facing)</Text>
                  <TextInput
                    style={styles.formInput}
                    value={editForm?.description}
                    onChangeText={text => setEditForm(prev => prev ? { ...prev, description: text } : null)}
                    placeholder="Perfect for portraits and personal shoots"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>

                <View style={styles.formRow}>
                  <Text style={styles.formLabel}>Detailed Description (Full Details)</Text>
                  <TextInput
                    style={[styles.formInput, styles.textArea]}
                    value={editForm?.detailed_description}
                    onChangeText={text => setEditForm(prev => prev ? { ...prev, detailed_description: text } : null)}
                    multiline
                    numberOfLines={6}
                    placeholder="This comprehensive package includes professional lighting, multiple outfit changes, location scouting, and online gallery access with high-resolution downloads..."
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>

                <View style={styles.formRow}>
                  <Text style={styles.formLabel}>Package Cover Image</Text>
                  <Text style={styles.formSub}>This image will be shown to clients when browsing packages</Text>
                  
                  {editForm?.cover_image_url ? (
                    <View style={styles.imageContainer}>
                      <Image source={{ uri: editForm.cover_image_url }} style={styles.coverImage} resizeMode="cover" />
                      <View style={styles.imageActions}>
                        <Pressable style={styles.imageActionBtn} onPress={handleImageUpload}>
                          <Upload size={16} color={Colors.gold} />
                          <Text style={styles.imageActionText}>Change</Text>
                        </Pressable>
                        <Pressable style={[styles.imageActionBtn, styles.imageActionBtnDanger]} onPress={handleImageRemove}>
                          <Trash size={16} color={Colors.error} />
                          <Text style={[styles.imageActionText, styles.imageActionTextDanger]}>Remove</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <Pressable style={styles.uploadPlaceholder} onPress={handleImageUpload}>
                      <ImageIcon size={32} color={Colors.textMuted} />
                      <Text style={styles.uploadPlaceholderText}>Tap to upload package image</Text>
                      <Text style={styles.uploadPlaceholderSub}>Recommended: 16:9 ratio, max 2MB</Text>
                    </Pressable>
                  )}
                </View>

                {/* Linked Portfolios */}
                <View style={styles.formRow}>
                  <Text style={styles.formLabel}>Linked Portfolio Collections</Text>
                  <Text style={styles.formSub}>Portfolios tagged with this package appear as "Book" options for clients</Text>

                  {linkedPortfolios.length > 0 && (
                    <View style={{ gap: 8, marginBottom: 12 }}>
                      {linkedPortfolios.map((pf) => (
                        <View key={pf.id} style={styles.linkedPortfolioRow}>
                          <Image source={{ uri: pf.photo_url || '' }} style={styles.linkedPortfolioThumb} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.linkedPortfolioTitle} numberOfLines={1}>{pf.title}</Text>
                            {pf.category && <Text style={styles.linkedPortfolioCat}>{pf.category}</Text>}
                          </View>
                          <Pressable onPress={() => handleUnlinkPortfolio(pf.id, editingId!)}>
                            <X size={16} color={Colors.error} />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )}

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                    {allPortfolios
                      .filter(pf => !linkedPortfolios.some(lp => lp.id === pf.id))
                      .filter(pf => !editForm?.category || !pf.category || pf.category === editForm.category)
                      .map((pf) => (
                        <Pressable
                          key={pf.id}
                          onPress={() => handleLinkPortfolio(editingId!, pf.id)}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: 6,
                            paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginRight: 8,
                            backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
                          }}
                        >
                          <Image source={{ uri: pf.photo_url || '' }} style={{ width: 24, height: 24, borderRadius: 6 }} />
                          <Text style={{ color: Colors.textMuted, fontSize: 12, fontWeight: '500' }} numberOfLines={1}>{pf.title}</Text>
                          <Link size={12} color={Colors.gold} />
                        </Pressable>
                      ))}
                    {allPortfolios.filter(pf => !linkedPortfolios.some(lp => lp.id === pf.id)).length === 0 && (
                      <Text style={{ color: Colors.textMuted, fontSize: 12, paddingVertical: 8 }}>
                        No unlinked portfolios available
                      </Text>
                    )}
                  </ScrollView>
                </View>

                <View style={styles.formToggleRow}>
                  <View>
                    <Text style={styles.formLabel}>Mark as Most Popular</Text>
                    <Text style={styles.formSub}>Highlight this package on the booking screen</Text>
                  </View>
                  <Switch
                    value={editForm?.is_popular}
                    onValueChange={val => setEditForm(prev => prev ? { ...prev, is_popular: val } : null)}
                    trackColor={{ false: Colors.border, true: Colors.goldMuted }}
                    thumbColor={editForm?.is_popular ? Colors.gold : Colors.textMuted}
                  />
                </View>

                <View style={styles.formToggleRow}>
                  <View>
                    <Text style={styles.formLabel}>Package Status</Text>
                    <Text style={styles.formSub}>Enable this package for client bookings</Text>
                  </View>
                  <Switch
                    value={editForm?.is_active}
                    onValueChange={val => setEditForm(prev => prev ? { ...prev, is_active: val } : null)}
                    trackColor={{ false: Colors.border, true: Colors.goldMuted }}
                    thumbColor={editForm?.is_active ? Colors.gold : Colors.textMuted}
                  />
                </View>

                <View style={styles.formActions}>
                  <Pressable style={styles.cancelBtn} onPress={handleCancel}>
                    <X size={16} color={Colors.error} />
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </Pressable>
                  <Pressable style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
                    {saving ? (
                      <ActivityIndicator size="small" color={Colors.background} />
                    ) : (
                      <>
                        <Check size={16} color={Colors.background} />
                        <Text style={styles.saveBtnText}>Save Package</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.packageDisplay}>
                <View style={styles.packageHeader}>
                  <View style={styles.packageTitleRow}>
                    <Text style={styles.packageName}>{pkg.name}</Text>
                    {pkg.is_active && (
                      <View style={styles.popularBadge}>
                        <Star size={10} color={Colors.background} fill={Colors.background} />
                        <Text style={styles.popularText}>ACTIVE</Text>
                      </View>
                    )}
                    {(pkg as any).category && (
                      <View style={[styles.popularBadge, { backgroundColor: 'rgba(212,175,55,0.2)' }]}>
                        <Text style={[styles.popularText, { color: Colors.gold }]}>{(pkg as any).category}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.packagePrice}>KES {pkg.price.toLocaleString()}</Text>
                </View>
                
                <Text style={styles.packageDesc} numberOfLines={2}>{pkg.name} Package</Text>
                
                <View style={styles.packageMeta}>
                  <View style={styles.metaItem}>
                    <Clock size={12} color={Colors.textMuted} />
                    <Text style={styles.metaText}>KES {pkg.price.toLocaleString()}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <ImageIcon size={12} color={Colors.textMuted} />
                    <Text style={styles.metaText}>{pkg.sms_included} SMS</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Star size={12} color={Colors.textMuted} />
                    <Text style={styles.metaText}>{pkg.storage_limit_gb}GB storage</Text>
                  </View>
                  {featuresToArray(pkg.features).length > 0 && (
                    <View style={styles.metaItem}>
                      <Text style={styles.metaText}>{featuresToArray(pkg.features).length} features</Text>
                    </View>
                  )}
                </View>

                <View style={styles.packageActions}>
                  <Pressable style={styles.editBtn} onPress={() => handleEdit(pkg)}>
                    <Edit3 size={16} color={Colors.gold} />
                    <Text style={styles.editBtnText}>Edit</Text>
                  </Pressable>
                  <Pressable style={styles.deleteBtn} onPress={() => handleDelete(pkg.id)}>
                    <Trash2 size={16} color={Colors.error} />
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { justifyContent: 'center', alignItems: 'center' },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { color: Colors.textMuted, fontSize: 16 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, backgroundColor: Colors.background },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  sectionSub: { fontSize: 14, color: Colors.textMuted, marginBottom: 24 },
  packageCard: { backgroundColor: Colors.card, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  packageCardEditing: { borderColor: Colors.gold, backgroundColor: Colors.background },
  packageDisplay: { padding: 16 },
  packageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  packageTitleRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  packageName: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginRight: 8 },
  popularBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.gold, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  popularText: { fontSize: 8, fontWeight: '900', color: Colors.background, marginLeft: 2 },
  packagePrice: { fontSize: 16, fontWeight: '800', color: Colors.gold },
  packageDesc: { fontSize: 13, color: Colors.textSecondary, marginBottom: 16, lineHeight: 18 },
  packageMeta: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', marginRight: 16, marginBottom: 8 },
  metaText: { fontSize: 12, color: Colors.textMuted, marginLeft: 4 },
  packageActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12 },
  editBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(212,175,55,0.1)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, marginRight: 8 },
  editBtnText: { fontSize: 14, fontWeight: '600', color: Colors.gold, marginLeft: 6 },
  deleteBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(255,59,48,0.1)', alignItems: 'center', justifyContent: 'center' },
  editForm: { padding: 16 },
  formRow: { marginBottom: 16 },
  formLabel: { fontSize: 13, fontWeight: '600', color: Colors.textMuted, marginBottom: 6 },
  formInput: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: Colors.textPrimary, fontSize: 14 },
  textArea: { height: 80, textAlignVertical: 'top' },
  formGrid: { flexDirection: 'row' },
  formToggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.card, padding: 12, borderRadius: 12, marginBottom: 20 },
  formSub: { fontSize: 11, color: Colors.textMuted },
  formActions: { flexDirection: 'row', justifyContent: 'space-between' },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: Colors.error, marginLeft: 6 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.gold, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: Colors.background, marginLeft: 8 },
  imageContainer: { marginTop: 8, borderRadius: 12, overflow: 'hidden' },
  coverImage: { width: '100%', height: 160, borderRadius: 12 },
  imageActions: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 12 },
  imageActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.card },
  imageActionBtnDanger: { backgroundColor: 'rgba(255,59,48,0.1)' },
  imageActionText: { fontSize: 13, fontWeight: '600', color: Colors.gold },
  imageActionTextDanger: { color: Colors.error },
  uploadPlaceholder: { alignItems: 'center', justifyContent: 'center', padding: 24, borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed', borderRadius: 12, marginTop: 8 },
  uploadPlaceholderText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary, marginTop: 12 },
  uploadPlaceholderSub: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  linkedPortfolioRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.card, borderRadius: 12, padding: 10, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  linkedPortfolioThumb: { width: 40, height: 40, borderRadius: 8, backgroundColor: Colors.background },
  linkedPortfolioTitle: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  linkedPortfolioCat: { fontSize: 11, color: Colors.textMuted },
});
