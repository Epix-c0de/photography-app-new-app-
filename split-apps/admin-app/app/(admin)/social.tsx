import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  RefreshControl,
  Linking,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Instagram,
  Facebook,
  Unlink,
  ExternalLink,
  Loader2,
  CheckCircle,
  Share2,
  Clock,
  ToggleLeft,
  ToggleRight,
  Eye,
  ChevronRight,
  AlertCircle,
  Zap,
  Globe,
  Link2,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import Colors from '@/constants/colors';
import { supabase, supabaseUrl } from '@/lib/supabase';
import SettingsHeader from '@/components/SettingsHeader';

interface SocialConnection {
  id: string;
  platform: 'instagram' | 'facebook' | 'tiktok';
  profile_id: string;
  profile_name: string;
  profile_url: string;
  access_token: string;
  is_active: boolean;
  token_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

interface SocialShare {
  id: string;
  platform: string;
  post_url: string | null;
  caption: string | null;
  status: 'pending' | 'posted' | 'failed';
  error_message: string | null;
  posted_at: string | null;
  created_at: string;
  gallery_id: string | null;
  bts_id: string | null;
}

interface AutoPostSettings {
  galleries: boolean;
  bts_posts: boolean;
}

type Platform = 'instagram' | 'facebook' | 'tiktok';

const PLATFORMS: { key: Platform; label: string; color: string; icon: typeof Instagram }[] = [
  { key: 'instagram', label: 'Instagram', color: '#E4405F', icon: Instagram },
  { key: 'facebook', label: 'Facebook', color: '#1877F2', icon: Facebook },
  { key: 'tiktok', label: 'TikTok', color: '#00F2EA', icon: Globe },
];

const formatTimeAgo = (dateStr: string) => {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
};

export default function SocialScreen() {
  const insets = useSafeAreaInsets();
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [shares, setShares] = useState<SocialShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<Platform | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'accounts' | 'history'>('accounts');
  const [autoPost, setAutoPost] = useState<AutoPostSettings>({ galleries: false, bts_posts: false });
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [shareModal, setShareModal] = useState<{ galleryId: string; galleryLink: string } | null>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (shareModal) {
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        damping: 15,
      }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [shareModal]);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [connectionsRes, sharesRes] = await Promise.all([
      supabase
        .from('social_connections')
        .select('*')
        .eq('photographer_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('social_shares')
        .select('*')
        .eq('photographer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    setConnections(connectionsRes.data || []);
    setShares(sharesRes.data || []);
    setLoading(false);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const getConnection = (platform: Platform) =>
    connections.find(c => c.platform === platform && c.is_active);

  const isConnected = (platform: Platform) => !!getConnection(platform);

  const handleConnect = async (platform: Platform) => {
    if (isConnected(platform)) {
      Alert.alert('Already Connected', `${PLATFORMS.find(p => p.key === platform)?.label} is already connected.`);
      return;
    }

    setConnecting(platform);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert('Error', 'Please log in again.');
        setConnecting(null);
        return;
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/social-connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ platform }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      const result = await WebBrowser.openAuthSessionAsync(data.url, 'epixvisuals://social-callback');

      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const success = url.searchParams.get('success');
        const errorParam = url.searchParams.get('error');

        if (success === 'true') {
          Alert.alert('Connected!', `${PLATFORMS.find(p => p.key === platform)?.label} has been connected successfully.`);
        } else if (errorParam === 'no_ig_account') {
          Alert.alert('No Instagram Account', 'No Instagram Business account found. Please ensure you have an Instagram Business or Creator account linked to your Facebook Page.');
        } else if (errorParam === 'no_fb_page') {
          Alert.alert('No Facebook Page', 'No Facebook Page found. Please create a Facebook Page and link it to your account.');
        } else if (errorParam) {
          Alert.alert('Connection Failed', `Error: ${errorParam}`);
        }
      } else if (result.type === 'cancel') {
        // User cancelled, no action needed
      }

      await loadData();
    } catch (err: any) {
      Alert.alert('Connection Failed', err.message || 'Something went wrong. Please try again.');
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = (platform: Platform) => {
    const conn = getConnection(platform);
    if (!conn) return;

    const platformLabel = PLATFORMS.find(p => p.key === platform)?.label || platform;
    Alert.alert(
      `Disconnect ${platformLabel}?`,
      `Your ${platformLabel} account will be disconnected. You can reconnect anytime.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await supabase
              .from('social_connections')
              .update({ is_active: false })
              .eq('id', conn.id);

            Alert.alert('Disconnected', `${platformLabel} has been disconnected.`);
            await loadData();
          },
        },
      ]
    );
  };

  const handleRefreshToken = async (platform: Platform) => {
    const conn = getConnection(platform);
    if (!conn) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${supabaseUrl}/functions/v1/social-connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ platform, reconnect: true }),
      });

      const data = await response.json();
      if (response.ok && data.url) {
        await WebBrowser.openAuthSessionAsync(data.url, 'epixvisuals://social-callback');
        await loadData();
      }
    } catch {
      // Silent fail
    }
  };

  const toggleAutoPost = (key: keyof AutoPostSettings) => {
    setAutoPost(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleShareGallery = async (platform: Platform, galleryLink: string) => {
    const conn = getConnection(platform);
    if (!conn) {
      Alert.alert('Not Connected', `Please connect your ${PLATFORMS.find(p => p.key === platform)?.label} account first.`);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      let functionName = 'share-instagram';
      if (platform === 'facebook') functionName = 'share-facebook';
      if (platform === 'tiktok') functionName = 'share-tiktok';

      const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          image_url: galleryLink,
          caption: 'Check out this gallery! #EpixVisuals #Photography',
          gallery_id: shareModal?.galleryId,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        Alert.alert('Shared!', data.message || `Gallery shared to ${PLATFORMS.find(p => p.key === platform)?.label}!`);
        setShareModal(null);
        await loadData();
      } else {
        Alert.alert('Share Failed', data.error || 'Something went wrong.');
      }
    } catch {
      Alert.alert('Share Failed', 'Could not share. Please try again.');
    }
  };

  const copyLink = async (url: string) => {
    try {
      const Clipboard = await import('expo-clipboard');
      await Clipboard.setStringAsync(url);
      setCopiedLink(url);
      setTimeout(() => setCopiedLink(null), 2000);
    } catch {
      // Fallback: try to open in browser
      Linking.openURL(url);
    }
  };

  const renderPlatformCard = (platform: Platform) => {
    const config = PLATFORMS.find(p => p.key === platform)!;
    const conn = getConnection(platform);
    const connected = !!conn;
    const Icon = config.icon;
    const tokenExpired = conn?.token_expires_at && new Date(conn.token_expires_at) < new Date();

    return (
      <View
        key={platform}
        style={[styles.platformCard, connected && styles.platformCardActive]}
      >
        <View style={styles.platformHeader}>
          <View style={[styles.platformIconWrap, { borderColor: connected ? config.color + '40' : 'rgba(255,255,255,0.1)' }]}>
            <Icon size={24} color={connected ? config.color : 'rgba(255,255,255,0.3)'} />
          </View>
          <View style={styles.platformInfo}>
            <Text style={styles.platformName}>{config.label}</Text>
            <View style={styles.statusRow}>
              {connected ? (
                <CheckCircle size={13} color={config.color} />
              ) : (
                <AlertCircle size={13} color="rgba(255,255,255,0.3)" />
              )}
              <Text style={[styles.platformStatus, connected && { color: config.color }]}>
                {connected ? conn!.profile_name || 'Connected' : 'Not connected'}
              </Text>
              {tokenExpired && (
                <View style={styles.expiredBadge}>
                  <Text style={styles.expiredBadgeText}>Token expired</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {connected ? (
          <View style={styles.connectedInfo}>
            <Text style={styles.connectedDesc}>
              {conn!.profile_url ? `@${conn!.profile_name}` : 'Connected'}
            </Text>
            <Text style={styles.connectedSince}>
              Connected {formatTimeAgo(conn!.created_at)}
            </Text>

            {tokenExpired && (
              <Pressable style={styles.refreshBtn} onPress={() => handleRefreshToken(platform)}>
                <RefreshCw size={14} color={config.color} />
                <Text style={[styles.refreshBtnText, { color: config.color }]}>Refresh Token</Text>
              </Pressable>
            )}

            <Pressable style={styles.disconnectBtn} onPress={() => handleDisconnect(platform)}>
              <Unlink size={15} color="#E74C3C" />
              <Text style={styles.disconnectBtnText}>Disconnect</Text>
            </Pressable>
          </View>
        ) : (
          <View>
            <Text style={styles.platformDesc}>
              {platform === 'instagram' && 'Share photos directly to your Instagram feed via Facebook'}
              {platform === 'facebook' && 'Share photos to your Facebook business page'}
              {platform === 'tiktok' && 'Post videos and content to your TikTok profile'}
            </Text>
            <Pressable
              style={[styles.connectBtn, { backgroundColor: config.color }]}
              onPress={() => handleConnect(platform)}
              disabled={connecting === platform}
            >
              {connecting === platform ? (
                <Loader2 size={16} color="#FFF" style={{ transform: [{ rotate: '0deg' }] }} />
              ) : (
                <ExternalLink size={16} color="#FFF" />
              )}
              <Text style={styles.connectBtnText}>
                {connecting === platform ? 'Connecting...' : `Connect ${config.label}`}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  const renderShareHistoryItem = (share: SocialShare) => {
    const platformConfig = PLATFORMS.find(p => p.key === share.platform);
    const Icon = platformConfig?.icon || Globe;
    const color = platformConfig?.color || Colors.textMuted;

    return (
      <View key={share.id} style={styles.historyItem}>
        <View style={styles.historyIcon}>
          <Icon size={16} color={color} />
        </View>
        <View style={styles.historyContent}>
          <View style={styles.historyTop}>
            <Text style={styles.historyPlatform}>
              {platformConfig?.label || share.platform}
            </Text>
            <View style={[
              styles.statusBadge,
              share.status === 'posted' && styles.statusBadgeSuccess,
              share.status === 'failed' && styles.statusBadgeFailed,
            ]}>
              {share.status === 'posted' ? (
                <CheckCircle size={10} color="#2ECC71" />
              ) : share.status === 'failed' ? (
                <AlertCircle size={10} color="#E74C3C" />
              ) : (
                <Clock size={10} color={Colors.gold} />
              )}
              <Text style={[
                styles.statusText,
                share.status === 'posted' && styles.statusTextSuccess,
                share.status === 'failed' && styles.statusTextFailed,
              ]}>
                {share.status.charAt(0).toUpperCase() + share.status.slice(1)}
              </Text>
            </View>
          </View>
          {share.caption && (
            <Text style={styles.historyCaption} numberOfLines={1}>{share.caption}</Text>
          )}
          {share.error_message && (
            <Text style={styles.historyError} numberOfLines={1}>{share.error_message}</Text>
          )}
          <View style={styles.historyBottom}>
            <Text style={styles.historyTime}>
              {share.posted_at ? formatTimeAgo(share.posted_at) : formatTimeAgo(share.created_at)}
            </Text>
            {share.post_url && (
              <View style={styles.historyActions}>
                <Pressable onPress={() => copyLink(share.post_url!)}>
                  {copiedLink === share.post_url ? (
                    <Check size={13} color="#2ECC71" />
                  ) : (
                    <Copy size={13} color={Colors.textMuted} />
                  )}
                </Pressable>
                <Pressable onPress={() => Linking.openURL(share.post_url!)}>
                  <ExternalLink size={13} color={Colors.textMuted} />
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderShareSheet = () => {
    if (!shareModal) return null;

    return (
      <Animated.View
        style={[
          styles.shareOverlay,
          { opacity: slideAnim },
        ]}
      >
        <Pressable style={styles.shareOverlayBackdrop} onPress={() => setShareModal(null)} />
        <Animated.View
          style={[
            styles.shareSheet,
            {
              transform: [{
                translateY: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [400, 0],
                }),
              }],
            },
          ]}
        >
          <View style={styles.shareSheetHandle} />
          <Text style={styles.shareSheetTitle}>Share Gallery</Text>
          <Text style={styles.shareSheetSubtitle}>Choose a platform to share this gallery</Text>

          {PLATFORMS.map(p => {
            const connected = isConnected(p.key);
            const Icon = p.icon;
            return (
              <Pressable
                key={p.key}
                style={[styles.shareSheetPlatform, !connected && styles.shareSheetPlatformDisabled]}
                onPress={() => {
                  if (connected) {
                    handleShareGallery(p.key, shareModal.galleryLink);
                  } else {
                    setShareModal(null);
                    handleConnect(p.key);
                  }
                }}
              >
                <View style={[styles.shareSheetPlatformIcon, { borderColor: p.color + '40' }]}>
                  <Icon size={22} color={connected ? p.color : 'rgba(255,255,255,0.3)'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.shareSheetPlatformName, !connected && { color: 'rgba(255,255,255,0.3)' }]}>
                    {p.label}
                  </Text>
                  <Text style={styles.shareSheetPlatformStatus}>
                    {connected ? 'Ready to share' : 'Not connected'}
                  </Text>
                </View>
                <ChevronRight size={18} color={connected ? p.color : 'rgba(255,255,255,0.15)'} />
              </Pressable>
            );
          })}

          <Pressable
            style={styles.shareSheetCopyBtn}
            onPress={() => copyLink(shareModal.galleryLink)}
          >
            <Link2 size={16} color={Colors.gold} />
            <Text style={styles.shareSheetCopyBtnText}>
              {copiedLink === shareModal.galleryLink ? 'Copied!' : 'Copy Gallery Link'}
            </Text>
          </Pressable>

          <Pressable style={styles.shareSheetCancelBtn} onPress={() => setShareModal(null)}>
            <Text style={styles.shareSheetCancelText}>Cancel</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Loader2 size={28} color={Colors.gold} />
      </View>
    );
  }

  const connectedCount = connections.filter(c => c.is_active).length;

  return (
    <View style={styles.container}>
      <SettingsHeader title="Social Media" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
      >
        {/* Stats Bar */}
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Globe size={16} color={Colors.gold} />
            <Text style={styles.statValue}>{connectedCount}</Text>
            <Text style={styles.statLabel}>Connected</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Share2 size={16} color={Colors.gold} />
            <Text style={styles.statValue}>{shares.filter(s => s.status === 'posted').length}</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <CheckCircle size={16} color="#2ECC71" />
            <Text style={styles.statValue}>{connectedCount > 0 ? 'ON' : 'OFF'}</Text>
            <Text style={styles.statLabel}>Auto-Post</Text>
          </View>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabSwitcher}>
          <Pressable
            style={[styles.tabBtn, activeTab === 'accounts' && styles.tabBtnActive]}
            onPress={() => setActiveTab('accounts')}
          >
            <Globe size={15} color={activeTab === 'accounts' ? Colors.gold : Colors.textMuted} />
            <Text style={[styles.tabBtnText, activeTab === 'accounts' && styles.tabBtnTextActive]}>
              Accounts
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabBtn, activeTab === 'history' && styles.tabBtnActive]}
            onPress={() => setActiveTab('history')}
          >
            <Clock size={15} color={activeTab === 'history' ? Colors.gold : Colors.textMuted} />
            <Text style={[styles.tabBtnText, activeTab === 'history' && styles.tabBtnTextActive]}>
              History
            </Text>
            {shares.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{shares.length}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {activeTab === 'accounts' ? (
          <>
            {/* Platform Cards */}
            <Text style={styles.sectionTitle}>Connected Accounts</Text>
            {PLATFORMS.map(p => renderPlatformCard(p.key))}

            {/* Auto-Post Settings */}
            <Text style={styles.sectionTitle}>Auto-Post Settings</Text>
            <View style={styles.autoPostCard}>
              <View style={styles.autoPostItem}>
                <View style={styles.autoPostLeft}>
                  <Zap size={18} color={Colors.gold} />
                  <View>
                    <Text style={styles.autoPostLabel}>New Galleries</Text>
                    <Text style={styles.autoPostDesc}>Auto-share when galleries are published</Text>
                  </View>
                </View>
                <Pressable onPress={() => toggleAutoPost('galleries')}>
                  {autoPost.galleries ? (
                    <ToggleRight size={32} color={Colors.gold} />
                  ) : (
                    <ToggleLeft size={32} color={Colors.textMuted} />
                  )}
                </Pressable>
              </View>

              <View style={styles.autoPostDivider} />

              <View style={styles.autoPostItem}>
                <View style={styles.autoPostLeft}>
                  <Eye size={18} color={Colors.gold} />
                  <View>
                    <Text style={styles.autoPostLabel}>BTS Posts</Text>
                    <Text style={styles.autoPostDesc}>Auto-share behind-the-scenes content</Text>
                  </View>
                </View>
                <Pressable onPress={() => toggleAutoPost('bts_posts')}>
                  {autoPost.bts_posts ? (
                    <ToggleRight size={32} color={Colors.gold} />
                  ) : (
                    <ToggleLeft size={32} color={Colors.textMuted} />
                  )}
                </Pressable>
              </View>
            </View>

            {/* Info */}
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>How It Works</Text>
              <Text style={styles.infoText}>
                • Connect your accounts via OAuth (secure login){'\n'}
                • Instagram requires a Facebook Business Page{'\n'}
                • Share photos and videos directly to your feeds{'\n'}
                • Auto-post settings apply to new content{'\n'}
                • Tokens refresh automatically{'\n'}
                • Disconnect anytime without affecting your accounts
              </Text>
            </View>
          </>
        ) : (
          <>
            {/* Share History */}
            <Text style={styles.sectionTitle}>Recent Shares</Text>
            {shares.length === 0 ? (
              <View style={styles.emptyState}>
                <Share2 size={40} color="rgba(255,255,255,0.1)" />
                <Text style={styles.emptyTitle}>No Shares Yet</Text>
                <Text style={styles.emptyDesc}>
                  Connect your social accounts and share galleries to see your post history here.
                </Text>
              </View>
            ) : (
              <View style={styles.historyList}>
                {shares.map(s => renderShareHistoryItem(s))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {renderShareSheet()}
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
  },
  // Stats Bar
  statsBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.white,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  // Tab Switcher
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: 'rgba(212,175,55,0.1)',
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  tabBtnTextActive: {
    color: Colors.gold,
  },
  tabBadge: {
    backgroundColor: Colors.gold,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.background,
  },
  // Section Title
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  // Platform Card
  platformCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
  },
  platformCardActive: {
    borderColor: 'rgba(212,175,55,0.25)',
    backgroundColor: 'rgba(212,175,55,0.04)',
  },
  platformHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  platformIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformInfo: {
    flex: 1,
  },
  platformName: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.white,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  platformStatus: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  expiredBadge: {
    backgroundColor: 'rgba(243,156,18,0.15)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 4,
  },
  expiredBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#F39C12',
  },
  connectedInfo: {
    paddingTop: 4,
  },
  connectedDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 4,
  },
  connectedSince: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 12,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  refreshBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  platformDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 14,
    lineHeight: 19,
  },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 14,
  },
  connectBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  disconnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(231,76,60,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(231,76,60,0.2)',
    borderRadius: 10,
    padding: 12,
  },
  disconnectBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E74C3C',
  },
  // Auto-Post
  autoPostCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  autoPostItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  autoPostLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  autoPostLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
  autoPostDesc: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  autoPostDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 14,
  },
  // Info
  infoCard: {
    backgroundColor: 'rgba(212,175,55,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.15)',
    borderRadius: 16,
    padding: 18,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.gold,
    marginBottom: 10,
  },
  infoText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 21,
  },
  // History
  historyList: {
    gap: 8,
  },
  historyItem: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  historyContent: {
    flex: 1,
    gap: 4,
  },
  historyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyPlatform: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeSuccess: {
    backgroundColor: 'rgba(46,204,113,0.1)',
  },
  statusBadgeFailed: {
    backgroundColor: 'rgba(231,76,60,0.1)',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  statusTextSuccess: {
    color: '#2ECC71',
  },
  statusTextFailed: {
    color: '#E74C3C',
  },
  historyCaption: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  historyError: {
    fontSize: 11,
    color: '#E74C3C',
    fontStyle: 'italic',
  },
  historyBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  historyTime: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  historyActions: {
    flexDirection: 'row',
    gap: 10,
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 50,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
  },
  emptyDesc: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 280,
  },
  // Share Sheet
  shareOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    justifyContent: 'flex-end',
  },
  shareOverlayBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  shareSheet: {
    backgroundColor: Colors.cardDark,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  shareSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  shareSheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 4,
  },
  shareSheetSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 20,
  },
  shareSheetPlatform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  shareSheetPlatformDisabled: {
    opacity: 0.5,
  },
  shareSheetPlatformIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareSheetPlatformName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
  shareSheetPlatformStatus: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  shareSheetCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  shareSheetCopyBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gold,
  },
  shareSheetCancelBtn: {
    alignItems: 'center',
    padding: 14,
    marginTop: 8,
  },
  shareSheetCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textMuted,
  },
});
