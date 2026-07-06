import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, MessageCircle, Check, X, Clock, Smartphone } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type SMSLog = {
  id: string;
  phone_number: string;
  message: string;
  provider: string;
  status: string;
  cost?: number;
  created_at: string;
  client?: { name: string } | null;
};

export default function SMSHistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [logs, setLogs] = useState<SMSLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [credits, setCredits] = useState(0);

  const loadLogs = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('sms_logs')
        .select('*, client:clients(name)')
        .eq('photographer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Failed to load SMS logs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadCredits = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('sms_credits')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setCredits(data?.sms_credits || 0);
    } catch (error) {
      console.error('Failed to load credits:', error);
    }
  };

  useEffect(() => {
    loadLogs();
    loadCredits();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadLogs();
    loadCredits();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return <Check size={14} color={Colors.success} />;
      case 'failed':
        return <X size={14} color={Colors.error} />;
      default:
        return <Clock size={14} color={Colors.warning} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return Colors.success;
      case 'failed':
        return Colors.error;
      default:
        return Colors.warning;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
  };

  const renderLog = ({ item }: { item: SMSLog }) => (
    <View style={styles.logCard}>
      <View style={styles.logHeader}>
        <View style={styles.logInfo}>
          <MessageCircle size={16} color={Colors.gold} />
          <View style={styles.logDetails}>
            <Text style={styles.logPhone}>{item.phone_number}</Text>
            <Text style={styles.logClient}>
              {item.client?.name || 'Unknown client'}
            </Text>
          </View>
        </View>
        <View style={styles.logStatus}>
          {getStatusIcon(item.status)}
          <Text style={[styles.logStatusText, { color: getStatusColor(item.status) }]}>
            {item.status}
          </Text>
        </View>
      </View>
      
      <Text style={styles.logMessage} numberOfLines={2}>
        {item.message}
      </Text>
      
      <View style={styles.logFooter}>
        <View style={styles.logMeta}>
          <Smartphone size={12} color={Colors.textMuted} />
          <Text style={styles.logProvider}>
            {item.provider === 'native' ? 'Native' : 
             item.provider === 'whatsapp' ? 'WhatsApp' : 'Cloud SMS'}
          </Text>
        </View>
        <Text style={styles.logTime}>{formatDate(item.created_at)}</Text>
        {item.cost && item.cost > 0 && (
          <Text style={styles.logCost}>KES {item.cost.toFixed(2)}</Text>
        )}
      </View>
    </View>
  );

  const totalCost = logs.reduce((sum, log) => sum + (log.cost || 0), 0);
  const sentCount = logs.filter(l => l.status === 'sent' || l.status === 'delivered').length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} color={Colors.text} />
        </Pressable>
        <Text style={styles.title}>SMS History</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Credits Card */}
      <View style={styles.creditsCard}>
        <LinearGradient
          colors={[Colors.gold + '20', Colors.gold + '05']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.creditsGradient}
        >
          <View style={styles.creditsRow}>
            <View>
              <Text style={styles.creditsLabel}>SMS Credits</Text>
              <Text style={styles.creditsValue}>KES {credits.toFixed(2)}</Text>
            </View>
            <View style={styles.creditsStats}>
              <Text style={styles.statsText}>{sentCount} sent</Text>
              <Text style={styles.statsText}>KES {totalCost.toFixed(2)} spent</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Logs List */}
      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        renderItem={renderLog}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <MessageCircle size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No SMS History</Text>
              <Text style={styles.emptySubtitle}>
                SMS messages sent from the app will appear here
              </Text>
            </View>
          ) : null
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
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  creditsCard: {
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  creditsGradient: {
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.gold + '30',
    borderRadius: 16,
  },
  creditsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  creditsLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  creditsValue: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.gold,
  },
  creditsStats: {
    alignItems: 'flex-end',
  },
  statsText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  listContent: {
    padding: 16,
  },
  logCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  logInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logDetails: {
    marginLeft: 8,
    flex: 1,
  },
  logPhone: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  logClient: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  logStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  logStatusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  logMessage: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
    marginBottom: 8,
  },
  logFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  logProvider: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  logTime: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  logCost: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.gold,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
});
