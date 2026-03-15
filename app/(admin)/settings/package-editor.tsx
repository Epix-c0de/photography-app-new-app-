import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, TextInput, Switch, ActivityIndicator } from 'react-native';
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
  Star
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { AdminService } from '@/services/admin';
import Colors from '@/constants/colors';
import type { Database } from '@/types/supabase';

type Package = Database['public']['Tables']['packages']['Row'];

interface PackageFormState {
  name: string;
  price: number;
  sms_included: number;
  storage_limit_gb: number;
  features: string[];
  is_active: boolean;
}

export default function PackageEditorScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PackageFormState | null>(null);

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
    } catch (e) {
      console.error('Error loading packages:', e);
      Alert.alert('Error', 'Failed to load packages');
    } finally {
      setLoading(false);
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
        });
        console.log('editForm set:', {
          name: data.name,
          price: data.price,
          sms_included: data.sms_included,
          storage_limit_gb: data.storage_limit_gb,
          features: featuresToArray(data.features),
          is_active: data.is_active,
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
    } catch (e) {
      console.error('Error adding package:', e);
      Alert.alert('Error', 'Failed to add package');
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
    });
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
          console.log('Add button pressed');
          Alert.alert('Debug', 'Add button pressed');
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
});
