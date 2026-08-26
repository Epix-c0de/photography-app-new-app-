import { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Link as LinkIcon, Lock, Download, Eye, Share2, Copy, Trash2, Calendar, Clock, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import ShareGalleryModal from '@/components/ShareGalleryModal';

interface GalleryShare {
  id: string;
  gallery_id: string;
  share_token: string;
  password_hash: string | null;
  require_password: boolean;
  allow_downloads: boolean;
  allow_reshare: boolean;
  allow_photo_sharing: boolean;
  expires_at: string | null;
  max_views: number | null;
  gallery_display_name: string;
  gallery_description: string | null;
  theme: string;
  layout: string;
  enable_watermark: boolean;
  watermark_text: string | null;
  watermark_position: string | null;
  watermark_opacity: number | null;
  created_at: string;
  created_by: string;
  view_count: number;
  status: 'active' | 'expired' | 'revoked';
  gallery?: {
    name: string;
    cover_photo_url: string | null;
  };
}

function truncateToken(token: string): string {
  if (token.length <= 12) return token;
  return `${token.slice(0, 12)}...`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return '#10B981';
    case 'expired':
      return '#F59E0B';
    case 'revoked':
      return '#EF4444';
    default:
      return Colors.textMuted;
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SharedLinksScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [shares, setShares] = useState<GalleryShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingShare, setEditingShare] = useState<GalleryShare | null>(null);

  const fetchShares = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('gallery_shares')
        .select('*, gallery:galleries(name, cover_photo_url)')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching shares:', error);
        return;
      }

      const processedShares = (data || []).map((share: any) => {
        let status: 'active' | 'expired' | 'revoked' = 'active';
        if (share.status === 'revoked') {
          status = 'revoked';
        } else if (share.expires_at && new Date(share.expires_at) < new Date()) {
          status = 'expired';
        }
        return { ...share, status };
      });

      setShares(processedShares);
    } catch (error) {
      console.error('Failed to fetch shares:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchShares();
  }, [fetchShares]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchShares();
  }, [fetchShares]);

  const handleCopyLink = useCallback(async (shareToken: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const url = `https://epix-visuals.vercel.app/gallery/${shareToken}`;
    await Clipboard.setStringAsync(url);
    Alert.alert('Copied', 'Link copied to clipboard');
  }, []);

  const handleShareLink = useCallback(async (share: GalleryShare) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        const url = `https://epix-visuals.vercel.app/gallery/${share.share_token}`;
        await Sharing.shareAsync(url, {
          dialogTitle: `Share ${share.gallery_display_name}`,
          mimeType: 'text/plain',
        });
      } else {
        Alert.alert('Share', 'Sharing is not available on this device.');
      }
    } catch (error) {
      console.error('Share error:', error);
    }
  }, []);

  const handleEdit = useCallback((share: GalleryShare) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingShare(share);
    setEditModalVisible(true);
  }, []);

  const handleRevoke = useCallback((share: GalleryShare) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Revoke Share Link',
      `Are you sure you want to revoke the share link for "${share.gallery_display_name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('gallery_shares')
                .update({ status: 'revoked' })
                .eq('id', share.id);

              if (error) {
                console.error('Error revoking share:', error);
                Alert.alert('Error', 'Failed to revoke share link. Please try again.');
                return;
              }

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setShares((prev) =>
                prev.map((s) => (s.id === share.id ? { ...s, status: 'revoked' as const } : s))
              );
            } catch (error) {
              console.error('Revoke error:', error);
              Alert.alert('Error', 'An unexpected error occurred.');
            }
          },
        },
      ]
    );
  }, []);

  const renderShareCard = (share: GalleryShare) => {
    const statusColor = getStatusColor(share.status);

    return (
      <View key={share.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {share.gallery_display_name || 'Untitled Gallery'}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {share.status.charAt(0).toUpperCase() + share.status.slice(1)}
              </Text>
            </View>
          </View>
          <View style={styles.tokenRow}>
            <LinkIcon size={14} color={Colors.textMuted} />
            <Text style={styles.tokenText}>{truncateToken(share.share_token)}</Text>
          </View>
        </View>

        <View style={styles.cardMeta}>
          {share.require_password && (
            <View style={styles.metaItem}>
              <Lock size={14} color={Colors.gold} />
              <Text style={styles.metaText}>Password</Text>
            </View>
          )}
          {share.allow_downloads && (
            <View style={styles.metaItem}>
              <Download size={14} color={Colors.gold} />
              <Text style={styles.metaText}>Downloads</Text>
            </View>
          )}
          <View style={styles.metaItem}>
            <Eye size={14} color={Colors.textMuted} />
            <Text style={styles.metaText}>{share.view_count || 0} views</Text>
          </View>
        </View>

        <View style={styles.cardDates}>
          <View style={styles.dateItem}>
            <Calendar size={12} color={Colors.textMuted} />
            <Text style={styles.dateText}>Created {formatDate(share.created_at)}</Text>
          </View>
          <View style={styles.dateItem}>
            <Clock size={12} color={Colors.textMuted} />
            <Text style={styles.dateText}>
              {share.expires_at ? `Expires ${formatDate(share.expires_at)}` : 'Never expires'}
            </Text>
          </View>
        </View>

        <View style={styles.cardActions}>
          <Pressable
            style={styles.actionButton}
            onPress={() => handleCopyLink(share.share_token)}
          >
            <Copy size={16} color={Colors.gold} />
            <Text style={styles.actionButtonText}>Copy Link</Text>
          </Pressable>
          <Pressable
            style={styles.actionButton}
            onPress={() => handleShareLink(share)}
          >
            <Share2 size={16} color={Colors.gold} />
            <Text style={styles.actionButtonText}>Share</Text>
          </Pressable>
          <Pressable
            style={styles.actionButton}
            onPress={() => handleEdit(share)}
          >
            <LinkIcon size={16} color={Colors.gold} />
            <Text style={styles.actionButtonText}>Edit</Text>
          </Pressable>
          <Pressable
            style={[styles.actionButton, share.status === 'revoked' && styles.actionButtonDisabled]}
            onPress={() => handleRevoke(share)}
            disabled={share.status === 'revoked'}
          >
            <Trash2 size={16} color={share.status === 'revoked' ? Colors.textMuted : '#EF4444'} />
            <Text style={[styles.actionButtonText, share.status === 'revoked' && { color: Colors.textMuted }]}>
              Revoke
            </Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const activeShares = shares.filter((s) => s.status === 'active').length;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={20}>
          <ArrowLeft size={24} color={Colors.gold} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Shared Links</Text>
          <Text style={styles.headerSubtitle}>{activeShares} active share{activeShares !== 1 ? 's' : ''}</Text>
        </View>
        <View style={styles.headerPlaceholder} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.gold} />
        </View>
      ) : shares.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <LinkIcon size={40} color={Colors.gold} />
          </View>
          <Text style={styles.emptyTitle}>No shared links yet</Text>
          <Text style={styles.emptyDesc}>
            Share your first gallery to get started
          </Text>
          <Pressable
            style={styles.emptyButton}
            onPress={() => router.push('/(tabs)/gallery')}
          >
            <Text style={styles.emptyButtonText}>Share a Gallery</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />
          }
        >
          {shares.map(renderShareCard)}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}

      {editingShare && (
        <ShareGalleryModal
          visible={editModalVisible}
          onClose={() => {
            setEditModalVisible(false);
            setEditingShare(null);
          }}
          galleryId={editingShare.gallery_id}
          galleryName={editingShare.gallery_display_name || ''}
          photoCount={0}
          onShareCreated={() => {
            setEditModalVisible(false);
            setEditingShare(null);
            fetchShares();
          }}
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
  header: {
    backgroundColor: Colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 50,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.white,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  headerPlaceholder: {
    minWidth: 50,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    marginBottom: 12,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tokenText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  cardDates: {
    gap: 6,
    marginBottom: 12,
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    paddingVertical: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  actionButtonDisabled: {
    opacity: 0.4,
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.gold,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(212,175,55,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: Colors.gold,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.background,
  },
  bottomSpacer: {
    height: 20,
  },
});
