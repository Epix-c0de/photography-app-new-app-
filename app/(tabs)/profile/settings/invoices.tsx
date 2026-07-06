import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { FileText, Download, CheckCircle, Clock, XCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/Colors';
import SettingsHeader from '@/components/SettingsHeader';
import { supabase } from '@/lib/supabase';

interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  description: string;
  payment_method: string;
  mpesa_receipt?: string;
  created_at: string;
  paid_at?: string;
}

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending'>('all');

  const loadInvoices = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Failed to load invoices:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const filteredInvoices = invoices.filter(inv => {
    if (filter === 'all') return true;
    return inv.status === filter;
  });

  const totalPaid = invoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + Number(inv.amount), 0);

  const formatAmount = (amount: number, currency: string = 'KES') => {
    return `${currency} ${amount.toLocaleString()}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle size={16} color="#22c55e" />;
      case 'pending':
        return <Clock size={16} color="#f59e0b" />;
      case 'failed':
      case 'refunded':
        return <XCircle size={16} color="#ef4444" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return '#22c55e';
      case 'pending':
        return '#f59e0b';
      case 'failed':
      case 'refunded':
        return '#ef4444';
      default:
        return Colors.textMuted;
    }
  };

  const downloadReceipt = async (invoice: Invoice) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Alert.alert('Receipt', `Receipt for ${invoice.description}\n\nAmount: ${formatAmount(invoice.amount, invoice.currency)}\nDate: ${formatDate(invoice.created_at)}\n${invoice.mpesa_receipt ? `M-Pesa: ${invoice.mpesa_receipt}` : ''}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to load receipt');
    }
  };

  const renderItem = ({ item }: { item: Invoice }) => (
    <Pressable style={styles.item} onPress={() => downloadReceipt(item)}>
      <View style={styles.itemHeader}>
        <View style={styles.statusContainer}>
          {getStatusIcon(item.status)}
          <Text style={[styles.status, { color: getStatusColor(item.status) }]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
        <Text style={styles.amount}>{formatAmount(item.amount, item.currency)}</Text>
      </View>
      
      <Text style={styles.description} numberOfLines={1}>
        {item.description || 'Gallery Access'}
      </Text>
      
      <View style={styles.itemFooter}>
        <Text style={styles.date}>{formatDate(item.created_at)}</Text>
        {item.mpesa_receipt && (
          <Text style={styles.receipt}>M-Pesa: {item.mpesa_receipt}</Text>
        )}
      </View>
    </Pressable>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SettingsHeader title="Invoices" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.gold} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SettingsHeader title="Invoices" />
      
      <View style={styles.summary}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Paid</Text>
          <Text style={styles.summaryValue}>{formatAmount(totalPaid)}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Invoices</Text>
          <Text style={styles.summaryValue}>{invoices.length}</Text>
        </View>
      </View>
      
      <View style={styles.filters}>
        {(['all', 'paid', 'pending'] as const).map((f) => (
          <Pressable
            key={f}
            style={[styles.filterButton, filter === f && styles.filterActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>
      
      {filteredInvoices.length === 0 ? (
        <View style={styles.emptyState}>
          <FileText size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No invoices</Text>
          <Text style={styles.emptyDesc}>
            Your payment invoices will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredInvoices}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summary: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.card,
  },
  filterActive: {
    backgroundColor: Colors.gold,
  },
  filterText: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
  filterTextActive: {
    color: Colors.white,
  },
  list: {
    padding: 16,
  },
  item: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  status: {
    fontSize: 14,
    fontWeight: '600',
  },
  amount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  description: {
    fontSize: 14,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  receipt: {
    fontSize: 11,
    color: Colors.textMuted,
    fontFamily: 'monospace',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  emptyDesc: {
    fontSize: 16,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
  },
});