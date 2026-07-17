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
  Modal,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Smartphone,
  Download,
  Send,
  Calendar,
  X,
  RotateCcw,
  FileText,
  Phone,
  Receipt,
  Hash,
  Banknote,
  Copy,
  Inbox,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';

type Transaction = {
  id: string;
  phone_number: string;
  amount: number;
  status: 'pending' | 'success' | 'failed';
  mpesa_receipt: string | null;
  merchant_request_id: string | null;
  checkout_request_id: string | null;
  gallery_id: string | null;
  client_id: string | null;
  created_at: string;
  updated_at: string;
  galleries?: { name: string } | null;
  user_profiles?: { full_name: string } | null;
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

type DateRange = {
  start: Date;
  end: Date;
} | null;

function formatCurrency(amount: number): string {
  return `KES ${amount.toLocaleString()}`;
}

function maskPhone(phone: string): string {
  if (phone.length >= 9) {
    return phone.slice(0, 5) + '***' + phone.slice(-2);
  }
  return phone;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function toCSVRow(values: (string | number | null)[]): string {
  return values
    .map((v) => {
      if (v === null || v === undefined) return '';
      const str = String(v);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    })
    .join(',');
}

export default function MpesaTransactionsScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateRange, setDateRange] = useState<DateRange>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [sendingReceipt, setSendingReceipt] = useState<string | null>(null);
  const [retryingFailed, setRetryingFailed] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const fetchTransactions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('mpesa_transactions')
        .select(`
          *,
          galleries(name),
          user_profiles!mpesa_transactions_client_id_fkey(full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(500);

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
    const successRate =
      transactions.length > 0
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
        t.mpesa_receipt?.toLowerCase().includes(search.toLowerCase()) ||
        t.user_profiles?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        t.checkout_request_id?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === 'all' || t.status === statusFilter;
      const matchesDate = !dateRange || (() => {
        const txDate = new Date(t.created_at);
        return txDate >= dateRange.start && txDate <= dateRange.end;
      })();
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [transactions, search, statusFilter, dateRange]);

  const handleResendReceipt = async (tx: Transaction) => {
    if (!tx.mpesa_receipt || !tx.phone_number) {
      Alert.alert('Error', 'Missing receipt number or phone number.');
      return;
    }

    setSendingReceipt(tx.id);
    try {
      const clientName = tx.user_profiles?.full_name || 'Customer';
      const message = `Hello ${clientName}, your M-Pesa payment of KES ${Number(tx.amount).toLocaleString()} was received successfully. Receipt: ${tx.mpesa_receipt}. Thank you!`;

      const { error } = await supabase.functions.invoke('send-sms', {
        body: {
          phone_number: tx.phone_number,
          message,
        },
      });

      if (error) throw error;
      Alert.alert('Sent', `Receipt sent to ${maskPhone(tx.phone_number)}`);
    } catch (error: any) {
      Alert.alert('Failed', error.message || 'Could not send receipt.');
    } finally {
      setSendingReceipt(null);
    }
  };

  const handleRetryFailed = async (tx: Transaction) => {
    if (!tx.checkout_request_id && !tx.phone_number) {
      Alert.alert('Error', 'Missing checkout info for retry.');
      return;
    }

    setRetryingFailed(tx.id);
    try {
      const { error } = await supabase.functions.invoke('stk_push', {
        body: {
          galleryId: tx.gallery_id,
          clientId: tx.client_id,
          phoneNumber: tx.phone_number,
          amount: Number(tx.amount),
        },
      });

      if (error) throw error;
      Alert.alert('Retried', 'STK push re-initiated. The customer should receive a PIN prompt.');
      fetchTransactions();
    } catch (error: any) {
      Alert.alert('Retry Failed', error.message || 'Could not retry transaction.');
    } finally {
      setRetryingFailed(null);
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const headers = [
        'Date',
        'Time',
        'Phone',
        'Amount',
        'Status',
        'M-Pesa Receipt',
        'Checkout Request ID',
        'Merchant Request ID',
        'Client Name',
        'Gallery',
      ];

      const rows = filteredTransactions.map((tx) => {
        const date = new Date(tx.created_at);
        return toCSVRow([
          formatDate(date),
          date.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }),
          tx.phone_number,
          Number(tx.amount),
          tx.status,
          tx.mpesa_receipt || '',
          tx.checkout_request_id || '',
          tx.merchant_request_id || '',
          tx.user_profiles?.full_name || 'Unknown',
          (tx.galleries as any)?.name || '',
        ]);
      });

      const csvContent = [headers.join(','), ...rows].join('\n');
      const fileName = `mpesa-transactions-${new Date().toISOString().slice(0, 10)}.csv`;

      if (Platform.OS === 'web') {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const FileSystem = await import('expo-file-system');
        const fileUri = FileSystem.documentDirectory + fileName;
        await FileSystem.writeAsStringAsync(fileUri, csvContent, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        Alert.alert('Exported', `CSV saved to: ${fileName}`);
      }
    } catch (error: any) {
      Alert.alert('Export Failed', error.message || 'Could not export CSV.');
    } finally {
      setExporting(false);
    }
  };

  const clearDateRange = () => {
    setDateRange(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return '#10B981';
      case 'failed':
        return '#EF4444';
      case 'cancelled':
        return '#6B7280';
      default:
        return '#F59E0B';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return CheckCircle2;
      case 'failed':
        return XCircle;
      default:
        return Clock;
    }
  };

  const openDetail = (tx: Transaction) => {
    setSelectedTransaction(tx);
    setShowDetailModal(true);
  };

  const renderStatCard = (
    icon: any,
    value: string,
    label: string,
    color: string,
  ) => (
    <View style={styles.statCard}>
      {icon}
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  const renderTransactionCard = ({ item }: { item: Transaction }) => {
    const statusColor = getStatusColor(item.status);
    const StatusIcon = getStatusIcon(item.status);

    return (
      <Pressable
        style={styles.transactionCard}
        onPress={() => openDetail(item)}
      >
        <View style={styles.cardRow}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <Text style={styles.clientName} numberOfLines={1}>
                {item.user_profiles?.full_name || 'Unknown'}
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
            {item.mpesa_receipt && (
              <View style={styles.receiptBadge}>
                <Receipt size={10} color="rgba(255,255,255,0.5)" />
                <Text style={styles.receiptText}>{item.mpesa_receipt}</Text>
              </View>
            )}
          </View>
          <StatusIcon size={16} color={statusColor} />
        </View>
        {item.status === 'failed' && (
          <Pressable
            style={styles.retryRow}
            onPress={(e) => {
              e.stopPropagation?.();
              handleRetryFailed(item);
            }}
            disabled={retryingFailed === item.id}
          >
            {retryingFailed === item.id ? (
              <ActivityIndicator size={12} color="#F59E0B" />
            ) : (
              <RotateCcw size={12} color="#F59E0B" />
            )}
            <Text style={styles.retryText}>
              {retryingFailed === item.id ? 'Retrying...' : 'Retry'}
            </Text>
          </Pressable>
        )}
      </Pressable>
    );
  };

  const renderEmptyState = () => {
    if (loading) {
      return (
        <ActivityIndicator size="large" color={Colors.gold} style={{ marginTop: 60 }} />
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          <Inbox size={64} color="rgba(212, 175, 55, 0.15)" />
        </View>
        <Text style={styles.emptyTitle}>No Transactions Found</Text>
        <Text style={styles.emptySubtitle}>
          {search || statusFilter !== 'all' || dateRange
            ? 'Try adjusting your filters or search terms'
            : 'Transactions will appear here once payments are made'}
        </Text>
        {(search || statusFilter !== 'all' || dateRange) && (
          <Pressable
            style={styles.clearFiltersBtn}
            onPress={() => {
              setSearch('');
              setStatusFilter('all');
              setDateRange(null);
            }}
          >
            <X size={14} color={Colors.gold} />
            <Text style={styles.clearFiltersText}>Clear All Filters</Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>Transactions</Text>
            <Text style={styles.subtitle}>{stats.total} total transactions</Text>
          </View>
          <Pressable
            style={[styles.exportBtn, exporting && { opacity: 0.5 }]}
            onPress={handleExportCSV}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator size={16} color={Colors.gold} />
            ) : (
              <Download size={16} color={Colors.gold} />
            )}
            <Text style={styles.exportBtnText}>Export</Text>
          </Pressable>
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        {renderStatCard(
          <Banknote size={16} color={Colors.gold} />,
          formatCurrency(stats.totalRevenue),
          'Revenue',
          Colors.gold,
        )}
        {renderStatCard(
          <CheckCircle2 size={16} color="#10B981" />,
          `${stats.successRate}%`,
          'Success',
          '#10B981',
        )}
        {renderStatCard(
          <Clock size={16} color="#F59E0B" />,
          String(stats.pending),
          'Pending',
          '#F59E0B',
        )}
        {renderStatCard(
          <XCircle size={16} color="#EF4444" />,
          String(stats.failed),
          'Failed',
          '#EF4444',
        )}
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Search size={16} color="rgba(255,255,255,0.4)" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search phone, receipt, name..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <X size={16} color="rgba(255,255,255,0.3)" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Date Range + Filters Row */}
      <View style={styles.filterRow}>
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
              <Text
                style={[
                  styles.filterText,
                  statusFilter === f && styles.filterTextActive,
                ]}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </Pressable>
          ))}

          <Pressable
            style={[
              styles.filterChip,
              styles.dateFilterChip,
              dateRange && styles.filterChipActive,
            ]}
            onPress={() => setShowDatePicker(true)}
          >
            <Calendar
              size={12}
              color={dateRange ? '#080810' : 'rgba(255,255,255,0.6)'}
            />
            <Text
              style={[
                styles.filterText,
                dateRange && styles.filterTextActive,
              ]}
            >
              {dateRange
                ? `${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}`
                : 'Date Range'}
            </Text>
            {dateRange && (
              <Pressable onPress={clearDateRange}>
                <X size={12} color="#080810" />
              </Pressable>
            )}
          </Pressable>
        </ScrollView>
      </View>

      {/* Transaction List */}
      <FlatList
        data={filteredTransactions}
        renderItem={renderTransactionCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.gold}
          />
        }
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={
          filteredTransactions.length > 0 ? (
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Showing {filteredTransactions.length} of {transactions.length} transactions
              </Text>
            </View>
          ) : null
        }
      />

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.datePickerModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Date Range</Text>
              <Pressable onPress={() => setShowDatePicker(false)}>
                <X size={20} color="rgba(255,255,255,0.5)" />
              </Pressable>
            </View>

            <View style={styles.datePresets}>
              {[
                { label: 'Today', days: 0 },
                { label: 'Last 7 Days', days: 7 },
                { label: 'Last 30 Days', days: 30 },
                { label: 'This Month', days: -1 },
                { label: 'Last Month', days: -2 },
              ].map((preset) => (
                <Pressable
                  key={preset.label}
                  style={styles.presetBtn}
                  onPress={() => {
                    const now = new Date();
                    let start: Date;
                    let end: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

                    if (preset.days === 0) {
                      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
                    } else if (preset.days === -1) {
                      start = new Date(now.getFullYear(), now.getMonth(), 1);
                    } else if (preset.days === -2) {
                      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
                    } else {
                      start = new Date(now);
                      start.setDate(start.getDate() - preset.days);
                      start.setHours(0, 0, 0, 0);
                    }

                    setDateRange({ start, end });
                    setShowDatePicker(false);
                  }}
                >
                  <Text style={styles.presetText}>{preset.label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.customDateSection}>
              <Text style={styles.customDateLabel}>Custom Range</Text>
              <View style={styles.customDateRow}>
                <Pressable
                  style={styles.dateInput}
                  onPress={() => {
                    const now = new Date();
                    const start = new Date(now.getFullYear(), now.getMonth(), 1);
                    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
                    setDateRange({ start, end });
                    setShowDatePicker(false);
                  }}
                >
                  <Calendar size={14} color="rgba(255,255,255,0.4)" />
                  <Text style={styles.dateInputText}>
                    {dateRange ? formatDate(dateRange.start) : 'Start Date'}
                  </Text>
                </Pressable>
                <Text style={styles.dateSeparator}>—</Text>
                <Pressable
                  style={styles.dateInput}
                  onPress={() => {
                    const now = new Date();
                    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
                    setDateRange((prev) => ({
                      start: prev?.start || new Date(now.getFullYear(), now.getMonth(), 1),
                      end,
                    }));
                    setShowDatePicker(false);
                  }}
                >
                  <Calendar size={14} color="rgba(255,255,255,0.4)" />
                  <Text style={styles.dateInputText}>
                    {dateRange ? formatDate(dateRange.end) : 'End Date'}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.dateModalActions}>
              <Pressable
                style={styles.dateCancelBtn}
                onPress={() => {
                  clearDateRange();
                  setShowDatePicker(false);
                }}
              >
                <Text style={styles.dateCancelText}>Clear</Text>
              </Pressable>
              <Pressable
                style={styles.dateApplyBtn}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={styles.dateApplyText}>Apply</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Transaction Detail Modal */}
      <Modal
        visible={showDetailModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailModal}>
            {selectedTransaction && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Transaction Details</Text>
                  <Pressable onPress={() => setShowDetailModal(false)}>
                    <X size={20} color="rgba(255,255,255,0.5)" />
                  </Pressable>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.detailContent}
                >
                  {/* Status Banner */}
                  <View
                    style={[
                      styles.statusBanner,
                      {
                        backgroundColor:
                          getStatusColor(selectedTransaction.status) + '15',
                        borderColor:
                          getStatusColor(selectedTransaction.status) + '30',
                      },
                    ]}
                  >
                    {(() => {
                      const StatusIcon = getStatusIcon(selectedTransaction.status);
                      return (
                        <StatusIcon
                          size={24}
                          color={getStatusColor(selectedTransaction.status)}
                        />
                      );
                    })()}
                    <View style={styles.statusBannerInfo}>
                      <Text
                        style={[
                          styles.statusBannerTitle,
                          { color: getStatusColor(selectedTransaction.status) },
                        ]}
                      >
                        {selectedTransaction.status.charAt(0).toUpperCase() +
                          selectedTransaction.status.slice(1)}
                      </Text>
                      <Text style={styles.statusBannerSub}>
                        {new Date(selectedTransaction.created_at).toLocaleString(
                          'en-KE',
                          {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          },
                        )}
                      </Text>
                    </View>
                  </View>

                  {/* Amount */}
                  <View style={styles.detailAmountSection}>
                    <Text style={styles.detailAmountLabel}>Amount</Text>
                    <Text
                      style={[
                        styles.detailAmountValue,
                        { color: getStatusColor(selectedTransaction.status) },
                      ]}
                    >
                      {formatCurrency(Number(selectedTransaction.amount))}
                    </Text>
                  </View>

                  {/* Info Rows */}
                  <View style={styles.detailInfoSection}>
                    <DetailRow
                      icon={<Phone size={16} color={Colors.gold} />}
                      label="Phone Number"
                      value={selectedTransaction.phone_number}
                      onCopy={() => {
                        if (Platform.OS === 'web') {
                          navigator.clipboard.writeText(selectedTransaction.phone_number);
                        }
                      }}
                    />
                    {selectedTransaction.mpesa_receipt && (
                      <DetailRow
                        icon={<Receipt size={16} color={Colors.gold} />}
                        label="M-Pesa Receipt"
                        value={selectedTransaction.mpesa_receipt}
                        onCopy={() => {
                          if (Platform.OS === 'web') {
                            navigator.clipboard.writeText(selectedTransaction.mpesa_receipt!);
                          }
                        }}
                      />
                    )}
                    {selectedTransaction.checkout_request_id && (
                      <DetailRow
                        icon={<Hash size={16} color={Colors.gold} />}
                        label="Checkout Request ID"
                        value={selectedTransaction.checkout_request_id}
                        onCopy={() => {
                          if (Platform.OS === 'web') {
                            navigator.clipboard.writeText(selectedTransaction.checkout_request_id!);
                          }
                        }}
                      />
                    )}
                    {selectedTransaction.merchant_request_id && (
                      <DetailRow
                        icon={<Hash size={16} color={Colors.gold} />}
                        label="Merchant Request ID"
                        value={selectedTransaction.merchant_request_id}
                        onCopy={() => {
                          if (Platform.OS === 'web') {
                            navigator.clipboard.writeText(selectedTransaction.merchant_request_id!);
                          }
                        }}
                      />
                    )}
                    <DetailRow
                      icon={<FileText size={16} color={Colors.gold} />}
                      label="Transaction ID"
                      value={selectedTransaction.id}
                      onCopy={() => {
                        if (Platform.OS === 'web') {
                          navigator.clipboard.writeText(selectedTransaction.id);
                        }
                      }}
                    />
                    <DetailRow
                      icon={<Clock size={16} color={Colors.gold} />}
                      label="Created"
                      value={new Date(selectedTransaction.created_at).toLocaleString('en-KE')}
                    />
                    <DetailRow
                      icon={<Clock size={16} color={Colors.gold} />}
                      label="Last Updated"
                      value={new Date(selectedTransaction.updated_at).toLocaleString('en-KE')}
                    />
                    {selectedTransaction.galleries && (
                      <DetailRow
                        icon={<FileText size={16} color={Colors.gold} />}
                        label="Gallery"
                        value={(selectedTransaction.galleries as any)?.name || 'N/A'}
                      />
                    )}
                    {selectedTransaction.user_profiles && (
                      <DetailRow
                        icon={<Smartphone size={16} color={Colors.gold} />}
                        label="Client"
                        value={(selectedTransaction.user_profiles as any)?.full_name || 'Unknown'}
                      />
                    )}
                  </View>
                </ScrollView>

                {/* Action Buttons */}
                <View style={styles.detailActions}>
                  {selectedTransaction.status === 'success' &&
                    selectedTransaction.mpesa_receipt && (
                      <Pressable
                        style={[
                          styles.actionBtn,
                          styles.receiptBtn,
                          sendingReceipt === selectedTransaction.id && { opacity: 0.5 },
                        ]}
                        onPress={() => handleResendReceipt(selectedTransaction)}
                        disabled={sendingReceipt === selectedTransaction.id}
                      >
                        {sendingReceipt === selectedTransaction.id ? (
                          <ActivityIndicator size={16} color={Colors.gold} />
                        ) : (
                          <Send size={16} color={Colors.gold} />
                        )}
                        <Text style={styles.receiptBtnText}>Resend Receipt</Text>
                      </Pressable>
                    )}

                  {selectedTransaction.status === 'failed' && (
                    <Pressable
                      style={[
                        styles.actionBtn,
                        styles.retryBtn,
                        retryingFailed === selectedTransaction.id && { opacity: 0.5 },
                      ]}
                      onPress={() => {
                        handleRetryFailed(selectedTransaction);
                        setShowDetailModal(false);
                      }}
                      disabled={retryingFailed === selectedTransaction.id}
                    >
                      {retryingFailed === selectedTransaction.id ? (
                        <ActivityIndicator size={16} color="#F59E0B" />
                      ) : (
                        <RotateCcw size={16} color="#F59E0B" />
                      )}
                      <Text style={styles.retryBtnText}>Retry Transaction</Text>
                    </Pressable>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DetailRow({
  icon,
  label,
  value,
  onCopy,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onCopy?: () => void;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailRowLeft}>
        {icon}
        <Text style={styles.detailRowLabel}>{label}</Text>
      </View>
      <View style={styles.detailRowRight}>
        <Text style={styles.detailRowValue} numberOfLines={1}>
          {value}
        </Text>
        {onCopy && (
          <Pressable onPress={onCopy} style={styles.copyBtn}>
            <Copy size={12} color="rgba(255,255,255,0.3)" />
          </Pressable>
        )}
      </View>
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  exportBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.gold,
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
  filterRow: {
    paddingBottom: 12,
  },
  filters: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  filterChipActive: {
    backgroundColor: Colors.gold,
  },
  dateFilterChip: {
    paddingHorizontal: 12,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
  retryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  retryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    gap: 12,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.1)',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  clearFiltersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  clearFiltersText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.gold,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  datePickerModal: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  detailModal: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  datePresets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 16,
  },
  presetBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  presetText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  customDateSection: {
    paddingTop: 20,
  },
  customDateLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  customDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  dateInputText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  dateSeparator: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.3)',
  },
  dateModalActions: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 20,
  },
  dateCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  dateCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  dateApplyBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.gold,
    alignItems: 'center',
  },
  dateApplyText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#080810',
  },
  // Detail modal
  detailContent: {
    padding: 20,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  statusBannerInfo: {
    flex: 1,
  },
  statusBannerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  statusBannerSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  detailAmountSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  detailAmountLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  detailAmountValue: {
    fontSize: 36,
    fontWeight: '900',
    marginTop: 4,
  },
  detailInfoSection: {
    gap: 0,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  detailRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  detailRowLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  detailRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'flex-end',
  },
  detailRowValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'right',
    maxWidth: 180,
  },
  copyBtn: {
    padding: 4,
  },
  detailActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  receiptBtn: {
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  receiptBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.gold,
  },
  retryBtn: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F59E0B',
  },
});
