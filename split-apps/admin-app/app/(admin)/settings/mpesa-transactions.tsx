import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  TextInput,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  CreditCard,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  TrendingUp,
  ArrowDown,
  ArrowUp,
  Filter,
  Smartphone,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';

type Transaction = {
  id: string;
  phone_number: string;
  amount: number;
  status: 'pending' | 'success' | 'failed' | 'cancelled';
  mpesa_receipt_number: string | null;
  transaction_type: 'stk_push' | 'c2b';
  result_code: number | null;
  created_at: string;
  clients: {
    id: string;
    user_profiles: { full_name: string } | null;
  } | null;
  payment_gateways: {
    shortcode: string | null;
    till_number: string | null;
  } | null;
};

type Stats = {
  total: number;
  success: number;
  pending: number;
  failed: number;
  totalRevenue: number;
  successRate: number;
};

type StatusFilter = 'all' | 'success' | 'pending' | 'failed';

function formatCurrency(amount: number): string {
  return `KES ${amount.toLocaleString()}`;
}

function maskPhone(phone: string): string {
  if (phone.length >= 9) {
    return phone.slice(0, 5) + '***' + phone.slice(-2);
  }
  return phone;
}

export default function MpesaTransactionsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const fetchTransactions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          clients (
            id,
            user_profiles (full_name)
          ),
          payment_gateways (shortcode, till_number)
        `)
        .order('created_at', { ascending: false })
        .limit(200);

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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTransactions();
  }, [fetchTransactions]);

  const stats: Stats = useMemo(() => {
    const success = transactions.filter((t) => t.status === 'success');
    const pending = transactions.filter((t) => t.status === 'pending');
    const failed = transactions.filter((t) => t.status === 'failed');
    const totalRevenue = success.reduce((sum, t) => sum + Number(t.amount), 0);
    const successRate = transactions.length > 0
      ? Math.round((success.length / transactions.length) * 100)
      : 0;

    return {
      total: transactions.length,
      success: success.length,
      pending: pending.length,
      failed: failed.length,
      totalRevenue,
      successRate,
    };
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchesSearch =
        t.phone_number.includes(search) ||
        t.mpesa_receipt_number?.toLowerCase().includes(search.toLowerCase()) ||
        t.clients?.user_profiles?.full_name?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === 'all' || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [transactions, search, statusFilter]);

  const renderItem = ({ item }: { item: Transaction }) => {
    const statusColor =
      item.status === 'success' ? '#10B981' :
      item.status === 'failed' ? '#EF4444' :
      item.status === 'cancelled' ? '#6B7280' : '#F59E0B';
    const StatusIcon =
      item.status === 'success' ? CheckCircle2 :
      item.status === 'failed' ? XCircle :
      item.status === 'cancelled' ? XCircle : Clock;

    return (
      <View style={styles.transactionCard}>
        <View style={styles.cardRow}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <Text style={styles.clientName}>
                {item.clients?.user_profiles?.full_name || 'Unknown'}
              </Text>
              <Text style={[styles.amount, { color: statusColor }]}>
                {formatCurrency(Number(item.amount))}
              </Text>
            </View>
            <View style={styles.cardMeta}>
              <View style={styles.metaItem}>
                <Smartphone size={12} color="rgba(255,255,255,0.4)" />
                <Text style={styles.metaText}>{maskPhone(item.phone_number)}</Text>
              </View>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.metaText}>
                {new Date(item.created_at).toLocaleDateString('en-KE', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            {item.mpesa_receipt_number && (
              <View style={styles.receiptBadge}>
                <Text style={styles.receiptText}>{item.mpesa_receipt_number}</Text>
              </View>
            )}
          </View>
          <StatusIcon size={16} color={statusColor} />
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Transactions</Text>
        <Text style={styles.subtitle}>{stats.total} total</Text>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <TrendingUp size={16} color="#10B981" />
          <Text style={styles.statValue}>{formatCurrency(stats.totalRevenue)}</Text>
          <Text style={styles.statLabel}>Revenue</Text>
        </View>
        <View style={styles.statCard}>
          <CheckCircle2 size={16} color="#10B981" />
          <Text style={styles.statValue}>{stats.successRate}%</Text>
          <Text style={styles.statLabel}>Success</Text>
        </View>
        <View style={styles.statCard}>
          <Clock size={16} color="#F59E0B" />
          <Text style={styles.statValue}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statCard}>
          <XCircle size={16} color="#EF4444" />
          <Text style={styles.statValue}>{stats.failed}</Text>
          <Text style={styles.statLabel}>Failed</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Search size={16} color="rgba(255,255,255,0.4)" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by phone, receipt, name..."
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
        {(['all', 'success', 'pending', 'failed'] as StatusFilter[]).map((f) => (
          <Pressable
            key={f}
            style={[styles.filterChip, statusFilter === f && styles.filterChipActive]}
            onPress={() => setStatusFilter(f)}
          >
            <Text style={[styles.filterText, statusFilter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Transaction List */}
      <FlatList
        data={filteredTransactions}
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
              <CreditCard size={48} color="rgba(255,255,255,0.2)" />
              <Text style={styles.emptyText}>No transactions found</Text>
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
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 6,
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
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
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  transactionCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  clientName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  amount: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  metaDot: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
  },
  receiptBadge: {
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  receiptText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: 'rgba(255,255,255,0.5)',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.4)',
  },
});
