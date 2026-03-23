import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, FlatList } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageSquare, CreditCard, Activity, Plus, Trash2, Check, AlertCircle, RefreshCw, Settings, Smartphone } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { DeliveryService } from '@/services/delivery';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/supabase';

type DeliveryGateway = Database['public']['Tables']['delivery_gateways']['Row'];
type DeliveryLog = Database['public']['Tables']['delivery_logs']['Row'];

export default function DeliverySettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{
    sent: number;
    failed: number;
    balance: number;
    successRate: string;
  } | null>(null);
  const [gateways, setGateways] = useState<DeliveryGateway[]>([]);
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // New Gateway Form
  const [showAddGateway, setShowAddGateway] = useState(false);
  const [newGatewayName, setNewGatewayName] = useState('');
  const [newGatewayType, setNewGatewayType] = useState('http');
  const [newGatewayUrl, setNewGatewayUrl] = useState('');
  const [newGatewayKey, setNewGatewayKey] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load Stats
      const statsData = await DeliveryService.getStats();
      setStats(statsData);

      // Load Gateways
      const { data: gatewaysData } = await supabase
        .from('delivery_gateways')
        .select('*')
        .order('priority', { ascending: false });
      setGateways(gatewaysData || []);

      // Load Recent Logs
      const { data: logsData } = await supabase
        .from('delivery_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      setLogs(logsData || []);

    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to load delivery settings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefill = async () => {
    Alert.alert(
      'Refill Credits',
      'This would open the payment gateway (Stripe/PayPal). Adding 100 credits for demo.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Pay $5.00', 
          onPress: async () => {
            await DeliveryService.refillCredits(100);
            loadData();
          } 
        }
      ]
    );
  };

  const handleAddGateway = async () => {
    if (!newGatewayName) return Alert.alert('Error', 'Name is required');
    
    try {
      const config = newGatewayType === 'http' ? { url: newGatewayUrl, api_key: newGatewayKey } : {};
      
      const { error } = await supabase.from('delivery_gateways').insert({
        name: newGatewayName,
        type: newGatewayType as any,
        config,
        priority: gateways.length + 1,
        active: true,
        cost_per_msg: 1
      });

      if (error) throw error;
      
      setShowAddGateway(false);
      setNewGatewayName('');
      setNewGatewayUrl('');
      setNewGatewayKey('');
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const toggleGateway = async (id: string, current: boolean) => {
    await supabase.from('delivery_gateways').update({ active: !current }).eq('id', id);
    loadData();
  };

  const deleteGateway = async (id: string) => {
    Alert.alert('Confirm', 'Delete this gateway?', [
      { text: 'Cancel' },
      { 
        text: 'Delete', 
        style: 'destructive', 
        onPress: async () => {
          await supabase.from('delivery_gateways').delete().eq('id', id);
          loadData();
        }
      }
    ]);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ 
        title: 'Delivery Settings',
        headerShown: true,
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.textPrimary,
      }} />
      
      <ScrollView 
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats Section */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <CreditCard size={20} color={Colors.gold} />
              <Text style={styles.statLabel}>Credits</Text>
            </View>
            <Text style={styles.statValue}>{stats?.balance?.toFixed(2) || '0.00'}</Text>
            <TouchableOpacity style={styles.refillButton} onPress={handleRefill}>
              <Text style={styles.refillText}>Refill</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Activity size={20} color={Colors.success} />
              <Text style={styles.statLabel}>Success Rate</Text>
            </View>
            <Text style={styles.statValue}>{stats?.successRate || '100'}%</Text>
            <Text style={styles.statSub}>{stats?.sent || 0} sent / {stats?.failed || 0} failed</Text>
          </View>
        </View>

        {/* Gateways Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Gateways</Text>
          <TouchableOpacity onPress={() => setShowAddGateway(!showAddGateway)}>
            <Plus size={20} color={Colors.gold} />
          </TouchableOpacity>
        </View>

        {showAddGateway && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Add Gateway</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Gateway Name" 
              placeholderTextColor={Colors.textMuted}
              value={newGatewayName}
              onChangeText={setNewGatewayName}
            />
            <View style={styles.typeSelector}>
              {['http', 'whatsapp_cloud'].map(t => (
                <TouchableOpacity 
                  key={t}
                  style={[styles.typeOption, newGatewayType === t && styles.typeOptionActive]}
                  onPress={() => setNewGatewayType(t)}
                >
                  <Text style={[styles.typeText, newGatewayType === t && styles.typeTextActive]}>
                    {t === 'http' ? 'HTTP / Modem' : 'WhatsApp'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {newGatewayType === 'http' && (
              <>
                <TextInput 
                  style={styles.input} 
                  placeholder="Endpoint URL" 
                  placeholderTextColor={Colors.textMuted}
                  value={newGatewayUrl}
                  onChangeText={setNewGatewayUrl}
                  autoCapitalize="none"
                />
                <TextInput 
                  style={styles.input} 
                  placeholder="API Key (Optional)" 
                  placeholderTextColor={Colors.textMuted}
                  value={newGatewayKey}
                  onChangeText={setNewGatewayKey}
                  secureTextEntry
                />
              </>
            )}
            <TouchableOpacity style={styles.saveButton} onPress={handleAddGateway}>
              <Text style={styles.saveButtonText}>Add Gateway</Text>
            </TouchableOpacity>
          </View>
        )}

        {gateways.map(g => (
          <View key={g.id} style={styles.gatewayCard}>
            <View style={styles.gatewayInfo}>
              <View style={styles.gatewayHeader}>
                {g.type === 'whatsapp_cloud' ? <MessageSquare size={16} color={Colors.success} /> : <Smartphone size={16} color={Colors.textPrimary} />}
                <Text style={styles.gatewayName}>{g.name}</Text>
                {g.active ? (
                  <View style={styles.badgeActive}><Text style={styles.badgeText}>Active</Text></View>
                ) : (
                  <View style={styles.badgeInactive}><Text style={styles.badgeText}>Inactive</Text></View>
                )}
              </View>
              <Text style={styles.gatewayDetail}>{g.type} • Priority: {g.priority}</Text>
            </View>
            <View style={styles.gatewayActions}>
              <TouchableOpacity onPress={() => toggleGateway(g.id, g.active)} style={styles.actionBtn}>
                <RefreshCw size={18} color={Colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteGateway(g.id)} style={styles.actionBtn}>
                <Trash2 size={18} color={Colors.error} />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Logs Section */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Recent Logs</Text>
        {logs.map(log => (
          <View key={log.id} style={styles.logRow}>
            <View style={styles.logIcon}>
              {log.status === 'sent' || log.status === 'delivered' ? (
                <Check size={16} color={Colors.success} />
              ) : (
                <AlertCircle size={16} color={Colors.error} />
              )}
            </View>
            <View style={styles.logContent}>
              <Text style={styles.logRecipient}>{log.recipient}</Text>
              <Text style={styles.logTime}>{new Date(log.created_at).toLocaleString()}</Text>
            </View>
            <View style={styles.logMeta}>
              <Text style={styles.logMethod}>{log.message_type}</Text>
              <Text style={[styles.logStatus, { color: log.status === 'sent' ? Colors.success : Colors.error }]}>
                {log.status}
              </Text>
            </View>
          </View>
        ))}

        {logs.length === 0 && (
          <Text style={styles.emptyText}>No delivery logs found</Text>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  statLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statValue: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  statSub: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  refillButton: {
    backgroundColor: Colors.gold,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  refillText: {
    color: Colors.background,
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  formCard: {
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  formTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 12,
    color: Colors.textPrimary,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  typeOption: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  typeOptionActive: {
    borderColor: Colors.gold,
    backgroundColor: 'rgba(212,175,55,0.1)',
  },
  typeText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  typeTextActive: {
    color: Colors.gold,
  },
  saveButton: {
    backgroundColor: Colors.gold,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: Colors.background,
    fontWeight: '700',
  },
  gatewayCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  gatewayInfo: {
    flex: 1,
  },
  gatewayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  gatewayName: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  badgeActive: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeInactive: {
    backgroundColor: 'rgba(158, 158, 158, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  gatewayDetail: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  gatewayActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    padding: 4,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  logIcon: {
    width: 32,
    alignItems: 'center',
  },
  logContent: {
    flex: 1,
  },
  logRecipient: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  logTime: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  logMeta: {
    alignItems: 'flex-end',
  },
  logMethod: {
    color: Colors.textMuted,
    fontSize: 10,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  logStatus: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  emptyText: {
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 24,
  },
});
