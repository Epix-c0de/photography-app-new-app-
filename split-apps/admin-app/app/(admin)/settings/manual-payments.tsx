import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, CheckCircle, XCircle, RefreshCw, Smartphone, DollarSign, Clock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type ManualPayment = {
  id: string;
  gallery_id: string;
  client_id: string;
  admin_id: string;
  amount: number;
  phone_number: string;
  mpesa_number: string;
  status: 'pending' | 'verified' | 'rejected';
  created_at: string;
  updated_at: string;
  mpesa_receipt?: string;
};

export default function ManualPaymentsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [payments, setPayments] = useState<ManualPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    loadPayments();
  }, [user?.id]);

  const loadPayments = async () => {
    try {
      setLoading(true);
      if (!user?.id) return;

      const { data, error } = await supabase
        .from('manual_payments')
        .select('*')
        .eq('admin_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPayments((data || []) as ManualPayment[]);
    } catch (error) {
      console.error('Error loading manual payments:', error);
      Alert.alert('Error', 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPayments();
    setRefreshing(false);
  };

  const handleVerify = async (payment: ManualPayment) => {
    Alert.alert(
      'Verify Payment',
      `Verify payment of ${payment.amount} from ${payment.phone_number}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Verify',
          style: 'default',
          onPress: async () => {
            setProcessing(payment.id);
            try {
              const { error: updateError } = await supabase
                .from('manual_payments')
                .update({ status: 'verified', updated_at: new Date().toISOString() })
                .eq('id', payment.id);

              if (updateError) throw updateError;

              // Unlock the gallery
              const { error: unlockError } = await supabase
                .from('galleries')
                .update({ is_paid: true, is_locked: false })
                .eq('id', payment.gallery_id);

              if (unlockError) {
                console.error('Failed to unlock gallery:', unlockError);
                Alert.alert('Warning', 'Payment verified but failed to unlock gallery. Please unlock manually.');
              } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Success', 'Payment verified and gallery unlocked!');
              }
              await loadPayments();
            } catch (error) {
              console.error('Error verifying payment:', error);
              Alert.alert('Error', 'Failed to verify payment');
            } finally {
              setProcessing(null);
            }
          }
        }
      ]
    );
  };

  const handleReject = async (payment: ManualPayment) => {
    Alert.alert(
      'Reject Payment',
      `Reject payment of ${payment.amount} from ${payment.phone_number}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setProcessing(payment.id);
            try {
              const { error } = await supabase
                .from('manual_payments')
                .update({ status: 'rejected', updated_at: new Date().toISOString() })
                .eq('id', payment.id);

              if (error) throw error;

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Rejected', 'Payment has been rejected');
              await loadPayments();
            } catch (error) {
              console.error('Error rejecting payment:', error);
              Alert.alert('Error', 'Failed to reject payment');
            } finally {
              setProcessing(null);
            }
          }
        }
      ]
    );
  };

  const renderPayment = ({ item }: { item: ManualPayment }) => (
    <View style={[styles.paymentCard, item.status === 'verified' && styles.verifiedCard, item.status === 'rejected' && styles.rejectedCard]}>
      <View style={styles.paymentHeader}>
        <View style={styles.paymentInfo}>
          <View style={styles.amountRow}>
            <DollarSign size={20} color={item.status === 'verified' ? Colors.success : item.status === 'rejected' ? Colors.error : Colors.gold} />
            <Text style={[styles.amount, item.status === 'verified' && styles.verifiedText, item.status === 'rejected' && styles.rejectedText]}>
              {item.amount}
            </Text>
          </View>
          <Text style={styles.clientName}>{item.phone_number}</Text>
          <Text style={styles.galleryName}>Gallery ID: {item.gallery_id}</Text>
        </View>
        <View style={[styles.statusBadge, item.status === 'verified' && styles.verifiedBadge, item.status === 'rejected' && styles.rejectedBadge]}>
          <Text style={[styles.statusText, item.status === 'verified' && styles.verifiedBadgeText, item.status === 'rejected' && styles.rejectedBadgeText]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.paymentDetails}>
        <View style={styles.detailRow}>
          <Smartphone size={16} color={Colors.textSecondary} />
          <Text style={styles.detailText}>{item.phone_number}</Text>
        </View>
        <View style={styles.detailRow}>
          <Smartphone size={16} color={Colors.textSecondary} />
          <Text style={styles.detailText}>Sent to: {item.mpesa_number}</Text>
        </View>
        <View style={styles.detailRow}>
          <Clock size={16} color={Colors.textSecondary} />
          <Text style={styles.detailText}>
            {new Date(item.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
        </View>
      </View>

      {item.status === 'pending' && (
        <View style={styles.actions}>
          <Pressable
            style={[styles.actionButton, styles.verifyButton]}
            onPress={() => handleVerify(item)}
            disabled={processing === item.id}
          >
            {processing === item.id ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <CheckCircle size={16} color={Colors.white} />
                <Text style={styles.actionButtonText}>Verify</Text>
              </>
            )}
          </Pressable>
          <Pressable
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => handleReject(item)}
            disabled={processing === item.id}
          >
            {processing === item.id ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <XCircle size={16} color={Colors.white} />
                <Text style={styles.actionButtonText}>Reject</Text>
              </>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Manual Payments</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.gold} />
          <Text style={styles.loadingText}>Loading payments...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Manual Payments</Text>
        <Pressable onPress={onRefresh} style={styles.refreshButton}>
          <RefreshCw size={24} color={Colors.gold} />
        </Pressable>
      </View>

      <FlatList
        data={payments}
        renderItem={renderPayment}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Smartphone size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No manual payments yet</Text>
            <Text style={styles.emptySubtext}>Payments will appear here when users send money to your M-PESA number</Text>
          </View>
        }
      />
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  refreshButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  list: {
    padding: 20,
    gap: 16,
  },
  paymentCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  verifiedCard: {
    borderColor: Colors.success,
    backgroundColor: Colors.success + '10',
  },
  rejectedCard: {
    borderColor: Colors.error,
    backgroundColor: Colors.error + '10',
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  paymentInfo: {
    flex: 1,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  amount: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  verifiedText: {
    color: Colors.success,
  },
  rejectedText: {
    color: Colors.error,
  },
  clientName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  galleryName: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.border,
  },
  verifiedBadge: {
    backgroundColor: Colors.success,
  },
  rejectedBadge: {
    backgroundColor: Colors.error,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textPrimary,
    textTransform: 'uppercase',
  },
  verifiedBadgeText: {
    color: Colors.white,
  },
  rejectedBadgeText: {
    color: Colors.white,
  },
  paymentDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
  },
  verifyButton: {
    backgroundColor: Colors.success,
  },
  rejectButton: {
    backgroundColor: Colors.error,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
