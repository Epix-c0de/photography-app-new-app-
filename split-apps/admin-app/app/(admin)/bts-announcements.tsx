import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform, SectionList, Linking, Share, Animated } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Video, ResizeMode } from 'expo-av';
import { Camera, X, Sparkles, Image as ImageIcon, Megaphone, ChevronRight, BarChart2, Heart, MessageCircle, Eye, Share2, Layers, Crown, Music, Calendar, Clock, Globe, Lock, Shield } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { AdminService } from '@/services/admin';
import { compressImage, generateThumbnail } from '@/lib/image-utils';
import type { Database } from '@/types/supabase';

type BTSPost = Database['public']['Tables']['bts_posts']['Row'];
type AnnouncementRow = Database['public']['Tables']['announcements']['Row'];
type PortfolioItem = Database['public']['Tables']['portfolio_items']['Row'];
type BTSCategory = 'Wedding' | 'Portrait' | 'Corporate' | 'Event' | 'Portfolio' | 'Other';

type SectionItem = BTSPost | AnnouncementRow | PortfolioItem;
type SectionData = { title: string; data: SectionItem[]; type: 'bts' | 'announcement' | 'portfolio' };

const CATEGORIES: BTSCategory[] = ['Wedding', 'Portrait', 'Corporate', 'Event', 'Portfolio', 'Other'];
const AUDIENCE_OPTIONS = ['Wedding Clients', 'Event Clients', 'Repeat Customers'];

function inferMediaType(asset: ImagePicker.ImagePickerAsset): 'image' | 'video' {
  if (asset.type === 'video') return 'video';
  return 'image';
}

function getFileExtension(asset: ImagePicker.ImagePickerAsset): string {
  const uriExt = asset.uri.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase();
  if (uriExt && uriExt.length <= 6) return uriExt;
  const mime = asset.mimeType?.toLowerCase() ?? '';
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('mov')) return 'mov';
  return asset.type === 'video' ? 'mp4' : 'jpg';
}

function daysToExpiryIso(days: number) {
  const clamped = Number.isFinite(days) ? Math.max(1, Math.min(365, days)) : 7;
  return new Date(Date.now() + clamped * 24 * 60 * 60 * 1000).toISOString();
}

async function generateVideoThumbnail(videoUri: string): Promise<string | null> {
  try {
    console.log('[Video Thumbnail] Thumbnail generation not available - using video directly');
    return null;
  } catch (error) {
    console.error('[Video Thumbnail] Failed to generate thumbnail:', error);
    return null;
  }
}

async function uploadVideoThumbnail(thumbnailUri: string, baseFileName: string): Promise<string | null> {
  try {
    console.log('[Video Thumbnail] Uploading thumbnail...');
    const response = await fetch(thumbnailUri);
    const blob = await response.blob();
    const thumbnailFileName = `${baseFileName}_thumbnail.jpg`;
    const thumbnailPath = `thumbnails/${thumbnailFileName}`;
    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(thumbnailPath, blob, { contentType: 'image/jpeg', upsert: true });
    if (uploadError) {
      console.error('[Video Thumbnail] Upload failed:', uploadError);
      throw uploadError;
    }
    const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(thumbnailPath);
    console.log('[Video Thumbnail] Uploaded successfully:', publicUrl);
    return publicUrl;
  } catch (error) {
    console.error('[Video Thumbnail] Upload error:', error);
    return null;
  }
}

type ContentType = 'bts' | 'announcement' | 'portfolio';

export default function AdminBtsAnnouncementsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, verifyAdminGuard } = useAuth();

  const [contentType, setContentType] = useState<ContentType>('bts');
  const [accessReady, setAccessReady] = useState(false);
  const [posting, setPosting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string>('');

  const handleReferral = useCallback(async () => {
    if (!user) return;
    const referralCode = user.id.substring(0, 8).toUpperCase();
    const url = `https://studio.epix.co/share/${referralCode}`;
    const message = `Check out our studio! View portfolio and book here: ${url}`;
    try {
      await Share.share({ message, url, title: 'Share Studio Link' });
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  }, [user]);

  // BTS Form State
  const [btsPicked, setBtsPicked] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [btsTitle, setBtsTitle] = useState('');
  const [btsCategory, setBtsCategory] = useState<BTSCategory>('Wedding');
  const [btsExpiryDays, setBtsExpiryDays] = useState('7');
  const [btsScheduledFor, setBtsScheduledFor] = useState('');
  const [btsMusicFile, setBtsMusicFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [btsVisibility, setBtsVisibility] = useState<'global' | 'assigned_only' | 'private'>('assigned_only');

  // Announcement Form State
  const [annPicked, setAnnPicked] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [annMediaType, setAnnMediaType] = useState<'image' | 'video'>('image');
  const [annTitle, setAnnTitle] = useState('');
  const [annDescription, setAnnDescription] = useState('');
  const [annContentHtml, setAnnContentHtml] = useState('');
  const [annCategory, setAnnCategory] = useState('');
  const [annTag, setAnnTag] = useState('');
  const [annExpiryDays, setAnnExpiryDays] = useState('30');
  const [annScheduledFor, setAnnScheduledFor] = useState('');
  const [annTargetAudience, setAnnTargetAudience] = useState<string[]>([]);
  const [annVisibility, setAnnVisibility] = useState<'global' | 'assigned_only' | 'private'>('assigned_only');

  // Portfolio Form State
  const [portfolioPicked, setPortfolioPicked] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [portfolioTitle, setPortfolioTitle] = useState('');
  const [portfolioDescription, setPortfolioDescription] = useState('');
  const [portfolioCategory, setPortfolioCategory] = useState('');
  const [portfolioFeatured, setPortfolioFeatured] = useState(false);
  const [portfolioTopRated, setPortfolioTopRated] = useState(false);
  const [showPortfolioPreview, setShowPortfolioPreview] = useState(false);
  const [uploadError, setUploadError] = useState<{ title: string; details: string } | null>(null);

  // Lists
  const [btsPosts, setBtsPosts] = useState<BTSPost[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [portfolioItems, setPortfolioItems] = useState<any[]>([]);
  const [clockMs, setClockMs] = useState(() => Date.now());

  const generateCaption = useCallback(() => {
    const captions: Record<string, string[]> = {
      Wedding: [
        "Capturing love in its purest form. 💍✨ #WeddingPhotography",
        "Every love story deserves to be told through timeless photography. ❤️",
        "Behind the scenes of magic being made. ✨ #BrideAndGroom"
      ],
      Portrait: [
        "Unveiling the beauty within. 📸 #PortraitPhotography",
        "Every face tells a story worth capturing. 🌟",
        "Moments of authentic expression. ✨ #PortraitSession"
      ],
      Corporate: [
        "Professional excellence captured. 💼 #CorporatePhotography",
        "Building brands through powerful imagery. 🏢",
        "Behind the scenes of business success. 📊"
      ],
      Event: [
        "Capturing the energy of unforgettable moments. 🎉 #EventPhotography",
        "Where memories are made and preserved. 📸",
        "Behind the lens at today's spectacular event. ✨"
      ],
      Portfolio: [
        "Showcasing our finest work. ✨ #PortfolioShowcase",
        "A collection of moments that define our craft. 📸",
        "Excellence in every frame. 🎨 #ProPhotography"
      ],
      Other: [
        "Creating art through the lens. 🎨 #Photography",
        "Behind the scenes magic in the making. ✨",
        "Capturing moments that tell stories. 📖"
      ]
    };
    const options = captions[btsCategory] || captions['Other'];
    const random = options[Math.floor(Math.random() * options.length)];
    setBtsTitle(random);
  }, [btsCategory]);

  const generateAnnouncementCaption = useCallback(() => {
    const captions = [
      "Exciting news! We're expanding our services to serve you better. 🎉",
      "Big announcement coming your way! Stay tuned for updates. ✨",
      "We've got something special in store for our valued clients. 💫",
      "Get ready for our latest offering designed just for you. 🌟",
      "Important update: New packages and features now available! 📢"
    ];
    const random = captions[Math.floor(Math.random() * captions.length)];
    setAnnTitle(random);
  }, []);

  const pickMedia = useCallback(async (forType: ContentType) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 0.8,
        videoMaxDuration: 30,
      });
      if (!result.canceled && result.assets[0]) {
        if (forType === 'bts') {
          setBtsPicked(result.assets[0]);
        } else if (forType === 'announcement') {
          setAnnPicked(result.assets[0]);
          setAnnMediaType(inferMediaType(result.assets[0]));
        } else if (forType === 'portfolio') {
          setPortfolioPicked(result.assets[0]);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick media');
    }
  }, []);

  const pickMusic = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      setBtsMusicFile(result.assets[0]);
    } catch (error) {
      Alert.alert('Error', 'Failed to pick music file');
    }
  }, []);

  // ── Upload Functions ──────────────────────────────────────────
  const uploadBtsPost = useCallback(async () => {
    if (!btsPicked || !user) return;
    setPosting(true);
    setUploadStatus('Compressing...');
    try {
      const ext = getFileExtension(btsPicked);
      const fileName = `bts-${Date.now()}.${ext}`;
      const filePath = `bts/${user.id}/${fileName}`;

      let uploadUri = btsPicked.uri;
      let thumbnailUrl: string | null = null;

      // Compress images (not videos)
      if (inferMediaType(btsPicked) === 'image') {
        setUploadStatus('Compressing image...');
        const compressed = await compressImage(btsPicked.uri);
        uploadUri = compressed.uri;

        // Generate thumbnail for instant preview
        setUploadStatus('Generating thumbnail...');
        const thumb = await generateThumbnail(btsPicked.uri);
        if (thumb) {
          const thumbFileName = `bts-thumb-${Date.now()}.jpg`;
          const thumbPath = `bts/thumbnails/${user.id}/${thumbFileName}`;
          const thumbResponse = await fetch(thumb.uri);
          const thumbBlob = await thumbResponse.blob();
          const { error: thumbErr } = await supabase.storage
            .from('media')
            .upload(thumbPath, thumbBlob, { contentType: 'image/jpeg', upsert: true });
          if (!thumbErr) {
            const { data: thumbUrlData } = supabase.storage.from('media').getPublicUrl(thumbPath);
            thumbnailUrl = thumbUrlData.publicUrl;
          }
        }
      }

      setUploadStatus('Uploading...');
      const response = await fetch(uploadUri);
      const blob = await response.blob();

      const { error: uploadErr } = await supabase.storage
        .from('media')
        .upload(filePath, blob, { contentType: btsPicked.mimeType || 'image/jpeg', upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(filePath);

      // For video posts, generate thumbnail from first frame
      if (inferMediaType(btsPicked) === 'video' && !thumbnailUrl) {
        try {
          const thumb = await generateThumbnail(btsPicked.uri);
          if (thumb) {
            const thumbFileName = `bts-thumb-${Date.now()}.jpg`;
            const thumbPath = `bts/thumbnails/${user.id}/${thumbFileName}`;
            const thumbResponse = await fetch(thumb.uri);
            const thumbBlob = await thumbResponse.blob();
            const { error: thumbErr } = await supabase.storage
              .from('media')
              .upload(thumbPath, thumbBlob, { contentType: 'image/jpeg', upsert: true });
            if (!thumbErr) {
              const { data: thumbUrlData } = supabase.storage.from('media').getPublicUrl(thumbPath);
              thumbnailUrl = thumbUrlData.publicUrl;
            }
          }
        } catch (e) {
          console.warn('[BTS] Video thumbnail generation failed:', e);
        }
      }

      let musicPublicUrl: string | null = null;
      if (btsMusicFile) {
        try {
          const musicExt = btsMusicFile.name?.split('.').pop() || 'mp3';
          const musicFileName = `bts-music-${Date.now()}.${musicExt}`;
          const musicFilePath = `bts/music/${user.id}/${musicFileName}`;
          const musicResponse = await fetch(btsMusicFile.uri);
          const musicBlob = await musicResponse.blob();
          const { error: musicUploadErr } = await supabase.storage
            .from('media')
            .upload(musicFilePath, musicBlob, { contentType: btsMusicFile.mimeType || 'audio/mpeg', upsert: true });
          if (musicUploadErr) throw musicUploadErr;
          const { data: musicUrlData } = supabase.storage.from('media').getPublicUrl(musicFilePath);
          musicPublicUrl = musicUrlData.publicUrl;
        } catch (e: any) {
          console.warn('[BTS] Music upload failed:', e?.message);
        }
      }

      const { error: dbErr } = await supabase.from('bts_posts').insert({
        created_by: user.id,
        admin_id: user.id,
        media_url: publicUrl,
        media_type: inferMediaType(btsPicked),
        video_thumbnail_url: thumbnailUrl,
        title: btsTitle || 'Untitled BTS',
        category: btsCategory,
        visibility: btsVisibility,
        expires_at: btsExpiryDays ? daysToExpiryIso(Number(btsExpiryDays)) : null,
        scheduled_for: btsScheduledFor && !isNaN(new Date(btsScheduledFor).getTime()) ? new Date(btsScheduledFor).toISOString() : null,
        music_url: musicPublicUrl,
        has_music: !!musicPublicUrl,
      } as any);
      if (dbErr) throw dbErr;

      Alert.alert('Success', 'BTS post uploaded!');
      setBtsPicked(null);
      setBtsTitle('');
    } catch (error: any) {
      Alert.alert('Upload Failed', error?.message || 'Unknown error');
    } finally {
      setPosting(false);
      setUploadStatus('');
    }
  }, [btsPicked, user, btsTitle, btsCategory, btsVisibility, btsExpiryDays, btsScheduledFor, btsMusicFile]);

  const uploadAnnouncement = useCallback(async () => {
    if (!annPicked || !user) return;
    setPosting(true);
    setUploadStatus('Compressing...');
    try {
      const ext = getFileExtension(annPicked);
      const fileName = `ann-${Date.now()}.${ext}`;
      const filePath = `announcements/${user.id}/${fileName}`;

      let uploadUri = annPicked.uri;
      if (inferMediaType(annPicked) === 'image') {
        const compressed = await compressImage(annPicked.uri);
        uploadUri = compressed.uri;
      }

      setUploadStatus('Uploading...');
      const response = await fetch(uploadUri);
      const blob = await response.blob();

      const { error: uploadErr } = await supabase.storage
        .from('media')
        .upload(filePath, blob, { contentType: annPicked.mimeType || 'image/jpeg', upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(filePath);

      const { error: dbErr } = await supabase.from('announcements').insert({
        created_by: user.id,
        owner_admin_id: user.id,
        title: annTitle || 'Untitled Announcement',
        description: annDescription,
        content: annDescription || annTitle || '',
        media_url: publicUrl,
        image_url: publicUrl,
        media_type: annMediaType,
        visibility: annVisibility === 'global' ? 'all' : 'selected',
        is_active: true,
        expires_at: annExpiryDays ? daysToExpiryIso(Number(annExpiryDays)) : null,
        scheduled_for: annScheduledFor && !isNaN(new Date(annScheduledFor).getTime()) ? new Date(annScheduledFor).toISOString() : null,
      } as any);
      if (dbErr) throw dbErr;

      Alert.alert('Success', 'Announcement uploaded!');
      setAnnPicked(null);
      setAnnTitle('');
      setAnnDescription('');
    } catch (error: any) {
      Alert.alert('Upload Failed', error?.message || 'Unknown error');
    } finally {
      setPosting(false);
      setUploadStatus('');
    }
  }, [annPicked, user, annTitle, annDescription, annMediaType, annVisibility, annExpiryDays, annScheduledFor]);

  const uploadPortfolioItem = useCallback(async () => {
    if (!portfolioPicked || !user) return;
    setPosting(true);
    setUploadStatus('Compressing...');
    try {
      const ext = getFileExtension(portfolioPicked);
      const fileName = `portfolio-${Date.now()}.${ext}`;
      const filePath = `portfolio/${user.id}/${fileName}`;

      let uploadUri = portfolioPicked.uri;
      if (inferMediaType(portfolioPicked) === 'image') {
        const compressed = await compressImage(portfolioPicked.uri);
        uploadUri = compressed.uri;
      }

      setUploadStatus('Uploading...');
      const response = await fetch(uploadUri);
      const blob = await response.blob();

      const { error: uploadErr } = await supabase.storage
        .from('portfolio')
        .upload(filePath, blob, { contentType: portfolioPicked.mimeType || 'image/jpeg', upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage.from('portfolio').getPublicUrl(filePath);

      const { error: dbErr } = await supabase.from('portfolio_items').insert({
        created_by: user.id,
        title: portfolioTitle || 'Untitled',
        description: portfolioDescription,
        media_url: publicUrl,
        category: portfolioCategory,
        is_featured: portfolioFeatured,
        is_top_rated: portfolioTopRated,
      } as any);
      if (dbErr) throw dbErr;

      Alert.alert('Success', 'Portfolio item uploaded!');
      setPortfolioPicked(null);
      setPortfolioTitle('');
      setPortfolioDescription('');
    } catch (error: any) {
      Alert.alert('Upload Failed', error?.message || 'Unknown error');
    } finally {
      setPosting(false);
      setUploadStatus('');
    }
  }, [portfolioPicked, user, portfolioTitle, portfolioDescription, portfolioCategory, portfolioFeatured, portfolioTopRated]);

  // ── Fetch Lists ───────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setAccessReady(true);
      try {
        const [btsData, annData, portData] = await Promise.all([
          supabase.from('bts_posts').select('*').eq('created_by', user.id).order('created_at', { ascending: false }).limit(50),
          supabase.from('announcements').select('*').eq('created_by', user.id).order('created_at', { ascending: false }).limit(50),
          supabase.from('portfolio_items').select('*').eq('created_by', user.id).order('created_at', { ascending: false }).limit(50),
        ]);
        if (btsData.data) setBtsPosts(btsData.data as any);
        if (annData.data) setAnnouncements(annData.data as any);
        if (portData.data) setPortfolioItems(portData.data as any);
      } catch (e) {
        console.warn('[BTS] Load error:', e);
      }
    };
    load();
  }, [user]);

  useEffect(() => {
    const timer = setInterval(() => setClockMs(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  // ── Derived ───────────────────────────────────────────────────
  const visibleBtsPosts = useMemo(() => {
    return btsPosts.filter(p => {
      if (!p.scheduled_for) return true;
      return new Date(p.scheduled_for).getTime() <= clockMs;
    });
  }, [btsPosts, clockMs]);

  const getPostStats = (item: any) => ({
    likes: item.likes_count || item.reaction_count || 0,
    comments: item.comments_count || item.comment_count || 0,
    views: item.views_count || item.view_count || 0,
  });

  const handleDelete = useCallback(async (type: 'bts' | 'announcement' | 'portfolio', id: string) => {
    Alert.alert('Delete', 'Are you sure you want to delete this?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const table = type === 'bts' ? 'bts_posts' : type === 'announcement' ? 'announcements' : 'portfolio_items';
            const { error } = await supabase.from(table).delete().eq('id', id);
            if (error) throw error;
            if (type === 'bts') setBtsPosts(prev => prev.filter(p => p.id !== id));
            else if (type === 'announcement') setAnnouncements(prev => prev.filter(a => a.id !== id));
            else setPortfolioItems(prev => prev.filter((p: any) => p.id !== id));
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to delete');
          }
        }
      }
    ]);
  }, []);

  if (!accessReady) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  const sections: SectionData[] = [
    { title: 'BTS Posts', data: visibleBtsPosts, type: 'bts' as const },
    { title: 'Announcements', data: announcements, type: 'announcement' as const },
    { title: 'Portfolio Items', data: portfolioItems, type: 'portfolio' as const },
  ];

  const renderMediaPicker = (
    picked: ImagePicker.ImagePickerAsset | null,
    onPick: () => void,
    onClear: () => void,
    mediaType: 'image' | 'video' | 'all',
    icon: React.ReactNode,
    label: string
  ) => (
    <Pressable style={styles.mediaPicker} onPress={onPick}>
      {picked ? (
        <View style={styles.mediaPreview}>
          {inferMediaType(picked) === 'video' ? (
            <Video source={{ uri: picked.uri }} style={styles.mediaPreviewImage} resizeMode={ResizeMode.COVER} shouldPlay={false} isMuted={true} />
          ) : (
            <Image source={{ uri: picked.uri }} style={styles.mediaPreviewImage} />
          )}
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={styles.mediaOverlay}>
            <Text style={styles.mediaOverlayText}>{picked.fileName || 'Selected'}</Text>
          </LinearGradient>
          <Pressable style={styles.removeMediaBtn} onPress={onClear}>
            <X size={14} color="#fff" />
          </Pressable>
        </View>
      ) : (
        <View style={styles.mediaPlaceholder}>
          <View style={styles.mediaPlaceholderIcon}>{icon}</View>
          <Text style={styles.mediaPlaceholderLabel}>{label}</Text>
          <Text style={styles.mediaPlaceholderHint}>Tap to select from gallery</Text>
        </View>
      )}
    </Pressable>
  );

  const renderSectionItem = ({ item, section }: { item: SectionItem; section: SectionData }) => {
    const stats = getPostStats(item);
    const created = new Date(item.created_at).toLocaleDateString();

    return (
      <Pressable
        style={styles.contentCard}
        onPress={() => router.push({ pathname: '/post-details/[id]', params: { id: item.id, type: section.type } } as any)}
      >
        <View style={styles.contentCardInner}>
          {section.type === 'bts' && (
            <>
              {(item as BTSPost).media_url && (
                <Image source={{ uri: (item as BTSPost).video_thumbnail_url || (item as BTSPost).media_url }} style={styles.contentThumb} />
              )}
              <View style={styles.contentInfo}>
                <Text style={styles.contentTitle} numberOfLines={1}>{(item as BTSPost).title || 'Untitled'}</Text>
                <Text style={styles.contentMeta}>{(item as BTSPost).category || 'BTS'} • {created}</Text>
                <View style={styles.contentStats}>
                  <View style={styles.contentStat}><Heart size={11} color={Colors.textMuted} /><Text style={styles.contentStatText}>{stats.likes}</Text></View>
                  <View style={styles.contentStat}><MessageCircle size={11} color={Colors.textMuted} /><Text style={styles.contentStatText}>{stats.comments}</Text></View>
                  <View style={styles.contentStat}><Eye size={11} color={Colors.textMuted} /><Text style={styles.contentStatText}>{stats.views}</Text></View>
                </View>
              </View>
            </>
          )}
          {section.type === 'announcement' && (
            <>
              {(item as AnnouncementRow).media_url && (
                <Image source={{ uri: (item as AnnouncementRow).media_url || (item as AnnouncementRow).image_url || '' }} style={styles.contentThumb} />
              )}
              <View style={styles.contentInfo}>
                <Text style={styles.contentTitle} numberOfLines={1}>{(item as AnnouncementRow).title || 'Untitled'}</Text>
                <Text style={styles.contentMeta}>{created}</Text>
                <View style={styles.contentStats}>
                  <View style={styles.contentStat}><Heart size={11} color={Colors.textMuted} /><Text style={styles.contentStatText}>{stats.likes}</Text></View>
                  <View style={styles.contentStat}><MessageCircle size={11} color={Colors.textMuted} /><Text style={styles.contentStatText}>{stats.comments}</Text></View>
                </View>
              </View>
            </>
          )}
          {section.type === 'portfolio' && (
            <>
              {(item as PortfolioItem).media_url && (
                <Image source={{ uri: (item as PortfolioItem).media_url }} style={styles.contentThumb} />
              )}
              <View style={styles.contentInfo}>
                <Text style={styles.contentTitle} numberOfLines={1}>{(item as PortfolioItem).title}</Text>
                <Text style={styles.contentMeta}>{(item as PortfolioItem).category || 'Portfolio'} • {created}</Text>
                {((item as PortfolioItem).is_featured || (item as PortfolioItem).is_top_rated) && (
                  <View style={styles.badgePill}>
                    <Crown size={10} color={Colors.gold} />
                    <Text style={styles.badgePillText}>{(item as PortfolioItem).is_featured ? 'Featured' : 'Top Rated'}</Text>
                  </View>
                )}
              </View>
            </>
          )}
        </View>
        <Pressable style={styles.contentDeleteBtn} onPress={() => handleDelete(section.type, item.id)}>
          <X size={14} color={Colors.textMuted} />
        </Pressable>
      </Pressable>
    );
  };

  const renderListHeader = () => (
    <>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>BTS & Announcements</Text>
        <Text style={styles.subtitle}>Create engaging content for your audience</Text>
      </View>

      {/* Content Type Tabs */}
      <View style={styles.tabBar}>
        {([
          { key: 'bts' as ContentType, label: 'BTS Posts', icon: <Layers size={16} /> },
          { key: 'announcement' as ContentType, label: 'Announcements', icon: <Megaphone size={16} /> },
          { key: 'portfolio' as ContentType, label: 'Portfolio', icon: <ImageIcon size={16} /> },
        ]).map(tab => (
          <Pressable
            key={tab.key}
            style={[styles.tab, contentType === tab.key && styles.tabActive]}
            onPress={() => setContentType(tab.key)}
          >
            <View style={[styles.tabIconWrap, contentType === tab.key && styles.tabIconWrapActive]}>
              {tab.icon}
            </View>
            <Text style={[styles.tabLabel, contentType === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
            {contentType === tab.key && <View style={styles.tabIndicator} />}
          </Pressable>
        ))}
      </View>

      {/* ── BTS Form ── */}
      {contentType === 'bts' && (
        <View style={styles.formCard}>
          <Text style={styles.formCardTitle}>Create BTS Post</Text>

          {renderMediaPicker(
            btsPicked,
            () => pickMedia('bts'),
            () => setBtsPicked(null),
            'all',
            <Camera size={28} color={Colors.gold} />,
            'Select Photo/Video'
          )}

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Caption</Text>
            <View style={styles.captionRow}>
              <TextInput
                style={[styles.fieldInput, styles.captionInput]}
                placeholder="Add an engaging caption..."
                placeholderTextColor={Colors.textMuted}
                value={btsTitle}
                onChangeText={setBtsTitle}
                multiline
                maxLength={220}
              />
              <Pressable onPress={generateCaption} style={styles.aiBtn}>
                <Sparkles size={12} color={Colors.gold} />
                <Text style={styles.aiBtnText}>AI</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {CATEGORIES.map(cat => (
                <Pressable
                  key={cat}
                  style={[styles.chip, btsCategory === cat && styles.chipActive]}
                  onPress={() => setBtsCategory(cat)}
                >
                  <Text style={[styles.chipText, btsCategory === cat && styles.chipTextActive]}>{cat}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Visibility</Text>
            <View style={styles.visibilityRow}>
              {([
                { key: 'global' as const, label: '🌍 Global', icon: Globe },
                { key: 'assigned_only' as const, label: '🔒 My Clients', icon: Lock },
                { key: 'private' as const, label: '🔐 Private', icon: Shield },
              ]).map(opt => (
                <Pressable
                  key={opt.key}
                  style={[styles.visBtn, btsVisibility === opt.key && styles.visBtnActive]}
                  onPress={() => setBtsVisibility(opt.key)}
                >
                  <Text style={[styles.visBtnText, btsVisibility === opt.key && styles.visBtnTextActive]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.fieldHint}>
              {btsVisibility === 'global' ? 'Visible to all users' :
               btsVisibility === 'assigned_only' ? 'Only your assigned clients can see this' :
               'Only you can see this'}
            </Text>
          </View>

          <View style={styles.fieldRow}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Expires After (days)</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="7"
                placeholderTextColor={Colors.textMuted}
                value={btsExpiryDays}
                onChangeText={t => setBtsExpiryDays(t.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                maxLength={3}
              />
            </View>
            <View style={[styles.fieldGroup, { flex: 1.5 }]}>
              <Text style={styles.fieldLabel}>Schedule (optional)</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="YYYY-MM-DD HH:MM"
                placeholderTextColor={Colors.textMuted}
                value={btsScheduledFor}
                onChangeText={setBtsScheduledFor}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Background Music (optional)</Text>
            <View style={styles.captionRow}>
              <TextInput
                style={[styles.fieldInput, { flex: 1 }]}
                placeholder="Select music file..."
                placeholderTextColor={Colors.textMuted}
                value={btsMusicFile?.name || ''}
                editable={false}
              />
              <Pressable onPress={pickMusic} style={styles.aiBtn}>
                <Music size={12} color={Colors.gold} />
                <Text style={styles.aiBtnText}>Pick</Text>
              </Pressable>
            </View>
            {btsMusicFile && (
              <Pressable onPress={() => setBtsMusicFile(null)} style={styles.clearBtn}>
                <Text style={styles.clearBtnText}>Clear music</Text>
              </Pressable>
            )}
          </View>

          <Pressable
            style={[styles.submitBtn, posting && styles.submitBtnDisabled]}
            onPress={uploadBtsPost}
            disabled={posting}
          >
            {posting ? (
              <View style={styles.submitLoading}>
                <ActivityIndicator color="#000" size="small" />
                <Text style={styles.submitBtnText}>{uploadStatus || 'Uploading...'}</Text>
              </View>
            ) : (
              <Text style={styles.submitBtnText}>Upload BTS Post</Text>
            )}
          </Pressable>
        </View>
      )}

      {/* ── Announcement Form ── */}
      {contentType === 'announcement' && (
        <View style={styles.formCard}>
          <Text style={styles.formCardTitle}>Create Announcement</Text>

          {renderMediaPicker(
            annPicked,
            () => pickMedia('announcement'),
            () => setAnnPicked(null),
            'all',
            <Megaphone size={28} color={Colors.gold} />,
            'Select Photo/Video'
          )}

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Title</Text>
            <View style={styles.captionRow}>
              <TextInput
                style={[styles.fieldInput, styles.captionInput]}
                placeholder="Announcement title..."
                placeholderTextColor={Colors.textMuted}
                value={annTitle}
                onChangeText={setAnnTitle}
                maxLength={100}
              />
              <Pressable onPress={generateAnnouncementCaption} style={styles.aiBtn}>
                <Sparkles size={12} color={Colors.gold} />
                <Text style={styles.aiBtnText}>AI</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.fieldInput, styles.textArea]}
              placeholder="Add more details..."
              placeholderTextColor={Colors.textMuted}
              value={annDescription}
              onChangeText={setAnnDescription}
              multiline
              maxLength={500}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Visibility</Text>
            <View style={styles.visibilityRow}>
              {([
                { key: 'global' as const, label: '🌍 Global' },
                { key: 'assigned_only' as const, label: '🔒 My Clients' },
                { key: 'private' as const, label: '🔐 Private' },
              ]).map(opt => (
                <Pressable
                  key={opt.key}
                  style={[styles.visBtn, annVisibility === opt.key && styles.visBtnActive]}
                  onPress={() => setAnnVisibility(opt.key)}
                >
                  <Text style={[styles.visBtnText, annVisibility === opt.key && styles.visBtnTextActive]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.fieldRow}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Expires After (days)</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="30"
                placeholderTextColor={Colors.textMuted}
                value={annExpiryDays}
                onChangeText={t => setAnnExpiryDays(t.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                maxLength={3}
              />
            </View>
            <View style={[styles.fieldGroup, { flex: 1.5 }]}>
              <Text style={styles.fieldLabel}>Schedule (optional)</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="YYYY-MM-DD HH:MM"
                placeholderTextColor={Colors.textMuted}
                value={annScheduledFor}
                onChangeText={setAnnScheduledFor}
              />
            </View>
          </View>

          <Pressable
            style={[styles.submitBtn, posting && styles.submitBtnDisabled]}
            onPress={uploadAnnouncement}
            disabled={posting}
          >
            {posting ? (
              <View style={styles.submitLoading}>
                <ActivityIndicator color="#000" size="small" />
                <Text style={styles.submitBtnText}>{uploadStatus || 'Uploading...'}</Text>
              </View>
            ) : (
              <Text style={styles.submitBtnText}>Upload Announcement</Text>
            )}
          </Pressable>
        </View>
      )}

      {/* ── Portfolio Form ── */}
      {contentType === 'portfolio' && (
        <View style={styles.formCard}>
          <Text style={styles.formCardTitle}>Add Portfolio Item</Text>

          {renderMediaPicker(
            portfolioPicked,
            () => pickMedia('portfolio'),
            () => setPortfolioPicked(null),
            'image',
            <ImageIcon size={28} color={Colors.gold} />,
            'Select Image'
          )}

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="Portfolio title..."
              placeholderTextColor={Colors.textMuted}
              value={portfolioTitle}
              onChangeText={setPortfolioTitle}
              maxLength={100}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.fieldInput, styles.textArea]}
              placeholder="Describe this work..."
              placeholderTextColor={Colors.textMuted}
              value={portfolioDescription}
              onChangeText={setPortfolioDescription}
              multiline
              maxLength={500}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Category</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="e.g. Wedding, Portrait..."
              placeholderTextColor={Colors.textMuted}
              value={portfolioCategory}
              onChangeText={setPortfolioCategory}
            />
          </View>

          <View style={styles.toggleRow}>
            <Pressable
              style={[styles.toggleBtn, portfolioFeatured && styles.toggleBtnActive]}
              onPress={() => setPortfolioFeatured(!portfolioFeatured)}
            >
              <Crown size={14} color={portfolioFeatured ? '#000' : Colors.textMuted} />
              <Text style={[styles.toggleBtnText, portfolioFeatured && styles.toggleBtnTextActive]}>Featured</Text>
            </Pressable>
            <Pressable
              style={[styles.toggleBtn, portfolioTopRated && styles.toggleBtnActive]}
              onPress={() => setPortfolioTopRated(!portfolioTopRated)}
            >
              <Sparkles size={14} color={portfolioTopRated ? '#000' : Colors.textMuted} />
              <Text style={[styles.toggleBtnText, portfolioTopRated && styles.toggleBtnTextActive]}>Top Rated</Text>
            </Pressable>
          </View>

          <Pressable
            style={[styles.submitBtn, posting && styles.submitBtnDisabled]}
            onPress={uploadPortfolioItem}
            disabled={posting}
          >
            {posting ? (
              <View style={styles.submitLoading}>
                <ActivityIndicator color="#000" size="small" />
                <Text style={styles.submitBtnText}>{uploadStatus || 'Uploading...'}</Text>
              </View>
            ) : (
              <Text style={styles.submitBtnText}>Add to Portfolio</Text>
            )}
          </Pressable>
        </View>
      )}
    </>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderSectionItem}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeaderWrap}>
            <Text style={styles.sectionHeaderText}>{section.title}</Text>
            <View style={styles.sectionHeaderCount}>
              <Text style={styles.sectionHeaderCountText}>{section.data.length}</Text>
            </View>
          </View>
        )}
        ListHeaderComponent={renderListHeader}
        contentContainerStyle={{ paddingBottom: 40 }}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={null}
        renderSectionFooter={() => null}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { padding: 20, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: Colors.textMuted, marginTop: 4 },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    position: 'relative',
  },
  tabActive: {
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderColor: Colors.gold,
  },
  tabIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  tabIconWrapActive: {
    backgroundColor: Colors.gold,
  },
  tabLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  tabLabelActive: { color: Colors.gold },
  tabIndicator: {
    position: 'absolute',
    bottom: -1,
    left: '30%',
    right: '30%',
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.gold,
  },

  // Form Card
  formCard: {
    margin: 16,
    marginTop: 4,
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  formCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 16,
    letterSpacing: -0.3,
  },

  // Media Picker
  mediaPicker: { marginBottom: 16 },
  mediaPreview: { position: 'relative', borderRadius: 16, overflow: 'hidden' },
  mediaPreviewImage: { width: '100%', height: 220, borderRadius: 16, backgroundColor: Colors.cardDark },
  mediaOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingBottom: 10,
    paddingTop: 24,
  },
  mediaOverlayText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  removeMediaBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaPlaceholder: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    backgroundColor: Colors.background,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  mediaPlaceholderIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(212,175,55,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaPlaceholderLabel: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  mediaPlaceholderHint: { color: Colors.textMuted, fontSize: 11 },

  // Fields
  fieldGroup: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  fieldHint: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  fieldInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  captionRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  captionInput: { flex: 1, minHeight: 60 },
  textArea: { minHeight: 72, textAlignVertical: 'top' },
  fieldRow: { flexDirection: 'row', gap: 10 },
  aiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(212,175,55,0.1)',
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  aiBtnText: { fontSize: 11, color: Colors.gold, fontWeight: '700' },

  // Chips
  chipRow: { gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  chipTextActive: { color: '#000' },

  // Visibility
  visibilityRow: { flexDirection: 'row', gap: 8 },
  visBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  visBtnActive: {
    backgroundColor: 'rgba(212,175,55,0.1)',
    borderColor: Colors.gold,
  },
  visBtnText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  visBtnTextActive: { color: Colors.gold },

  // Toggle
  toggleRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toggleBtnActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  toggleBtnText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  toggleBtnTextActive: { color: '#000' },

  clearBtn: { alignSelf: 'flex-start', marginTop: 6 },
  clearBtnText: { fontSize: 12, color: Colors.gold, fontWeight: '600' },

  // Submit
  submitBtn: {
    backgroundColor: Colors.gold,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#000', fontSize: 15, fontWeight: '700' },
  submitLoading: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  // Section Headers
  sectionHeaderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionHeaderText: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  sectionHeaderCount: {
    backgroundColor: Colors.card,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  sectionHeaderCountText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },

  // Content Cards
  contentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  contentCardInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contentThumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: Colors.cardDark,
  },
  contentInfo: { flex: 1 },
  contentTitle: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
  contentMeta: { fontSize: 11, color: Colors.textMuted },
  contentStats: { flexDirection: 'row', gap: 10, marginTop: 4 },
  contentStat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  contentStatText: { fontSize: 11, color: Colors.textMuted },
  contentDeleteBtn: { padding: 8 },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(212,175,55,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  badgePillText: { fontSize: 10, color: Colors.gold, fontWeight: '700' },
});
