import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, RefreshControl, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, CreditCard, Clock, CheckCircle2, XCircle, Search, Calendar } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';

interface Transaction {
  id: string;
  gallery_id: string;
  client_id: string;
  phone_number: string;
  amount: number;
  status: 'pending' | 'success' | 'failed';
  mpesa_receipt: string | null;
  created_at: string;
  galleries: {
    name: string;
  };
  user_profiles: {
    full_name: string;
  };
}

export default function MpesaTransactionsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const fetchTransactions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('mpesa_transactions')
        .select(`
          *,
          galleries(name),
          user_profiles!mpesa_transactions_client_id_fkey(full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransactions((data as any) || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTransactions();
  };

  const renderItem = ({ item }: { item: Transaction }) => {
    const statusColor = item.status === 'success' ? '#4CAF50' : item.status === 'failed' ? '#F44336' : '#FF9800';
    const StatusIcon = item.status === 'success' ? CheckCircle2 : item.status === 'failed' ? XCircle : Clock;

    return (
      <View style={styles.transactionCard}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.clientName}>{item.user_profiles?.full_name || 'Unknown Client'}</Text>
            <Text style={styles.galleryName}>{item.galleries?.name || 'Gallery Deleted'}</Text>
          </View>
          <View style={styles.amountContainer}>
            <Text style={styles.amount}>KES {item.amount}</Text>
          </View>
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.cardFooter}>
          <View style={styles.infoRow}>
            <Clock size={12} color={Colors.textMuted} />
            <Text style={styles.infoText}>
              {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <StatusIcon size={12} color={statusColor} />
            <Text style={[styles.infoText, { color: statusColor, fontWeight: '600' }]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {item.mpesa_receipt && (
          <View style={styles.receiptBadge}>
            <Text style={styles.receiptText}>Receipt: {item.mpesa_receipt}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Transaction History</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={transactions}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={Colors.gold} style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.emptyContainer}>
              <CreditCard size={48} color={Colors.textMuted} style={{ opacity: 0.3 }} />
              <Text style={styles.emptyText}>No M-PESA transactions found</Text>
            </View>
          )
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
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  listContent: {
    padding: 20,
  },
  transactionCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  galleryName: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  amountContainer: {
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  amount: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.gold,
  },
  cardDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  receiptBadge: {
    marginTop: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: Colors.background,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  receiptText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: Colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
    gap: 16,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 16,
  },
});
