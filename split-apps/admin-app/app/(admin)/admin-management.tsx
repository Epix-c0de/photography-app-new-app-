import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, Modal, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Crown, Users, Trash2, Eye, EyeOff, Mail, Calendar, BarChart3, Shield, AlertTriangle, CheckCircle, XCircle } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';
import * as Haptics from 'expo-haptics';

type AdminProfile = {
  id: string;
  email: string;
  name: string | null;
  role: 'admin' | 'super_admin';
  created_at: string;
  client_count: number;
  gallery_count: number;
  phone: string | null;
  avatar_url: string | null;
};

export default function AdminManagement() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminProfile | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Check if current user is master admin
  const isMasterAdmin = user?.email === 'epixshots002@gmail.com';

  const fetchAdmins = useCallback(async () => {
    if (!isMasterAdmin) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('admin_management_view')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAdmins((data || []) as AdminProfile[]);
    } catch (error) {
      console.error('Error fetching admins:', error);
      Alert.alert('Error', 'Failed to load admin data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isMasterAdmin]);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  const handleDeleteAdmin = useCallback(async (admin: AdminProfile) => {
    if (!isMasterAdmin) {
      Alert.alert('Access Denied', 'Only master admin can perform this action');
      return;
    }

    if (deleteConfirmText !== admin.email) {
      Alert.alert('Verification Failed', 'Please type the admin email correctly to confirm deletion');
      return;
    }

    // Additional safety check
    const { data: canDelete, error: checkError } = await supabase
      .rpc('can_delete_admin', { admin_id_to_delete: admin.id });

    if (checkError) {
      console.error('Error checking deletion permissions:', checkError);
      Alert.alert('Error', 'Failed to verify deletion permissions');
      return;
    }

    if (!canDelete) {
      Alert.alert('Cannot Delete', 'This admin account cannot be deleted. You cannot delete the master admin account.');
      return;
    }

    setDeleting(true);
    try {
      // Use the safe deletion function
      const { error } = await supabase
        .rpc('delete_admin_safely', { admin_id_to_delete: admin.id });

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Admin Deleted',
        `${admin.email} has been removed. All their clients and galleries have been reassigned to you.`
      );

      setDeleteModalVisible(false);
      setDeleteConfirmText('');
      setSelectedAdmin(null);
      fetchAdmins();
    } catch (error) {
      console.error('Error deleting admin:', error);
      Alert.alert('Error', 'Failed to delete admin: ' + (error as any)?.message);
    } finally {
      setDeleting(false);
    }
  }, [isMasterAdmin, deleteConfirmText, fetchAdmins]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAdmins();
  }, [fetchAdmins]);

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <Shield size={16} color={Colors.gold} />;
      default:
        return <Users size={16} color={Colors.gold} />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return Colors.gold;
      default:
        return Colors.primary;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  if (!isMasterAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.accessDenied}>
          <Crown size={48} color={Colors.gold} />
          <Text style={styles.accessDeniedTitle}>Access Restricted</Text>
          <Text style={styles.accessDeniedText}>This area is reserved for the master administrator only.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['rgba(5, 5, 5, 0.98)', 'rgba(20, 20, 20, 0.95)']}
        style={StyleSheet.absoluteFill}
      />
      
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Crown size={28} color={Colors.gold} />
          <Text style={styles.headerTitle}>Admin Management</Text>
        </View>
        <Text style={styles.headerSubtitle}>Manage all system administrators</Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.gold} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.gold} />
            <Text style={styles.loadingText}>Loading administrators...</Text>
          </View>
        ) : admins.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Users size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No Administrators Found</Text>
            <Text style={styles.emptyText}>No other administrators are currently in the system.</Text>
          </View>
        ) : (
          admins.map((admin) => (
            <View key={admin.id} style={styles.adminCard}>
              <View style={styles.adminHeader}>
                <View style={styles.adminInfo}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(admin.name || admin.email).charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.adminDetails}>
                    <Text style={styles.adminName}>{admin.name || 'Unknown'}</Text>
                    <Text style={styles.adminEmail}>{admin.email}</Text>
                    <View style={styles.roleBadge}>
                      {getRoleIcon(admin.role)}
                      <Text style={[styles.roleText, { color: getRoleColor(admin.role) }]}>
                        {admin.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.adminActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                      setSelectedAdmin(admin);
                      setDetailsModalVisible(true);
                    }}
                  >
                    <Eye size={20} color={Colors.gold} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => {
                      setSelectedAdmin(admin);
                      setDeleteModalVisible(true);
                    }}
                  >
                    <Trash2 size={20} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={styles.adminStats}>
                <View style={styles.statItem}>
                  <Users size={16} color={Colors.textMuted} />
                  <Text style={styles.statText}>{admin.client_count} Clients</Text>
                </View>
                <View style={styles.statItem}>
                  <BarChart3 size={16} color={Colors.textMuted} />
                  <Text style={styles.statText}>{admin.gallery_count} Galleries</Text>
                </View>
                <View style={styles.statItem}>
                  <Calendar size={16} color={Colors.textMuted} />
                  <Text style={styles.statText}>Joined: {formatDate(admin.created_at)}</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Admin Details Modal */}
      <Modal
        visible={detailsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailsModalVisible(false)}
      >
        <BlurView intensity={80} tint="dark" style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Admin Details</Text>
              <TouchableOpacity onPress={() => setDetailsModalVisible(false)}>
                <XCircle size={24} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            
            {selectedAdmin && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Name</Text>
                  <Text style={styles.detailValue}>{selectedAdmin.name || 'Not set'}</Text>
                </View>
                
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Email</Text>
                  <Text style={styles.detailValue}>{selectedAdmin.email}</Text>
                </View>
                
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Role</Text>
                  <View style={styles.roleBadge}>
                    {getRoleIcon(selectedAdmin.role)}
                    <Text style={[styles.roleText, { color: getRoleColor(selectedAdmin.role) }]}>
                      {selectedAdmin.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Phone</Text>
                  <Text style={styles.detailValue}>{selectedAdmin.phone || 'Not set'}</Text>
                </View>
                
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Member Since</Text>
                  <Text style={styles.detailValue}>{formatDate(selectedAdmin.created_at)}</Text>
                </View>
                
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Statistics</Text>
                  <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                      <Users size={24} color={Colors.gold} />
                      <Text style={styles.statNumber}>{selectedAdmin.client_count}</Text>
                      <Text style={styles.statLabel}>Clients</Text>
                    </View>
                    <View style={styles.statCard}>
                      <BarChart3 size={24} color={Colors.gold} />
                      <Text style={styles.statNumber}>{selectedAdmin.gallery_count}</Text>
                      <Text style={styles.statLabel}>Galleries</Text>
                    </View>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </BlurView>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <BlurView intensity={80} tint="dark" style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <AlertTriangle size={24} color={Colors.error} />
              <Text style={styles.modalTitle}>Delete Administrator</Text>
              <TouchableOpacity onPress={() => setDeleteModalVisible(false)}>
                <XCircle size={24} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            
            {selectedAdmin && (
              <View style={styles.modalBody}>
                <Text style={styles.warningText}>
                  This action cannot be undone. Deleting {selectedAdmin.email} will:
                </Text>
                
                <View style={styles.warningList}>
                  <Text style={styles.warningItem}>{"\u2022"} Remove their admin access permanently</Text>
                  <Text style={styles.warningItem}>{"\u2022"} Reassign all {selectedAdmin.client_count} clients to you</Text>
                  <Text style={styles.warningItem}>{"\u2022"} Transfer all {selectedAdmin.gallery_count} galleries to you</Text>
                </View>
                
                <View style={styles.confirmSection}>
                  <Text style={styles.confirmLabel}>
                    Type "{selectedAdmin.email}" to confirm deletion:
                  </Text>
                  <TextInput
                    style={styles.confirmInput}
                    value={deleteConfirmText}
                    onChangeText={setDeleteConfirmText}
                    placeholder="Enter admin email"
                    placeholderTextColor={Colors.textMuted}
                    autoCapitalize="none"
                  />
                </View>
                
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => {
                      setDeleteModalVisible(false);
                      setDeleteConfirmText('');
                      setSelectedAdmin(null);
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      styles.deleteModalButton,
                      deleteConfirmText !== selectedAdmin.email && styles.disabledButton
                    ]}
                    onPress={() => handleDeleteAdmin(selectedAdmin)}
                    disabled={deleteConfirmText !== selectedAdmin.email || deleting}
                  >
                    {deleting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.deleteButtonText}>Delete Admin</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </BlurView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.white,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.white,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  adminCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  adminHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  adminInfo: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.background,
  },
  adminDetails: {
    flex: 1,
  },
  adminName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 2,
  },
  adminEmail: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  adminActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  adminStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.gold,
    textAlign: 'center',
  },
  accessDeniedText: {
    fontSize: 16,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'rgba(20, 20, 20, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
    flex: 1,
  },
  modalBody: {
    padding: 20,
  },
  detailSection: {
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 16,
    color: Colors.white,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.gold,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  warningText: {
    fontSize: 16,
    color: Colors.white,
    lineHeight: 24,
    marginBottom: 16,
  },
  warningList: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  warningItem: {
    fontSize: 14,
    color: Colors.error,
    marginBottom: 8,
    lineHeight: 20,
  },
  confirmSection: {
    marginBottom: 24,
  },
  confirmLabel: {
    fontSize: 14,
    color: Colors.white,
    marginBottom: 8,
  },
  confirmInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.white,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  cancelButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  deleteModalButton: {
    backgroundColor: Colors.error,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
});
