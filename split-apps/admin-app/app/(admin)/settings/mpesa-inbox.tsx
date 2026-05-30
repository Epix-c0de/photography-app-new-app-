import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Alert, RefreshControl, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, CheckCircle, XCircle, RefreshCw, Smartphone, DollarSign, Clock, MessageSquare, Search, Unlock, Image as ImageIcon } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type MpesaMessage = {
  id: string;
  user_id: string;
  admin_id: string;
  gallery_id?: string | null;
  booking_id?: string | null;
  amount?: number | null;
  mpesa_code?: string | null;
  mpesa_message: string;
  sender_phone?: string | null;
  status: 'pending' | 'verified' | 'rejected';
  created_at: string;
  updated_at: string;
  user?: {
    email?: string;
    user_metadata?: { name?: string };
  } | null;
  gallery?: {
    title?: string;
    access_code?: string;
  } | null;
};

export default function MpesaInboxScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [messages, setMessages] = useState<MpesaMessage[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<MpesaMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all');

  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);
      if (!user?.id) return;

      const { data, error } = await supabase
        .from('mpesa_messages')
        .select('*')
        .eq('admin_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch user and gallery details separately
      const messagesWithDetails = await Promise.all(
        (data || []).map(async (msg) => {
          let user = null;
          let gallery = null;
          
          if (msg.user_id) {
            const { data: userData } = await supabase
              .from('user_profiles')
              .select('id, email, name')
              .eq('id', msg.user_id)
              .maybeSingle();
            user = userData;
          }
          
          if (msg.gallery_id) {
            const { data: galleryData } = await supabase
              .from('galleries')
              .select('id, title, access_code')
              .eq('id', msg.gallery_id)
              .maybeSingle();
            gallery = galleryData;
          }
          
          return { ...msg, user, gallery } as MpesaMessage;
        })
      );
      
      setMessages(messagesWithDetails);
      filterMessages(messagesWithDetails, activeFilter, searchQuery);
    } catch (error) {
      console.error('Error loading M-Pesa messages:', error);
      Alert.alert('Error', 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [user?.id, activeFilter, searchQuery]);

  const filterMessages = (msgs: MpesaMessage[], filter: string, query: string) => {
    let filtered = msgs;
    
    if (filter !== 'all') {
      filtered = filtered.filter(m => m.status === filter);
    }
    
    if (query.trim()) {
      const q = query.toLowerCase();
      filtered = filtered.filter(m => 
        m.mpesa_message?.toLowerCase().includes(q) ||
        m.mpesa_code?.toLowerCase().includes(q) ||
        m.user?.email?.toLowerCase().includes(q) ||
        m.user?.user_metadata?.name?.toLowerCase().includes(q) ||
        m.sender_phone?.includes(q)
      );
    }
    
    setFilteredMessages(filtered);
  };

  useEffect(() => {
    filterMessages(messages, activeFilter, searchQuery);
  }, [messages, activeFilter, searchQuery]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMessages();
    setRefreshing(false);
  };

  const handleVerify = async (msg: MpesaMessage) => {
    Alert.alert(
      'Verify Payment',
      `Verify M-Pesa payment${msg.amount ? ` of KES ${msg.amount}` : ''} from ${msg.user?.email || msg.sender_phone || 'Unknown'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Verify & Unlock',
          style: 'default',
          onPress: async () => {
            setProcessing(msg.id);
            try {
              // Update message status
              const { error: updateError } = await supabase
                .from('mpesa_messages')
                .update({ status: 'verified', updated_at: new Date().toISOString() })
                .eq('id', msg.id);

              if (updateError) throw updateError;

              // Unlock gallery if gallery_id exists
              if (msg.gallery_id) {
                const { error: unlockError } = await supabase
                  .from('galleries')
                  .update({ is_paid: true, is_locked: false })
                  .eq('id', msg.gallery_id);

                if (unlockError) {
                  console.error('Failed to unlock gallery:', unlockError);
                  Alert.alert('Warning', 'Payment verified but failed to unlock gallery. Please unlock manually.');
                }
              }

              // Update booking status if booking_id exists
              if (msg.booking_id) {
                const { error: bookingError } = await supabase
                  .from('bookings')
                  .update({ status: 'confirmed', payment_status: 'paid' })
                  .eq('id', msg.booking_id);

                if (bookingError) {
                  console.error('Failed to update booking:', bookingError);
                }
              }

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Success', 'Payment verified and content unlocked!');
              await loadMessages();
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

  const handleReject = async (msg: MpesaMessage) => {
    Alert.alert(
      'Reject Payment',
      `Reject this M-Pesa confirmation from ${msg.user?.email || msg.sender_phone || 'Unknown'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setProcessing(msg.id);
            try {
              const { error } = await supabase
                .from('mpesa_messages')
                .update({ status: 'rejected', updated_at: new Date().toISOString() })
                .eq('id', msg.id);

              if (error) throw error;

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Rejected', 'Payment has been rejected');
              await loadMessages();
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified': return Colors.success;
      case 'rejected': return Colors.error;
      default: return Colors.gold;
    }
  };

  const renderMessage = ({ item }: { item: MpesaMessage }) => (
    <View style={[styles.messageCard, item.status === 'verified' && styles.verifiedCard, item.status === 'rejected' && styles.rejectedCard]}>
      <View style={styles.messageHeader}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(item.user?.user_metadata?.name?.[0] || item.user?.email?.[0] || '?').toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.userName}>
              {item.user?.user_metadata?.name || item.user?.email || 'Unknown User'}
            </Text>
            <Text style={styles.userEmail}>{item.user?.email}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20', borderColor: getStatusColor(item.status) }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.messageBody}>
        <View style={styles.detailRow}>
          <Smartphone size={16} color={Colors.textSecondary} />
          <Text style={styles.detailText}>{item.sender_phone || 'No phone'}</Text>
        </View>
        
        {item.mpesa_code && (
          <View style={styles.detailRow}>
            <MessageSquare size={16} color={Colors.textSecondary} />
            <Text style={styles.detailText}>Code: {item.mpesa_code}</Text>
          </View>
        )}
        
        {item.amount && (
          <View style={styles.detailRow}>
            <DollarSign size={16} color={Colors.gold} />
            <Text style={[styles.detailText, { color: Colors.gold, fontWeight: '600' }]}>
              KES {item.amount.toLocaleString()}
            </Text>
          </View>
        )}

        {item.gallery && (
          <View style={styles.detailRow}>
            <ImageIcon size={16} color={Colors.textSecondary} />
            <Text style={styles.detailText}>Gallery: {item.gallery.title || item.gallery.access_code}</Text>
          </View>
        )}

        <View style={styles.messageTextBox}>
          <Text style={styles.messageText}>{item.mpesa_message}</Text>
        </View>

        <View style={styles.timeRow}>
          <Clock size={14} color={Colors.textMuted} />
          <Text style={styles.timeText}>
            {new Date(item.created_at).toLocaleString('en-US', {
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
                <Text style={styles.actionButtonText}>Verify & Unlock</Text>
              </>
            )}
          </Pressable>
          <Pressable
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => handleReject(item)}
            disabled={processing === item.id}
          >
            <XCircle size={16} color={Colors.white} />
            <Text style={styles.actionButtonText}>Reject</Text>
          </Pressable>
        </View>
      )}

      {item.status === 'verified' && item.gallery_id && (
        <View style={styles.unlockedBadge}>
          <Unlock size={14} color={Colors.success} />
          <Text style={styles.unlockedText}>Gallery Unlocked</Text>
        </View>
      )}
    </View>
  );

  const FilterChip = ({ label, value }: { label: string; value: typeof activeFilter }) => (
    <Pressable
      style={[styles.filterChip, activeFilter === value && styles.filterChipActive]}
      onPress={() => setActiveFilter(value)}
    >
      <Text style={[styles.filterChipText, activeFilter === value && styles.filterChipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>M-Pesa Inbox</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.gold} />
          <Text style={styles.loadingText}>Loading messages...</Text>
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
        <Text style={styles.headerTitle}>M-Pesa Inbox</Text>
        <Pressable onPress={onRefresh} style={styles.refreshButton}>
          <RefreshCw size={20} color={Colors.gold} />
        </Pressable>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Search size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by code, phone, or user..."
          placeholderTextColor={Colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        <FilterChip label="All" value="all" />
        <FilterChip label="Pending" value="pending" />
        <FilterChip label="Verified" value="verified" />
        <FilterChip label="Rejected" value="rejected" />
      </View>

      <FlatList
        data={filteredMessages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MessageSquare size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>
              {searchQuery ? 'No messages found' : 'No M-Pesa messages yet'}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchQuery 
                ? 'Try a different search term' 
                : 'Messages will appear here when users submit M-Pesa confirmations'}
            </Text>
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
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  refreshButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: -8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },
  filterChipText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#000',
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
  messageCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  verifiedCard: {
    borderColor: Colors.success,
    backgroundColor: Colors.success + '08',
  },
  rejectedCard: {
    borderColor: Colors.error,
    backgroundColor: Colors.error + '08',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gold + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gold,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  userEmail: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  messageBody: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  messageTextBox: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
  },
  messageText: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  timeText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
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
  unlockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    backgroundColor: Colors.success + '15',
    borderRadius: 8,
  },
  unlockedText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.success,
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
