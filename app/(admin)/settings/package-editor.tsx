import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, TextInput, Switch } from 'react-native';
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
  DollarSign,
  Star,
  GripVertical
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';

interface Package {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: string;
  photoCount: string;
  deliveryTime: string;
  depositPercent: number;
  isPopular: boolean;
  active: boolean;
}

const INITIAL_PACKAGES: Package[] = [
  {
    id: '1',
    name: 'Mini Shoot',
    description: 'Quick portrait session for individuals or couples.',
    price: 3000,
    duration: '1 Hour',
    photoCount: '15 edited photos',
    deliveryTime: '3 Days',
    depositPercent: 50,
    isPopular: false,
    active: true,
  },
  {
    id: '2',
    name: 'Portrait Gold',
    description: 'Comprehensive portrait session with multiple outfits.',
    price: 5000,
    duration: '2 Hours',
    photoCount: '30 edited photos',
    deliveryTime: '5 Days',
    depositPercent: 30,
    isPopular: true,
    active: true,
  },
  {
    id: '3',
    name: 'Event Standard',
    description: 'Coverage for small events, birthdays or parties.',
    price: 12000,
    duration: '4 Hours',
    photoCount: '100+ edited photos',
    deliveryTime: '7 Days',
    depositPercent: 20,
    isPopular: false,
    active: true,
  },
];

export default function PackageEditorScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [packages, setPackages] = useState<Package[]>(INITIAL_PACKAGES);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Package | null>(null);

  const handleEdit = (pkg: Package) => {
    setEditingId(pkg.id);
    setEditForm({ ...pkg });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSave = () => {
    if (!editForm) return;
    setPackages(prev => prev.map(p => p.id === editingId ? editForm : p));
    setEditingId(null);
    setEditForm(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Package', 'Are you sure you want to remove this package?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive',
        onPress: () => {
          setPackages(prev => prev.filter(p => p.id !== id));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
      },
    ]);
  };

  const handleAddNew = () => {
    const newId = Date.now().toString();
    const newPkg: Package = {
      id: newId,
      name: 'New Package',
      description: 'Describe the package...',
      price: 0,
      duration: '1 Hour',
      photoCount: '20 photos',
      deliveryTime: '7 Days',
      depositPercent: 20,
      isPopular: false,
      active: true,
    };
    setPackages(prev => [newPkg, ...prev]);
    handleEdit(newPkg);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Package Editor</Text>
        <Pressable style={styles.addBtn} onPress={handleAddNew}>
          <Plus size={20} color={Colors.background} />
        </Pressable>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.sectionTitle}>Manage Packages</Text>
        <Text style={styles.sectionSub}>Edit the packages visible to clients on the booking screen.</Text>

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
                  <Text style={styles.formLabel}>Description</Text>
                  <TextInput
                    style={[styles.formInput, styles.textArea]}
                    value={editForm?.description}
                    onChangeText={text => setEditForm(prev => prev ? { ...prev, description: text } : null)}
                    multiline
                    numberOfLines={3}
                    placeholder="Package details..."
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
                    <Text style={styles.formLabel}>Deposit (%)</Text>
                    <TextInput
                      style={styles.formInput}
                      value={editForm?.depositPercent.toString()}
                      onChangeText={text => setEditForm(prev => prev ? { ...prev, depositPercent: parseInt(text) || 0 } : null)}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.formGrid}>
                  <View style={[styles.formRow, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.formLabel}>Duration</Text>
                    <TextInput
                      style={styles.formInput}
                      value={editForm?.duration}
                      onChangeText={text => setEditForm(prev => prev ? { ...prev, duration: text } : null)}
                    />
                  </View>
                  <View style={[styles.formRow, { flex: 1, marginLeft: 8 }]}>
                    <Text style={styles.formLabel}>Photos</Text>
                    <TextInput
                      style={styles.formInput}
                      value={editForm?.photoCount}
                      onChangeText={text => setEditForm(prev => prev ? { ...prev, photoCount: text } : null)}
                    />
                  </View>
                </View>

                <View style={styles.formToggleRow}>
                  <View>
                    <Text style={styles.formLabel}>Recommended Package</Text>
                    <Text style={styles.formSub}>Shows a “Popular” badge</Text>
                  </View>
                  <Switch
                    value={editForm?.isPopular}
                    onValueChange={val => setEditForm(prev => prev ? { ...prev, isPopular: val } : null)}
                    trackColor={{ false: Colors.border, true: Colors.goldMuted }}
                    thumbColor={editForm?.isPopular ? Colors.gold : Colors.textMuted}
                  />
                </View>

                <View style={styles.formActions}>
                  <Pressable style={styles.cancelBtn} onPress={handleCancel}>
                    <X size={16} color={Colors.error} />
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </Pressable>
                  <Pressable style={styles.saveBtn} onPress={handleSave}>
                    <Check size={16} color={Colors.background} />
                    <Text style={styles.saveBtnText}>Save Package</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.packageDisplay}>
                <View style={styles.packageHeader}>
                  <View style={styles.packageTitleRow}>
                    <Text style={styles.packageName}>{pkg.name}</Text>
                    {pkg.isPopular && (
                      <View style={styles.popularBadge}>
                        <Star size={10} color={Colors.background} fill={Colors.background} />
                        <Text style={styles.popularText}>POPULAR</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.packagePrice}>KES {pkg.price.toLocaleString()}</Text>
                </View>
                
                <Text style={styles.packageDesc} numberOfLines={2}>{pkg.description}</Text>
                
                <View style={styles.packageMeta}>
                  <View style={styles.metaItem}>
                    <Clock size={12} color={Colors.textMuted} />
                    <Text style={styles.metaText}>{pkg.duration}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <ImageIcon size={12} color={Colors.textMuted} />
                    <Text style={styles.metaText}>{pkg.photoCount}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <DollarSign size={12} color={Colors.textMuted} />
                    <Text style={styles.metaText}>{pkg.depositPercent}% deposit</Text>
                  </View>
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
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: Colors.background,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 24,
  },
  packageCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  packageCardEditing: {
    borderColor: Colors.gold,
    backgroundColor: Colors.background,
  },
  packageDisplay: {
    padding: 16,
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  packageTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  packageName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginRight: 8,
  },
  popularBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gold,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  popularText: {
    fontSize: 8,
    fontWeight: '900',
    color: Colors.background,
    marginLeft: 2,
  },
  packagePrice: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.gold,
  },
  packageDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  packageMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 8,
  },
  metaText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginLeft: 4,
  },
  packageActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212,175,55,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gold,
    marginLeft: 6,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255,59,48,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editForm: {
    padding: 16,
  },
  formRow: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  formGrid: {
    flexDirection: 'row',
  },
  formToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.card,
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  formSub: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.error,
    marginLeft: 6,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gold,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.background,
    marginLeft: 8,
  },
});
