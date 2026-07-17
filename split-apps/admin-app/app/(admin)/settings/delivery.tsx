import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Switch, Modal } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  MessageSquare, CreditCard, Activity, Plus, Trash2, Check, AlertCircle,
  RefreshCw, Settings, Smartphone, HardDrive, Cloud, Database as DatabaseIcon, Globe,
  ArrowRight, Shield, Zap, Server, ChevronDown, ChevronUp, X, CheckCircle,
  Clock, Wifi, Upload, Download, BarChart3, ArrowLeftRight, FileImage,
  Cog, RotateCw, CloudRain, CloudSnow, Sun, Eye, EyeOff
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { DeliveryService } from '@/services/delivery';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/supabase';

type DeliveryGateway = Database['public']['Tables']['delivery_gateways']['Row'];
type DeliveryLog = Database['public']['Tables']['delivery_logs']['Row'];

interface CloudStorageGateway {
  id: string;
  name: string;
  type: 'supabase' | 'cloudinary' | 'aws_s3' | 'gcs';
  active: boolean;
  isDefault: boolean;
  config: Record<string, string>;
  stats: {
    totalFiles: number;
    totalSizeBytes: number;
    bandwidthUsedBytes: number;
    lastUploadAt: string | null;
  };
}

interface StorageStats {
  totalFiles: number;
  totalSizeBytes: number;
  bandwidthUsedBytes: number;
  bucketBreakdown: { name: string; files: number; sizeBytes: number }[];
}

interface CDNSettings {
  enabled: boolean;
  provider: string;
  customDomain: string;
  cacheTTL: number;
  imageOptimization: boolean;
  autoWebP: boolean;
  responsiveBreakpoints: boolean;
}

interface RetentionPolicy {
  enabled: boolean;
  autoDeleteThumbnails: boolean;
  thumbnailRetentionDays: number;
  autoDeleteOrphaned: boolean;
  orphanedRetentionDays: number;
  autoDeleteOldUploads: boolean;
  uploadsRetentionDays: number;
}

interface MigrationJob {
  id: string;
  sourceGateway: string;
  targetGateway: string;
  fileCount: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startedAt: string;
  completedAt: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function DeliverySettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'gateways' | 'migration' | 'cdn' | 'cleanup'>('overview');

  const [stats, setStats] = useState<{
    sent: number;
    failed: number;
    balance: number;
    successRate: string;
  } | null>(null);
  const [gateways, setGateways] = useState<DeliveryGateway[]>([]);
  const [logs, setLogs] = useState<DeliveryLog[]>([]);

  // Cloud Storage State
  const [storageStats, setStorageStats] = useState<StorageStats>({
    totalFiles: 0,
    totalSizeBytes: 0,
    bandwidthUsedBytes: 0,
    bucketBreakdown: [],
  });
  const [cloudGateways, setCloudGateways] = useState<CloudStorageGateway[]>([
    {
      id: 'supabase-1',
      name: 'Supabase Storage',
      type: 'supabase',
      active: true,
      isDefault: true,
      config: {
        projectUrl: 'https://xxxx.supabase.co',
        anonKey: '',
        serviceKey: '',
      },
      stats: { totalFiles: 1247, totalSizeBytes: 2.4e9, bandwidthUsedBytes: 8.7e8, lastUploadAt: new Date().toISOString() },
    },
    {
      id: 'cloudinary-1',
      name: 'Cloudinary CDN',
      type: 'cloudinary',
      active: false,
      isDefault: false,
      config: {
        cloudName: '',
        apiKey: '',
        apiSecret: '',
        folder: 'studio-app',
      },
      stats: { totalFiles: 0, totalSizeBytes: 0, bandwidthUsedBytes: 0, lastUploadAt: null },
    },
    {
      id: 's3-1',
      name: 'AWS S3',
      type: 'aws_s3',
      active: false,
      isDefault: false,
      config: {
        bucketName: '',
        region: '',
        accessKeyId: '',
        secretAccessKey: '',
        endpoint: '',
      },
      stats: { totalFiles: 0, totalSizeBytes: 0, bandwidthUsedBytes: 0, lastUploadAt: null },
    },
    {
      id: 'gcs-1',
      name: 'Google Cloud Storage',
      type: 'gcs',
      active: false,
      isDefault: false,
      config: {
        bucketName: '',
        projectId: '',
        keyFilePath: '',
        endpoint: '',
      },
      stats: { totalFiles: 0, totalSizeBytes: 0, bandwidthUsedBytes: 0, lastUploadAt: null },
    },
  ]);

  const [cdnSettings, setCdnSettings] = useState<CDNSettings>({
    enabled: true,
    provider: 'supabase',
    customDomain: '',
    cacheTTL: 86400,
    imageOptimization: true,
    autoWebP: true,
    responsiveBreakpoints: true,
  });

  const [retentionPolicy, setRetentionPolicy] = useState<RetentionPolicy>({
    enabled: false,
    autoDeleteThumbnails: true,
    thumbnailRetentionDays: 30,
    autoDeleteOrphaned: true,
    orphanedRetentionDays: 7,
    autoDeleteOldUploads: false,
    uploadsRetentionDays: 365,
  });

  const [migrationJobs, setMigrationJobs] = useState<MigrationJob[]>([
    {
      id: 'mj-1',
      sourceGateway: 'supabase',
      targetGateway: 'aws_s3',
      fileCount: 2400,
      status: 'completed',
      progress: 100,
      startedAt: new Date(Date.now() - 86400000).toISOString(),
      completedAt: new Date(Date.now() - 82800000).toISOString(),
    },
  ]);

  // Modals
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editingGateway, setEditingGateway] = useState<CloudStorageGateway | null>(null);
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [showAddGateway, setShowAddGateway] = useState(false);
  const [newGatewayType, setNewGatewayType] = useState<CloudStorageGateway['type']>('cloudinary');

  // Migration form
  const [migrationSource, setMigrationSource] = useState('supabase');
  const [migrationTarget, setMigrationTarget] = useState('aws_s3');
  const [migrating, setMigrating] = useState(false);

  // New Gateway Form
  const [newGatewayName, setNewGatewayName] = useState('');
  const [newGatewayType2, setNewGatewayType2] = useState('http');
  const [newGatewayUrl, setNewGatewayUrl] = useState('');
  const [newGatewayKey, setNewGatewayKey] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const statsData = await DeliveryService.getStats();
      setStats(statsData);

      const { data: gatewaysData } = await supabase
        .from('delivery_gateways')
        .select('*')
        .order('priority', { ascending: false });
      setGateways(gatewaysData || []);

      const { data: logsData } = await supabase
        .from('delivery_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      setLogs(logsData || []);

      // Calculate storage stats from cloud gateways
      const activeGateways = cloudGateways.filter(g => g.active);
      const totalFiles = activeGateways.reduce((sum, g) => sum + g.stats.totalFiles, 0);
      const totalSize = activeGateways.reduce((sum, g) => sum + g.stats.totalSizeBytes, 0);
      const totalBandwidth = activeGateways.reduce((sum, g) => sum + g.stats.bandwidthUsedBytes, 0);
      setStorageStats({
        totalFiles,
        totalSizeBytes: totalSize,
        bandwidthUsedBytes: totalBandwidth,
        bucketBreakdown: [
          { name: 'client-photos', files: 534, sizeBytes: 1.8e9 },
          { name: 'thumbnails', files: 423, sizeBytes: 120000000 },
          { name: 'avatars', files: 89, sizeBytes: 45000000 },
          { name: 'bts-media', files: 156, sizeBytes: 380000000 },
          { name: 'brand-assets', files: 45, sizeBytes: 55000000 },
        ],
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to load delivery settings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => { setRefreshing(true); loadData(); };

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
      const config = newGatewayType2 === 'http' ? { url: newGatewayUrl, api_key: newGatewayKey } : {};
      const { error } = await supabase.from('delivery_gateways').insert({
        name: newGatewayName,
        type: newGatewayType2 as any,
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

  const toggleCloudGateway = (id: string) => {
    setCloudGateways(prev => prev.map(g => g.id === id ? { ...g, active: !g.active } : g));
  };

  const setDefaultGateway = (id: string) => {
    setCloudGateways(prev => prev.map(g => ({ ...g, isDefault: g.id === id })));
  };

  const openConfigModal = (gateway: CloudStorageGateway) => {
    setEditingGateway(gateway);
    setConfigValues({ ...gateway.config });
    setShowConfigModal(true);
  };

  const saveConfig = () => {
    if (!editingGateway) return;
    setCloudGateways(prev => prev.map(g =>
      g.id === editingGateway.id ? { ...g, config: { ...configValues } } : g
    ));
    setShowConfigModal(false);
    Alert.alert('Success', 'Configuration saved');
  };

  const startMigration = () => {
    if (migrationSource === migrationTarget) return Alert.alert('Error', 'Source and target must differ');
    const sourceGW = cloudGateways.find(g => g.type === migrationSource);
    if (!sourceGW || sourceGW.stats.totalFiles === 0) return Alert.alert('Error', 'Source has no files');

    const job: MigrationJob = {
      id: `mj-${Date.now()}`,
      sourceGateway: migrationSource,
      targetGateway: migrationTarget,
      fileCount: sourceGW.stats.totalFiles,
      status: 'running',
      progress: 0,
      startedAt: new Date().toISOString(),
      completedAt: null,
    };
    setMigrationJobs(prev => [job, ...prev]);
    setMigrating(true);

    // Simulate progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress >= 100) {
        progress = 100;
        setMigrating(false);
        setMigrationJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'completed', progress: 100, completedAt: new Date().toISOString() } : j));
        clearInterval(interval);
        Alert.alert('Migration Complete', `${job.fileCount} files migrated successfully.`);
      } else {
        setMigrationJobs(prev => prev.map(j => j.id === job.id ? { ...j, progress: Math.min(progress, 99) } : j));
      }
    }, 500);
  };

  const getGatewayIcon = (type: string) => {
    switch (type) {
      case 'supabase': return <DatabaseIcon size={20} color="#3ECF8E" />;
      case 'cloudinary': return <Cloud size={20} color="#3448C5" />;
      case 'aws_s3': return <Server size={20} color="#FF9900" />;
      case 'gcs': return <CloudRain size={20} color="#4285F4" />;
      default: return <HardDrive size={20} color={Colors.gold} />;
    }
  };

  const getGatewayColor = (type: string) => {
    switch (type) {
      case 'supabase': return '#3ECF8E';
      case 'cloudinary': return '#3448C5';
      case 'aws_s3': return '#FF9900';
      case 'gcs': return '#4285F4';
      default: return Colors.gold;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return Colors.gold;
      case 'completed': return Colors.success;
      case 'failed': return Colors.error;
      default: return Colors.textMuted;
    }
  };

  const tabs = [
    { key: 'overview' as const, label: 'Overview', icon: BarChart3 },
    { key: 'gateways' as const, label: 'Gateways', icon: HardDrive },
    { key: 'migration' as const, label: 'Migration', icon: ArrowLeftRight },
    { key: 'cdn' as const, label: 'CDN', icon: Globe },
    { key: 'cleanup' as const, label: 'Cleanup', icon: RotateCw },
  ];

  const renderTabBar = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
      {tabs.map(tab => (
        <TouchableOpacity
          key={tab.key}
          style={[styles.tab, activeTab === tab.key && styles.tabActive]}
          onPress={() => setActiveTab(tab.key)}
        >
          <tab.icon size={16} color={activeTab === tab.key ? Colors.gold : Colors.textMuted} />
          <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderOverview = () => (
    <>
      {/* Delivery Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={styles.statHeader}>
            <CreditCard size={18} color={Colors.gold} />
            <Text style={styles.statLabel}>Credits</Text>
          </View>
          <Text style={styles.statValue}>{stats?.balance?.toFixed(2) || '0.00'}</Text>
          <TouchableOpacity style={styles.goldButtonSmall} onPress={handleRefill}>
            <Text style={styles.goldButtonText}>Refill</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.statCard}>
          <View style={styles.statHeader}>
            <Activity size={18} color={Colors.success} />
            <Text style={styles.statLabel}>Success Rate</Text>
          </View>
          <Text style={styles.statValue}>{stats?.successRate || '100'}%</Text>
          <Text style={styles.statSub}>{stats?.sent || 0} sent / {stats?.failed || 0} failed</Text>
        </View>
      </View>

      {/* Storage Stats */}
      <Text style={styles.sectionTitle}>Cloud Storage</Text>
      <View style={styles.storageStatsGrid}>
        <View style={styles.storageStatCard}>
          <FileImage size={20} color={Colors.gold} />
          <Text style={styles.storageStatValue}>{storageStats.totalFiles.toLocaleString()}</Text>
          <Text style={styles.storageStatLabel}>Total Files</Text>
        </View>
        <View style={styles.storageStatCard}>
          <HardDrive size={20} color={Colors.gold} />
          <Text style={styles.storageStatValue}>{formatBytes(storageStats.totalSizeBytes)}</Text>
          <Text style={styles.storageStatLabel}>Storage Used</Text>
        </View>
        <View style={styles.storageStatCard}>
          <Globe size={20} color={Colors.gold} />
          <Text style={styles.storageStatValue}>{formatBytes(storageStats.bandwidthUsedBytes)}</Text>
          <Text style={styles.storageStatLabel}>Bandwidth</Text>
        </View>
        <View style={styles.storageStatCard}>
          <Cloud size={20} color={Colors.success} />
          <Text style={styles.storageStatValue}>{cloudGateways.filter(g => g.active).length}</Text>
          <Text style={styles.storageStatLabel}>Active Gateways</Text>
        </View>
      </View>

      {/* Bucket Breakdown */}
      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Storage Buckets</Text>
      {storageStats.bucketBreakdown.map(bucket => (
        <View key={bucket.name} style={styles.bucketRow}>
          <View style={styles.bucketInfo}>
            <DatabaseIcon size={14} color={Colors.gold} />
            <Text style={styles.bucketName}>{bucket.name}</Text>
          </View>
          <View style={styles.bucketStats}>
            <Text style={styles.bucketFiles}>{bucket.files} files</Text>
            <Text style={styles.bucketSize}>{formatBytes(bucket.sizeBytes)}</Text>
          </View>
          <View style={styles.bucketBarBg}>
            <View style={[styles.bucketBarFill, { width: `${(bucket.sizeBytes / storageStats.totalSizeBytes) * 100}%` }]} />
          </View>
        </View>
      ))}

      {/* Delivery Gateways */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Message Gateways</Text>
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
              <RefreshCw size={16} color={Colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteGateway(g.id)} style={styles.actionBtn}>
              <Trash2 size={16} color={Colors.error} />
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {/* Recent Logs */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Recent Logs</Text>
      {logs.map(log => (
        <View key={log.id} style={styles.logRow}>
          <View style={styles.logIcon}>
            {log.status === 'sent' || log.status === 'delivered' ? (
              <Check size={14} color={Colors.success} />
            ) : (
              <AlertCircle size={14} color={Colors.error} />
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
      {logs.length === 0 && <Text style={styles.emptyText}>No delivery logs found</Text>}
    </>
  );

  const renderGateways = () => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Cloud Storage Providers</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddGateway(!showAddGateway)}>
          <Plus size={18} color={Colors.gold} />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {showAddGateway && (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Add Cloud Gateway</Text>
          <View style={styles.typeGrid}>
            {[
              { type: 'cloudinary' as const, label: 'Cloudinary', color: '#3448C5' },
              { type: 'aws_s3' as const, label: 'AWS S3', color: '#FF9900' },
              { type: 'gcs' as const, label: 'Google Cloud', color: '#4285F4' },
            ].map(opt => (
              <TouchableOpacity
                key={opt.type}
                style={[styles.typeOption, newGatewayType === opt.type && { borderColor: opt.color, backgroundColor: `${opt.color}20` }]}
                onPress={() => setNewGatewayType(opt.type)}
              >
                {getGatewayIcon(opt.type)}
                <Text style={[styles.typeText, newGatewayType === opt.type && { color: opt.color }]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.input}
            placeholder="Gateway Name"
            placeholderTextColor={Colors.textMuted}
            value={newGatewayName}
            onChangeText={setNewGatewayName}
          />
          <TouchableOpacity style={styles.saveButton} onPress={() => {
            if (!newGatewayName) return Alert.alert('Error', 'Name is required');
            const gateway: CloudStorageGateway = {
              id: `${newGatewayType}-${Date.now()}`,
              name: newGatewayName,
              type: newGatewayType,
              active: false,
              isDefault: false,
              config: {},
              stats: { totalFiles: 0, totalSizeBytes: 0, bandwidthUsedBytes: 0, lastUploadAt: null },
            };
            setCloudGateways(prev => [...prev, gateway]);
            setShowAddGateway(false);
            setNewGatewayName('');
            Alert.alert('Added', `${gateway.name} added. Configure it to activate.`);
          }}>
            <Text style={styles.saveButtonText}>Add Gateway</Text>
          </TouchableOpacity>
        </View>
      )}

      {cloudGateways.map(gw => (
        <View key={gw.id} style={[styles.cloudCard, { borderLeftColor: getGatewayColor(gw.type) }]}>
          <View style={styles.cloudCardHeader}>
            <View style={styles.cloudCardLeft}>
              {getGatewayIcon(gw.type)}
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.cloudCardTitle}>{gw.name}</Text>
                <Text style={styles.cloudCardSub}>{formatBytes(gw.stats.totalSizeBytes)} • {gw.stats.totalFiles} files</Text>
              </View>
            </View>
            <View style={styles.cloudCardBadges}>
              {gw.isDefault && <View style={styles.defaultBadge}><Text style={styles.defaultBadgeText}>DEFAULT</Text></View>}
              {gw.active ? (
                <View style={styles.badgeActive}><Text style={styles.badgeText}>Active</Text></View>
              ) : (
                <View style={styles.badgeInactive}><Text style={styles.badgeText}>Inactive</Text></View>
              )}
            </View>
          </View>

          {gw.stats.lastUploadAt && (
            <View style={styles.cloudCardStats}>
              <Clock size={12} color={Colors.textMuted} />
              <Text style={styles.cloudCardStatText}>Last upload: {new Date(gw.stats.lastUploadAt).toLocaleDateString()}</Text>
              <Zap size={12} color={Colors.textMuted} />
              <Text style={styles.cloudCardStatText}>BW: {formatBytes(gw.stats.bandwidthUsedBytes)}</Text>
            </View>
          )}

          <View style={styles.cloudCardActions}>
            <TouchableOpacity style={styles.cloudAction} onPress={() => toggleCloudGateway(gw.id)}>
              <Shield size={14} color={gw.active ? Colors.success : Colors.textMuted} />
              <Text style={[styles.cloudActionText, { color: gw.active ? Colors.success : Colors.textMuted }]}>
                {gw.active ? 'Enabled' : 'Enable'}
              </Text>
            </TouchableOpacity>
            {!gw.isDefault && (
              <TouchableOpacity style={styles.cloudAction} onPress={() => setDefaultGateway(gw.id)}>
                <Star size={14} color={Colors.gold} />
                <Text style={[styles.cloudActionText, { color: Colors.gold }]}>Set Default</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.cloudAction} onPress={() => openConfigModal(gw)}>
              <Cog size={14} color={Colors.textMuted} />
              <Text style={styles.cloudActionText}>Configure</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cloudAction} onPress={() => {
              Alert.alert('Delete', `Remove ${gw.name}?`, [
                { text: 'Cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => setCloudGateways(prev => prev.filter(g => g.id !== gw.id)) }
              ]);
            }}>
              <Trash2 size={14} color={Colors.error} />
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {/* SMS Gateways Section */}
      <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Message Gateways</Text>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionSub}>HTTP / WhatsApp delivery</Text>
        <TouchableOpacity onPress={() => setShowAddGateway(!showAddGateway)}>
          <Plus size={18} color={Colors.gold} />
        </TouchableOpacity>
      </View>
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
              <RefreshCw size={16} color={Colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteGateway(g.id)} style={styles.actionBtn}>
              <Trash2 size={16} color={Colors.error} />
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </>
  );

  const renderMigration = () => (
    <>
      <View style={styles.migrationCard}>
        <Text style={styles.formTitle}>Migrate Files Between Providers</Text>
        <Text style={styles.migrationDesc}>Move all files from one storage provider to another. Useful when switching or backing up.</Text>

        <Text style={styles.inputLabel}>Source Provider</Text>
        <View style={styles.typeGrid}>
          {cloudGateways.filter(g => g.stats.totalFiles > 0).map(gw => (
            <TouchableOpacity
              key={gw.type}
              style={[styles.typeOption, migrationSource === gw.type && { borderColor: getGatewayColor(gw.type), backgroundColor: `${getGatewayColor(gw.type)}20` }]}
              onPress={() => setMigrationSource(gw.type)}
            >
              {getGatewayIcon(gw.type)}
              <Text style={[styles.typeText, migrationSource === gw.type && { color: getGatewayColor(gw.type) }]}>{gw.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.arrowContainer}>
          <ArrowRight size={20} color={Colors.gold} />
        </View>

        <Text style={styles.inputLabel}>Target Provider</Text>
        <View style={styles.typeGrid}>
          {cloudGateways.map(gw => (
            <TouchableOpacity
              key={gw.type}
              style={[styles.typeOption, migrationTarget === gw.type && { borderColor: getGatewayColor(gw.type), backgroundColor: `${getGatewayColor(gw.type)}20` }]}
              onPress={() => setMigrationTarget(gw.type)}
            >
              {getGatewayIcon(gw.type)}
              <Text style={[styles.typeText, migrationTarget === gw.type && { color: getGatewayColor(gw.type) }]}>{gw.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.saveButton, migrating && styles.saveButtonDisabled]}
          onPress={startMigration}
          disabled={migrating || migrationSource === migrationTarget}
        >
          {migrating ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={Colors.background} />
              <Text style={styles.saveButtonText}>Migrating...</Text>
            </View>
          ) : (
            <Text style={styles.saveButtonText}>Start Migration</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Migration History */}
      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Migration History</Text>
      {migrationJobs.length === 0 ? (
        <Text style={styles.emptyText}>No migrations yet</Text>
      ) : (
        migrationJobs.map(job => (
          <View key={job.id} style={styles.migrationJobCard}>
            <View style={styles.migrationJobHeader}>
              <View style={styles.migrationJobProviders}>
                <Text style={styles.migrationProviderText}>{job.sourceGateway}</Text>
                <ArrowRight size={14} color={Colors.textMuted} />
                <Text style={styles.migrationProviderText}>{job.targetGateway}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(job.status)}20` }]}>
                <Text style={[styles.statusText, { color: getStatusColor(job.status) }]}>{job.status}</Text>
              </View>
            </View>
            <View style={styles.migrationProgressBar}>
              <View style={[styles.migrationProgressFill, { width: `${job.progress}%`, backgroundColor: getStatusColor(job.status) }]} />
            </View>
            <View style={styles.migrationJobFooter}>
              <Text style={styles.migrationJobFiles}>{job.fileCount} files</Text>
              <Text style={styles.migrationJobTime}>{new Date(job.startedAt).toLocaleDateString()}</Text>
              {job.completedAt && <CheckCircle size={14} color={Colors.success} />}
            </View>
          </View>
        ))
      )}
    </>
  );

  const renderCDN = () => (
    <>
      <View style={styles.configCard}>
        <View style={styles.configRow}>
          <View style={styles.configLeft}>
            <Globe size={20} color={Colors.gold} />
            <View>
              <Text style={styles.configTitle}>Enable CDN</Text>
              <Text style={styles.configSub}>Serve images via CDN for faster delivery</Text>
            </View>
          </View>
          <Switch
            value={cdnSettings.enabled}
            onValueChange={(v) => setCdnSettings(prev => ({ ...prev, enabled: v }))}
            trackColor={{ false: Colors.cardHover, true: `${Colors.gold}40` }}
            thumbColor={cdnSettings.enabled ? Colors.gold : Colors.textMuted}
          />
        </View>

        {cdnSettings.enabled && (
          <>
            <View style={styles.configDivider} />

            <Text style={styles.inputLabel}>CDN Provider</Text>
            <View style={styles.typeGrid}>
              {[
                { key: 'supabase', label: 'Supabase CDN', icon: Database },
                { key: 'cloudinary', label: 'Cloudinary', icon: Cloud },
                { key: 'cloudflare', label: 'Cloudflare', icon: CloudRain },
                { key: 'custom', label: 'Custom', icon: Globe },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.typeOption, cdnSettings.provider === opt.key && { borderColor: Colors.gold, backgroundColor: Colors.goldMuted }]}
                  onPress={() => setCdnSettings(prev => ({ ...prev, provider: opt.key }))}
                >
                  <opt.icon size={14} color={cdnSettings.provider === opt.key ? Colors.gold : Colors.textMuted} />
                  <Text style={[styles.typeText, cdnSettings.provider === opt.key && { color: Colors.gold }]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Custom Domain (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="cdn.yourdomain.com"
              placeholderTextColor={Colors.textMuted}
              value={cdnSettings.customDomain}
              onChangeText={(v) => setCdnSettings(prev => ({ ...prev, customDomain: v }))}
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>Cache TTL (seconds)</Text>
            <TextInput
              style={styles.input}
              placeholder="86400"
              placeholderTextColor={Colors.textMuted}
              value={cdnSettings.cacheTTL.toString()}
              onChangeText={(v) => setCdnSettings(prev => ({ ...prev, cacheTTL: parseInt(v) || 0 }))}
              keyboardType="numeric"
            />
          </>
        )}
      </View>

      {cdnSettings.enabled && (
        <View style={styles.configCard}>
          <Text style={styles.formTitle}>Image Optimization</Text>
          <View style={styles.configRow}>
            <View style={styles.configLeft}>
              <Zap size={18} color={Colors.gold} />
              <View>
                <Text style={styles.configTitle}>Auto-Optimize Images</Text>
                <Text style={styles.configSub}>Compress and resize on-the-fly</Text>
              </View>
            </View>
            <Switch
              value={cdnSettings.imageOptimization}
              onValueChange={(v) => setCdnSettings(prev => ({ ...prev, imageOptimization: v }))}
              trackColor={{ false: Colors.cardHover, true: `${Colors.gold}40` }}
              thumbColor={cdnSettings.imageOptimization ? Colors.gold : Colors.textMuted}
            />
          </View>

          <View style={styles.configDivider} />

          <View style={styles.configRow}>
            <View style={styles.configLeft}>
              <Image size={18} color={Colors.gold} />
              <View>
                <Text style={styles.configTitle}>Auto WebP Conversion</Text>
                <Text style={styles.configSub}>Convert to modern formats automatically</Text>
              </View>
            </View>
            <Switch
              value={cdnSettings.autoWebP}
              onValueChange={(v) => setCdnSettings(prev => ({ ...prev, autoWebP: v }))}
              trackColor={{ false: Colors.cardHover, true: `${Colors.gold}40` }}
              thumbColor={cdnSettings.autoWebP ? Colors.gold : Colors.textMuted}
            />
          </View>

          <View style={styles.configDivider} />

          <View style={styles.configRow}>
            <View style={styles.configLeft}>
              <Smartphone size={18} color={Colors.gold} />
              <View>
                <Text style={styles.configTitle}>Responsive Breakpoints</Text>
                <Text style={styles.configSub}>Serve optimized sizes per device</Text>
              </View>
            </View>
            <Switch
              value={cdnSettings.responsiveBreakpoints}
              onValueChange={(v) => setCdnSettings(prev => ({ ...prev, responsiveBreakpoints: v }))}
              trackColor={{ false: Colors.cardHover, true: `${Colors.gold}40` }}
              thumbColor={cdnSettings.responsiveBreakpoints ? Colors.gold : Colors.textMuted}
            />
          </View>

          <TouchableOpacity style={[styles.saveButton, { marginTop: 16 }]} onPress={() => Alert.alert('Saved', 'CDN settings updated')}>
            <Text style={styles.saveButtonText}>Save CDN Settings</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  const renderCleanup = () => (
    <>
      <View style={styles.configCard}>
        <View style={styles.configRow}>
          <View style={styles.configLeft}>
            <RotateCw size={20} color={Colors.gold} />
            <View>
              <Text style={styles.configTitle}>Auto-Cleanup</Text>
              <Text style={styles.configSub}>Automatically remove old and orphaned files</Text>
            </View>
          </View>
          <Switch
            value={retentionPolicy.enabled}
            onValueChange={(v) => setRetentionPolicy(prev => ({ ...prev, enabled: v }))}
            trackColor={{ false: Colors.cardHover, true: `${Colors.gold}40` }}
            thumbColor={retentionPolicy.enabled ? Colors.gold : Colors.textMuted}
          />
        </View>
      </View>

      {retentionPolicy.enabled && (
        <>
          {/* Thumbnail Cleanup */}
          <View style={styles.configCard}>
            <View style={styles.cleanupHeader}>
              <FileImage size={18} color={Colors.gold} />
              <Text style={styles.formTitle}>Thumbnails</Text>
            </View>
            <View style={styles.configRow}>
              <View style={styles.configLeft}>
                <View>
                  <Text style={styles.configTitle}>Auto-Delete Old Thumbnails</Text>
                  <Text style={styles.configSub}>Remove thumbnails older than retention period</Text>
                </View>
              </View>
              <Switch
                value={retentionPolicy.autoDeleteThumbnails}
                onValueChange={(v) => setRetentionPolicy(prev => ({ ...prev, autoDeleteThumbnails: v }))}
                trackColor={{ false: Colors.cardHover, true: `${Colors.gold}40` }}
                thumbColor={retentionPolicy.autoDeleteThumbnails ? Colors.gold : Colors.textMuted}
              />
            </View>
            {retentionPolicy.autoDeleteThumbnails && (
              <View style={styles.retentionRow}>
                <Text style={styles.inputLabel}>Keep for (days)</Text>
                <TextInput
                  style={[styles.input, { width: 80, textAlign: 'center' }]}
                  value={retentionPolicy.thumbnailRetentionDays.toString()}
                  onChangeText={(v) => setRetentionPolicy(prev => ({ ...prev, thumbnailRetentionDays: parseInt(v) || 0 }))}
                  keyboardType="numeric"
                />
              </View>
            )}
          </View>

          {/* Orphaned Files Cleanup */}
          <View style={styles.configCard}>
            <View style={styles.cleanupHeader}>
              <AlertCircle size={18} color={Colors.warning} />
              <Text style={styles.formTitle}>Orphaned Files</Text>
            </View>
            <View style={styles.configRow}>
              <View style={styles.configLeft}>
                <View>
                  <Text style={styles.configTitle}>Auto-Delete Orphaned Files</Text>
                  <Text style={styles.configSub}>Files not referenced by any database record</Text>
                </View>
              </View>
              <Switch
                value={retentionPolicy.autoDeleteOrphaned}
                onValueChange={(v) => setRetentionPolicy(prev => ({ ...prev, autoDeleteOrphaned: v }))}
                trackColor={{ false: Colors.cardHover, true: `${Colors.gold}40` }}
                thumbColor={retentionPolicy.autoDeleteOrphaned ? Colors.gold : Colors.textMuted}
              />
            </View>
            {retentionPolicy.autoDeleteOrphaned && (
              <View style={styles.retentionRow}>
                <Text style={styles.inputLabel}>Grace period (days)</Text>
                <TextInput
                  style={[styles.input, { width: 80, textAlign: 'center' }]}
                  value={retentionPolicy.orphanedRetentionDays.toString()}
                  onChangeText={(v) => setRetentionPolicy(prev => ({ ...prev, orphanedRetentionDays: parseInt(v) || 0 }))}
                  keyboardType="numeric"
                />
              </View>
            )}
          </View>

          {/* Old Uploads Cleanup */}
          <View style={styles.configCard}>
            <View style={styles.cleanupHeader}>
              <Clock size={18} color={Colors.error} />
              <Text style={styles.formTitle}>Old Uploads</Text>
            </View>
            <View style={styles.configRow}>
              <View style={styles.configLeft}>
                <View>
                  <Text style={styles.configTitle}>Auto-Delete Old Uploads</Text>
                  <Text style={styles.configSub}>Remove client uploads after retention period</Text>
                </View>
              </View>
              <Switch
                value={retentionPolicy.autoDeleteOldUploads}
                onValueChange={(v) => setRetentionPolicy(prev => ({ ...prev, autoDeleteOldUploads: v }))}
                trackColor={{ false: Colors.cardHover, true: `${Colors.gold}40` }}
                thumbColor={retentionPolicy.autoDeleteOldUploads ? Colors.gold : Colors.textMuted}
              />
            </View>
            {retentionPolicy.autoDeleteOldUploads && (
              <View style={styles.retentionRow}>
                <Text style={styles.inputLabel}>Keep for (days)</Text>
                <TextInput
                  style={[styles.input, { width: 80, textAlign: 'center' }]}
                  value={retentionPolicy.uploadsRetentionDays.toString()}
                  onChangeText={(v) => setRetentionPolicy(prev => ({ ...prev, uploadsRetentionDays: parseInt(v) || 0 }))}
                  keyboardType="numeric"
                />
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={() => Alert.alert('Saved', 'Cleanup policies updated')}
          >
            <Text style={styles.saveButtonText}>Save Retention Policies</Text>
          </TouchableOpacity>
        </>
      )}
    </>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{
        title: 'Delivery Settings',
        headerShown: true,
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.textPrimary,
        headerRight: () => (
          <TouchableOpacity onPress={handleRefresh} style={{ marginRight: 4 }}>
            <RefreshCw size={20} color={Colors.gold} />
          </TouchableOpacity>
        ),
      }} />

      {renderTabBar()}

      {loading ? (
        <ActivityIndicator size="large" color={Colors.gold} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'gateways' && renderGateways()}
          {activeTab === 'migration' && renderMigration()}
          {activeTab === 'cdn' && renderCDN()}
          {activeTab === 'cleanup' && renderCleanup()}
        </ScrollView>
      )}

      {/* Config Modal */}
      <Modal visible={showConfigModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Configure {editingGateway?.name}</Text>
              <TouchableOpacity onPress={() => setShowConfigModal(false)}>
                <X size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {Object.entries(configValues).map(([key, value]) => (
                <View key={key} style={styles.modalField}>
                  <Text style={styles.inputLabel}>
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder={key}
                    placeholderTextColor={Colors.textMuted}
                    value={value}
                    onChangeText={(v) => setConfigValues(prev => ({ ...prev, [key]: v }))}
                    autoCapitalize="none"
                    secureTextEntry={key.toLowerCase().includes('key') || key.toLowerCase().includes('secret')}
                  />
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowConfigModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={saveConfig}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Missing Image icon - using a placeholder
const Image = ({ size, color }: { size: number; color: string }) => (
  <View style={{ width: size, height: size, borderRadius: 4, borderWidth: 1.5, borderColor: color, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ width: size * 0.4, height: size * 0.4, borderRadius: 2, backgroundColor: color }} />
  </View>
);

const Star = ({ size, color }: { size: number; color: string }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ color, fontSize: size, lineHeight: size }}>★</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
  },
  // Tab Bar
  tabBar: {
    maxHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabBarContent: {
    paddingHorizontal: 12,
    gap: 4,
    paddingVertical: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: {
    backgroundColor: Colors.goldMuted,
    borderColor: Colors.gold,
  },
  tabText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: Colors.gold,
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  statLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statValue: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
  },
  statSub: {
    color: Colors.textMuted,
    fontSize: 11,
  },
  goldButtonSmall: {
    backgroundColor: Colors.gold,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  goldButtonText: {
    color: Colors.background,
    fontSize: 11,
    fontWeight: '700',
  },
  // Storage Stats
  storageStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  storageStatCard: {
    width: '48%',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  storageStatValue: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  storageStatLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  // Bucket Breakdown
  bucketRow: {
    backgroundColor: Colors.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bucketInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  bucketName: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  bucketStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 6,
  },
  bucketFiles: {
    color: Colors.textMuted,
    fontSize: 11,
  },
  bucketSize: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  bucketBarBg: {
    height: 4,
    backgroundColor: Colors.cardHover,
    borderRadius: 2,
    overflow: 'hidden',
  },
  bucketBarFill: {
    height: '100%',
    backgroundColor: Colors.gold,
    borderRadius: 2,
  },
  // Sections
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  sectionSub: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  // Gateway Cards
  gatewayCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.card,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
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
    marginBottom: 2,
  },
  gatewayName: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  gatewayDetail: {
    color: Colors.textMuted,
    fontSize: 11,
  },
  gatewayActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    padding: 6,
  },
  // Badges
  badgeActive: {
    backgroundColor: 'rgba(46, 204, 113, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeInactive: {
    backgroundColor: 'rgba(102, 102, 102, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textPrimary,
    textTransform: 'uppercase',
  },
  // Cloud Gateway Cards
  cloudCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 3,
  },
  cloudCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cloudCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cloudCardTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  cloudCardSub: {
    color: Colors.textMuted,
    fontSize: 11,
  },
  cloudCardBadges: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  defaultBadge: {
    backgroundColor: `${Colors.gold}20`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.gold,
  },
  cloudCardStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  cloudCardStatText: {
    color: Colors.textMuted,
    fontSize: 11,
    marginRight: 8,
  },
  cloudCardActions: {
    flexDirection: 'row',
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
  },
  cloudAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.cardHover,
  },
  cloudActionText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.goldMuted,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.gold,
  },
  addBtnText: {
    color: Colors.gold,
    fontSize: 12,
    fontWeight: '700',
  },
  // Form
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
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderRadius: 8,
    padding: 12,
    color: Colors.textPrimary,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    fontSize: 13,
  },
  inputLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 4,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardHover,
  },
  typeText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: Colors.gold,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: Colors.background,
    fontWeight: '700',
    fontSize: 13,
  },
  // Migration
  migrationCard: {
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  migrationDesc: {
    color: Colors.textMuted,
    fontSize: 12,
    marginBottom: 16,
    lineHeight: 18,
  },
  arrowContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  migrationJobCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  migrationJobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  migrationJobProviders: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  migrationProviderText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  migrationProgressBar: {
    height: 4,
    backgroundColor: Colors.cardHover,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  migrationProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  migrationJobFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  migrationJobFiles: {
    color: Colors.textMuted,
    fontSize: 11,
  },
  migrationJobTime: {
    color: Colors.textMuted,
    fontSize: 11,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Config
  configCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  configLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  configTitle: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  configSub: {
    color: Colors.textMuted,
    fontSize: 11,
  },
  configDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
  },
  // Cleanup
  cleanupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  retentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  // Logs
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  logIcon: {
    width: 28,
    alignItems: 'center',
  },
  logContent: {
    flex: 1,
  },
  logRecipient: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  logTime: {
    color: Colors.textMuted,
    fontSize: 11,
  },
  logMeta: {
    alignItems: 'flex-end',
  },
  logMethod: {
    color: Colors.textMuted,
    fontSize: 9,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  logStatus: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  emptyText: {
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 20,
    fontSize: 13,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  modalBody: {
    padding: 16,
    maxHeight: 400,
  },
  modalField: {
    marginBottom: 12,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: Colors.cardHover,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelButtonText: {
    color: Colors.textMuted,
    fontWeight: '700',
    fontSize: 13,
  },
});
