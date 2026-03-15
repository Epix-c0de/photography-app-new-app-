import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform, SectionList, Linking, Share } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Video, ResizeMode } from 'expo-av';
import { Camera, X, Sparkles, Image as ImageIcon, Megaphone, ChevronRight, BarChart2, Heart, MessageCircle, Eye, Share2 } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { AdminService } from '@/services/admin';
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

    // For now, return null to use the video directly
    // TODO: Install expo-video-thumbnails or react-native-create-thumbnail for proper thumbnails
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
      .upload(thumbnailPath, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error('[Video Thumbnail] Upload failed:', uploadError);
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(thumbnailPath);

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
      const result = await Share.share({
        message,
        url, // iOS only
        title: 'Share Studio Link',
      });
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
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        videoMaxDuration: 30, // Auto-crop to 30s for BTS videos
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
      if (result.canceled || !result.assets?.length) {
        return;
      }
      setBtsMusicFile(result.assets[0]);
    } catch {
      Alert.alert('Error', 'Failed to pick music');
    }
  }, []);

  const uploadBtsPost = useCallback(async () => {
    if (!btsPicked || !btsTitle.trim()) {
      Alert.alert('Error', 'Please select media and add a caption');
      return;
    }

    setPosting(true);
    try {
      // 1. If it's a video, we might want to handle it differently if audio crop was requested
      // However, client-side video editing is complex without extra libs.
      // We will assume for now we just upload and maybe handle 30s limit via UI/Metadata
      
      // Attempt to ensure bucket exists via Edge Function
      try {
        setUploadStatus('Checking storage setup...');
        await supabase.functions.invoke('ensure_buckets', {
          body: { buckets: ['media'], public: true }
        });
      } catch (invokeError) {
        console.warn('Failed to invoke ensure_buckets:', invokeError);
      }

      const fileExt = getFileExtension(btsPicked);
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `bts/${fileName}`;

      setUploadStatus('Uploading file to storage...');
      // Upload file to storage
      const response = await fetch(btsPicked.uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, blob, {
          contentType: btsPicked.mimeType || 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        const msg = (uploadError as any)?.message || String(uploadError);
        const lowerMsg = msg.toLowerCase();

        if (lowerMsg.includes('bucket') && lowerMsg.includes('not found')) {
          setPosting(false);
          Alert.alert(
            'Storage Bucket Required',
            'The "media" bucket needs to be created.\n\n1. Go to Supabase Dashboard > Storage\n2. Click "New Bucket"\n3. Name it "media"\n4. Set to "Public" access\n5. Click "Create Bucket"\n\nAfter creating the bucket, try uploading again.',
            [
              {
                text: 'Open Dashboard',
                onPress: () => Linking.openURL('https://supabase.com/dashboard/project/_/storage/buckets')
              },
              { text: 'OK' }
            ]
          );
          return;
        }

        if (lowerMsg.includes('forbidden') || lowerMsg.includes('unauthorized') || lowerMsg.includes('permission denied')) {
          setPosting(false);
          Alert.alert(
            'Permission Denied',
            'You do not have permission to upload to the "media" bucket. Check your Supabase Storage RLS policies.',
            [{ text: 'OK' }]
          );
          return;
        }

        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      // Thumbnail generation moved after insert to get real ID
      let thumbnailUrl: string | null = null;

      const expiresAtIso = daysToExpiryIso(Number(btsExpiryDays));
      const scheduledForIso = btsScheduledFor ? new Date(btsScheduledFor).toISOString() : null;
      let musicUrl: string | null = null;
      let hasMusic = false;

      if (btsMusicFile?.uri) {
        setUploadStatus('Uploading background music...');
        const nameParts = btsMusicFile.name?.split('.') ?? [];
        const ext = nameParts.length > 1 ? nameParts[nameParts.length - 1]?.toLowerCase() : '';
        const musicName = `${Date.now()}.${ext || 'mp3'}`;
        const musicPath = `music/${musicName}`;

        const musicResponse = await fetch(btsMusicFile.uri);
        const musicBlob = await musicResponse.blob();

        const { error: musicUploadError } = await supabase.storage
          .from('media')
          .upload(musicPath, musicBlob, {
            contentType: btsMusicFile.mimeType || 'audio/mpeg',
            upsert: true,
          });

        if (musicUploadError) {
          const msg = (musicUploadError as any)?.message || String(musicUploadError);
          const lowerMsg = msg.toLowerCase();

          if (lowerMsg.includes('bucket') && lowerMsg.includes('not found')) {
            setPosting(false);
            Alert.alert(
              'Storage Bucket Required',
              'The "media" bucket needs to be created.\n\n1. Go to Supabase Dashboard > Storage\n2. Click "New Bucket"\n3. Name it "media"\n4. Set to "Public" access\n5. Click "Create Bucket"\n\nAfter creating the bucket, try uploading again.',
              [
                {
                  text: 'Open Dashboard',
                  onPress: () => Linking.openURL('https://supabase.com/dashboard/project/_/storage/buckets')
                },
                { text: 'OK' }
              ]
            );
            return;
          }

          if (lowerMsg.includes('forbidden') || lowerMsg.includes('unauthorized') || lowerMsg.includes('permission denied')) {
            setPosting(false);
            Alert.alert(
              'Permission Denied',
              'You do not have permission to upload to the "media" bucket. Check your Supabase Storage RLS policies.',
              [{ text: 'OK' }]
            );
            return;
          }

          throw musicUploadError;
        }

        const { data: { publicUrl: musicPublicUrl } } = supabase.storage
          .from('media')
          .getPublicUrl(musicPath);

        musicUrl = musicPublicUrl || null;
        hasMusic = !!musicPublicUrl;
      }

      setUploadStatus('Saving to database...');
      const { data: newPost, error: insertError } = await supabase
        .from('bts_posts')
        .insert({
          title: btsTitle,
          media_url: publicUrl,
          media_type: inferMediaType(btsPicked),
          category: btsCategory,
          expires_at: expiresAtIso,
          scheduled_for: scheduledForIso,
          music_url: musicUrl,
          is_active: true,
          created_by: user?.id,
          caption: btsTitle,
          media_aspect_ratio: btsPicked.width / btsPicked.height,
        })
        .select()
        .single();

      if (!insertError && newPost && inferMediaType(btsPicked) === 'video') {
        setUploadStatus('Triggering background processing...');
        supabase.functions.invoke('generate_video_thumbnail', {
          body: {
            videoUrl: publicUrl,
            postId: newPost.id,
            type: 'bts'
          }
        }).catch(err => console.error('[BTS Thumbnail] Trigger failed:', err));
      }

      console.log('[BTS Upload] Insert response - error:', insertError);

      if (insertError) {
        console.error('[BTS Upload] ✗ Database Insert FAILED');
        console.error('[BTS Upload] Error:', insertError);
        console.error('[BTS Upload] Error message:', (insertError as any)?.message);
        console.error('[BTS Upload] Error code:', (insertError as any)?.code);
        console.error('[BTS Upload] Error details:', JSON.stringify(insertError));
        
        const msg = (insertError as any)?.message || String(insertError);
        const lower = msg.toLowerCase();
        
        if (lower.includes('row-level security') || lower.includes('violates row-level security') || lower.includes('permission denied') || lower.includes('not authorized')) {
          setPosting(false);
          Alert.alert(
            'Posting Blocked - RLS Policy',
            'Row Level Security rejected this post:\n\nError: ' + msg + '\n\nEnsure your account is admin and the created_by/admin_id policy is applied.',
            [{ text: 'OK' }]
          );
          return;
        }
        throw insertError;
      }

      console.log('[BTS Upload] ✓ Database insert SUCCESSFUL');
      setPosting(false);
      loadBtsPosts();

      // Notify all clients about new BTS post
      AdminService.notifications.notifyAll({
        type: 'bts_post',
        title: 'New BTS Post! ✨',
        body: `We just posted some behind-the-scenes magic. Tap to see "${btsTitle}".`,
        data: { btsId: newPost?.id }
      }).catch(err => console.error('Failed to send BTS notification:', err));
    } catch (error: any) {
      console.error('[BTS Upload] ✗ Complete Upload Error:', error);
      console.error('[BTS Upload] Error Stack:', error.stack);
      console.error('[BTS Upload] Error Code:', (error as any)?.code);
      console.error('[BTS Upload] Error Name:', (error as any)?.name);
      
      let errorTitle = 'Upload Failed ✗';
      let errorDetails = 'Error: ' + (error.message || 'Failed to upload post');
      
      if (error.message?.includes('fetch') || error.message?.includes('network')) {
        errorTitle = '🌐 Network Error';
        errorDetails = 'Connection failed. Please check:\n• Internet connection\n• Firewall/proxy settings\n• Try again in a moment';
      } else if (error.message?.includes('Supabase') || error.message?.includes('database') || error.message?.includes('ECONNREFUSED')) {
        errorTitle = '🗄️ Database Error';
        errorDetails = 'Supabase service issue:\n• Database may be temporarily unavailable\n• Check Supabase dashboard status\n• Try again in a few moments';
      } else if (error.message?.includes('function')) {
        errorTitle = '⚙️ Function Error';
        errorDetails = 'Cloud function issue:\n• Edge function may be down\n• Check deployment status\n• Contact support if persists';
      } else if (error.message?.includes('TIMEOUT') || error.message?.includes('timeout')) {
        errorTitle = '⏱️ Request Timeout';
        errorDetails = 'The request took too long:\n• Your internet may be slow\n• Server may be overloaded\n• Try uploading smaller file';
      }
      
      Alert.alert(errorTitle, errorDetails + '\n\nPlease check your internet connection and try again.', [{ text: 'OK' }]);
      setPosting(false);
    }
  }, [btsPicked, btsTitle, btsCategory, btsExpiryDays, btsScheduledFor, btsMusicFile, user]);

  const uploadAnnouncement = useCallback(async () => {
    if (!annPicked || !annTitle.trim()) {
      Alert.alert('Error', 'Please select media and add a title');
      return;
    }

    setPosting(true);
    try {
      // Attempt to ensure bucket exists via Edge Function
      try {
        await supabase.functions.invoke('ensure_buckets', {
          body: { buckets: ['media'], public: true }
        });
      } catch (invokeError) {
        console.warn('Failed to invoke ensure_buckets:', invokeError);
      }

      const fileExt = getFileExtension(annPicked);
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `announcements/${fileName}`;

      // Upload file to storage
      const response = await fetch(annPicked.uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, blob, {
          contentType: annPicked.mimeType || 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        const msg = (uploadError as any)?.message || String(uploadError);
        const lowerMsg = msg.toLowerCase();

        if (lowerMsg.includes('bucket') && lowerMsg.includes('not found')) {
          setPosting(false);
          Alert.alert(
            'Storage Bucket Required',
            'The "media" bucket needs to be created.\n\n1. Go to Supabase Dashboard > Storage\n2. Click "New Bucket"\n3. Name it "media"\n4. Set to "Public" access\n5. Click "Create Bucket"\n\nAfter creating the bucket, try uploading again.',
            [
              {
                text: 'Open Dashboard',
                onPress: () => Linking.openURL('https://supabase.com/dashboard/project/_/storage/buckets')
              },
              { text: 'OK' }
            ]
          );
          return;
        }

        if (lowerMsg.includes('forbidden') || lowerMsg.includes('unauthorized') || lowerMsg.includes('permission denied')) {
          setPosting(false);
          Alert.alert(
            'Permission Denied',
            'You do not have permission to upload to the "media" bucket. Check your Supabase Storage RLS policies.',
            [{ text: 'OK' }]
          );
          return;
        }

        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      // Thumbnail generation logic refactored below insert
      let thumbnailUrl: string | null = null;

      const expiresAtIso = daysToExpiryIso(Number(annExpiryDays));
      const scheduledForIso = annScheduledFor ? new Date(annScheduledFor).toISOString() : null;

      const { data: newAnn, error: insertError } = await supabase
        .from('announcements')
        .insert({
          title: annTitle,
          description: annDescription,
          content_html: annContentHtml,
          media_url: publicUrl,
          image_url: thumbnailUrl, // Store thumbnail URL for videos
          media_type: annMediaType,
          category: annCategory,
          tag: annTag,
          expires_at: expiresAtIso,
          scheduled_for: scheduledForIso,
          target_audience: annTargetAudience,
          is_active: true,
          created_by: user?.id,
          media_aspect_ratio: annPicked.width / annPicked.height,
        })
        .select()
        .single();

      if (!insertError && newAnn && annMediaType === 'video') {
        supabase.functions.invoke('generate_video_thumbnail', {
          body: {
            videoUrl: publicUrl,
            postId: newAnn.id,
            type: 'announcement'
          }
        }).catch(err => console.error('[Ann Thumbnail] Trigger failed:', err));
      }

      if (insertError) {
        const msg = (insertError as any)?.message || String(insertError);
        const lower = msg.toLowerCase();
        if (lower.includes('row-level security') || lower.includes('violates row-level security') || lower.includes('permission denied') || lower.includes('not authorized')) {
          setPosting(false);
          Alert.alert(
            'Posting Blocked',
            'Row Level Security rejected this announcement. Ensure your account is admin and the created_by policy is applied.',
            [{ text: 'OK' }]
          );
          return;
        }
        throw insertError;
      }

      setPosting(false);
      loadAnnouncements();

      // Notify all clients about new announcement
      AdminService.notifications.notifyAll({
        type: 'announcement',
        title: 'New Announcement! 📢',
        body: annTitle,
        data: { announcementId: newAnn?.id }
      }).catch(err => console.error('Failed to send announcement notification:', err));
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to post announcement');
      setPosting(false);
    }
  }, [annPicked, annTitle, annDescription, annContentHtml, annCategory, annTag, annExpiryDays, annScheduledFor, annTargetAudience, annMediaType, user]);

  const generateVideoThumbnail = useCallback(async (videoUri: string): Promise<string | null> => {
    try {
      console.log('[Video Thumbnail] Generating thumbnail for video:', videoUri);
      // For now, return null to skip thumbnail generation
      // In a real implementation, you would use expo-video-thumbnails or similar
      console.log('[Video Thumbnail] Skipping thumbnail generation (not implemented)');
      return null;
    } catch (error) {
      console.warn('[Video Thumbnail] Error generating thumbnail:', error);
      return null;
    }
  }, []);

  const uploadVideoThumbnail = useCallback(async (thumbnailUri: string, baseFileName: string): Promise<string | null> => {
    try {
      console.log('[Video Thumbnail] Uploading thumbnail:', thumbnailUri);
      // For now, return null to skip thumbnail upload
      // In a real implementation, you would upload the thumbnail to storage
      console.log('[Video Thumbnail] Skipping thumbnail upload (not implemented)');
      return null;
    } catch (error) {
      console.warn('[Video Thumbnail] Error uploading thumbnail:', error);
      return null;
    }
  }, []);

  const uploadPortfolio = useCallback(async () => {
    if (!portfolioPicked || !portfolioTitle.trim()) {
      Alert.alert('Error', 'Please select media and add a title');
      return;
    }

    setPosting(true);
    try {
      // Attempt to ensure bucket exists via Edge Function
      try {
        setUploadStatus('Checking storage setup...');
        await supabase.functions.invoke('ensure_buckets', {
          body: { buckets: ['media'], public: true }
        });
      } catch (invokeError) {
        console.warn('Failed to invoke ensure_buckets:', invokeError);
      }

      const fileExt = getFileExtension(portfolioPicked);
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `portfolio/${fileName}`;

      setUploadStatus('Uploading file to storage...');
      // Upload file to storage
      const response = await fetch(portfolioPicked.uri);
      const blob = await response.blob();

      console.log('[Portfolio Upload] Uploading file to storage:', filePath);
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, blob, {
          contentType: portfolioPicked.mimeType || 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        const msg = (uploadError as any)?.message || String(uploadError);
        const lowerMsg = msg.toLowerCase();

        if (lowerMsg.includes('bucket') && lowerMsg.includes('not found')) {
          setPosting(false);
          setUploadStatus('');
          Alert.alert(
            'Storage Bucket Required',
            'The "media" bucket needs to be created.\n\n1. Go to Supabase Dashboard > Storage\n2. Click "New Bucket"\n3. Name it "media"\n4. Set to "Public" access\n5. Click "Create Bucket"\n\nAfter creating the bucket, try uploading again.',
            [
              {
                text: 'Open Dashboard',
                onPress: () => Linking.openURL('https://supabase.com/dashboard/project/_/storage/buckets')
              },
              { text: 'OK' }
            ]
          );
          return;
        }

        if (lowerMsg.includes('forbidden') || lowerMsg.includes('unauthorized') || lowerMsg.includes('permission denied')) {
          setPosting(false);
          setUploadStatus('');
          Alert.alert(
            'Permission Denied',
            'You do not have permission to upload to the "media" bucket. Check your Supabase Storage RLS policies.',
            [{ text: 'OK' }]
          );
          return;
        }

        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      console.log('[Portfolio Upload] File uploaded successfully:', publicUrl);

      setUploadStatus('Processing video thumbnail...');
      // Generate thumbnail for videos
      let thumbnailUrl: string | null = null;
      if (inferMediaType(portfolioPicked) === 'video') {
        console.log('[Portfolio Upload] Generating video thumbnail...');
        const thumbnailUri = await generateVideoThumbnail(portfolioPicked.uri);
        if (thumbnailUri) {
          thumbnailUrl = await uploadVideoThumbnail(thumbnailUri, fileName);
          console.log('[Portfolio Upload] Video thumbnail generated:', thumbnailUrl);
        }
      }

      setUploadStatus('Saving to database...');
      console.log('[Portfolio Upload] Inserting into database with created_by:', user?.id);
      const { error: insertError } = await supabase
        .from('portfolio_items')
        .insert({
          title: portfolioTitle,
          description: portfolioDescription,
          category: portfolioCategory,
          media_url: publicUrl,
          media_type: inferMediaType(portfolioPicked),
          is_featured: portfolioFeatured,
          is_top_rated: portfolioTopRated,
          is_active: true,
          created_by: user?.id,
          media_aspect_ratio: portfolioPicked.width / portfolioPicked.height,
        });

      console.log('[Portfolio Upload] Insert response - error:', insertError);

      if (insertError) {
        console.error('[Portfolio Upload] ✗ Database Insert FAILED');
        console.error('[Portfolio Upload] Error:', insertError);
        console.error('[Portfolio Upload] Error message:', (insertError as any)?.message);
        console.error('[Portfolio Upload] Error code:', (insertError as any)?.code);
        console.error('[Portfolio Upload] Error details:', JSON.stringify(insertError));

        const msg = (insertError as any)?.message || String(insertError);
        const lower = msg.toLowerCase();

        if (lower.includes('row-level security') || lower.includes('violates row-level security') || lower.includes('permission denied') || lower.includes('not authorized')) {
          setPosting(false);
          setUploadStatus('');
          Alert.alert(
            'Posting Blocked - RLS Policy',
            'Row Level Security rejected this portfolio item:\n\nError: ' + msg + '\n\nEnsure your account is admin and the created_by policy is applied.',
            [{ text: 'OK' }]
          );
          return;
        }
        throw insertError;
      }

      setUploadStatus('');
      setPosting(false);
      loadPortfolioItems();

      // Notify all clients about new portfolio item
      AdminService.notifications.notifyAll({
        type: 'portfolio_item',
        title: 'New Portfolio Update! 📸',
        body: `We've added a new piece to our portfolio: "${portfolioTitle}".`,
        data: { portfolioId: portfolioTitle } // Use ID if available
      }).catch(err => console.error('Failed to send portfolio notification:', err));
    } catch (error: any) {
      console.error('[Portfolio Upload] ✗ Complete Upload Error:', error);
      console.error('[Portfolio Upload] Error Stack:', error.stack);
      console.error('[Portfolio Upload] Error Code:', (error as any)?.code);
      console.error('[Portfolio Upload] Error Name:', (error as any)?.name);

      let errorTitle = 'Upload Failed ✗';
      let errorDetails = 'Error: ' + (error.message || 'Failed to upload portfolio item');

      if (error.message?.includes('fetch') || error.message?.includes('network')) {
        errorTitle = '🌐 Network Error';
        errorDetails = 'Connection failed. Please check:\n• Internet connection\n• Firewall/proxy settings\n• Try again in a moment';
      } else if (error.message?.includes('Supabase') || error.message?.includes('database') || error.message?.includes('ECONNREFUSED')) {
        errorTitle = '🗄️ Database Error';
        errorDetails = 'Supabase service issue:\n• Database may be temporarily unavailable\n• Check Supabase dashboard status\n• Try again in a few moments';
      } else if (error.message?.includes('function')) {
        errorTitle = '⚙️ Function Error';
        errorDetails = 'Cloud function issue:\n• Edge function may be down\n• Check deployment status\n• Contact support if persists';
      } else if (error.message?.includes('TIMEOUT') || error.message?.includes('timeout')) {
        errorTitle = '⏱️ Request Timeout';
        errorDetails = 'The request took too long:\n• Your internet may be slow\n• Server may be overloaded\n• Try uploading smaller file';
      }

      Alert.alert(errorTitle, errorDetails + '\n\nPlease check your internet connection and try again.', [{ text: 'OK' }]);
      setUploadStatus('');
      setPosting(false);
    }
  }, [portfolioPicked, portfolioTitle, portfolioDescription, portfolioCategory, portfolioFeatured, portfolioTopRated, user]);

  const loadBtsPosts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('bts_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBtsPosts(data || []);
    } catch (error) {
      console.error('Error loading BTS posts:', error);
    }
  }, []);

  const loadAnnouncements = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnnouncements(data || []);
    } catch (error) {
      console.error('Error loading announcements:', error);
    }
  }, []);

  const loadPortfolioItems = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('portfolio_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPortfolioItems(data || []);
    } catch (error) {
      console.error('Error loading portfolio items:', error);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const ok = await verifyAdminGuard('upload_galleries');
      if (!ok) {
        router.replace('/admin-login');
        return;
      }
      setAccessReady(true);
      loadBtsPosts();
      loadAnnouncements();
      loadPortfolioItems();
    })();
  }, [router, verifyAdminGuard, loadBtsPosts, loadAnnouncements, loadPortfolioItems]);

  if (!accessReady) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  const sections: SectionData[] = [
    {
      title: 'BTS Posts',
      data: btsPosts,
      type: 'bts' as const,
    },
    {
      title: 'Announcements',
      data: announcements,
      type: 'announcement' as const,
    },
    {
      title: 'Portfolio Items',
      data: portfolioItems,
      type: 'portfolio' as const,
    }
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView style={[styles.scrollView, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>BTS & Announcements</Text>
          <Text style={styles.subtitle}>Create engaging content for your audience</Text>
        </View>

        {/* Content Type Selector */}
        <View style={styles.typeSelector}>
          <Pressable
            style={[styles.typeButton, contentType === 'bts' && styles.typeButtonActive]}
            onPress={() => setContentType('bts')}
          >
            <ExpoImage
              source={require('@/assets/icons/bts-announcements/bts.svg')}
              style={{ width: 20, height: 20 }}
              tintColor={contentType === 'bts' ? Colors.gold : Colors.textMuted}
              contentFit="contain"
            />
            <Text style={[styles.typeButtonText, contentType === 'bts' && styles.typeButtonTextActive]}>
              BTS Posts
            </Text>
          </Pressable>
          <Pressable
            style={[styles.typeButton, contentType === 'announcement' && styles.typeButtonActive]}
            onPress={() => setContentType('announcement')}
          >
            <ExpoImage
              source={require('@/assets/icons/bts-announcements/announcements.svg')}
              style={{ width: 20, height: 20 }}
              tintColor={contentType === 'announcement' ? Colors.gold : Colors.textMuted}
              contentFit="contain"
            />
            <Text style={[styles.typeButtonText, contentType === 'announcement' && styles.typeButtonTextActive]}>
              Announcements
            </Text>
          </Pressable>
          <Pressable
            style={[styles.typeButton, contentType === 'portfolio' && styles.typeButtonActive]}
            onPress={() => setContentType('portfolio')}
          >
            <ExpoImage
              source={require('@/assets/icons/bts-announcements/bts.svg')}
              style={{ width: 20, height: 20 }}
              tintColor={contentType === 'portfolio' ? Colors.gold : Colors.textMuted}
              contentFit="contain"
            />
            <Text style={[styles.typeButtonText, contentType === 'portfolio' && styles.typeButtonTextActive]}>
              Portfolio
            </Text>
          </Pressable>
        </View>

        {/* BTS Post Form */}
        {contentType === 'bts' && (
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Create BTS Post</Text>

            {/* Media Picker */}
            <Pressable style={styles.mediaPicker} onPress={() => pickMedia('bts')}>
              {btsPicked ? (
                <View style={styles.mediaPreview}>
                  {inferMediaType(btsPicked) === 'video' ? (
                    <Video
                      source={{ uri: btsPicked.uri }}
                      style={styles.mediaPreviewImage}
                      resizeMode={ResizeMode.COVER}
                      shouldPlay={false}
                      isMuted={true}
                    />
                  ) : (
                    <Image source={{ uri: btsPicked.uri }} style={styles.mediaPreviewImage} />
                  )}
                  <Pressable style={styles.removeMedia} onPress={() => setBtsPicked(null)}>
                    <X size={16} color="#fff" />
                  </Pressable>
                </View>
              ) : (
                <View style={styles.mediaPlaceholder}>
                  <Camera size={32} color={Colors.textMuted} />
                  <Text style={styles.mediaPlaceholderText}>Select Photo/Video</Text>
                </View>
              )}
            </Pressable>

            {/* Caption */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Caption</Text>
              <View style={styles.captionRow}>
                <TextInput
                  style={[styles.input, styles.captionInput]}
                  placeholder="Add an engaging caption..."
                  value={btsTitle}
                  onChangeText={setBtsTitle}
                  multiline
                  maxLength={220}
                />
                <Pressable onPress={generateCaption} style={styles.aiCaptionButton}>
                  <Sparkles size={12} color={Colors.gold} />
                  <Text style={styles.aiCaptionText}>AI Caption</Text>
                </Pressable>
              </View>
            </View>

            {/* Category */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                {CATEGORIES.map((cat) => (
                  <Pressable
                    key={cat}
                    style={[styles.categoryButton, btsCategory === cat && styles.categoryButtonActive]}
                    onPress={() => setBtsCategory(cat)}
                  >
                    <Text style={[styles.categoryButtonText, btsCategory === cat && styles.categoryButtonTextActive]}>
                      {cat}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Expiry */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Expires After (days)</Text>
              <TextInput
                style={styles.input}
                placeholder="7"
                value={btsExpiryDays}
                onChangeText={setBtsExpiryDays}
                keyboardType="numeric"
              />
            </View>

            {/* Schedule */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Schedule For (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD HH:MM"
                value={btsScheduledFor}
                onChangeText={setBtsScheduledFor}
              />
            </View>

            {/* Music */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Background Music (optional)</Text>
              <View style={styles.captionRow}>
                <TextInput
                  style={[styles.input, styles.captionInput]}
                  placeholder="Select music file..."
                  value={btsMusicFile?.name || ''}
                  editable={false}
                />
                <Pressable onPress={pickMusic} style={styles.aiCaptionButton}>
                  <Text style={styles.aiCaptionText}>Choose Music</Text>
                </Pressable>
              </View>
              {btsMusicFile && (
                <View style={{ alignItems: 'flex-end', marginTop: 8 }}>
                  <Pressable onPress={() => setBtsMusicFile(null)} style={styles.aiCaptionButton}>
                    <Text style={styles.aiCaptionText}>Clear</Text>
                  </Pressable>
                </View>
              )}
            </View>

            <Pressable
              style={[styles.uploadButton, posting && styles.uploadButtonDisabled]}
              onPress={uploadBtsPost}
              disabled={posting}
            >
              {posting ? (
                <View style={styles.uploadingContainer}>
                  <ActivityIndicator color="#000" size="small" />
                  <Text style={styles.uploadingText}>
                    {uploadStatus || 'Uploading...'}
                  </Text>
                </View>
              ) : (
                <Text style={styles.uploadButtonText}>Upload BTS Post</Text>
              )}
            </Pressable>
          </View>
        )}

        {/* Announcement Form */}
        {contentType === 'announcement' && (
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Create Announcement</Text>

            {/* Media Picker */}
            <Pressable style={styles.mediaPicker} onPress={() => pickMedia('announcement')}>
              {annPicked ? (
                <View style={styles.mediaPreview}>
                  {annMediaType === 'video' ? (
                    <Video
                      source={{ uri: annPicked.uri }}
                      style={styles.mediaPreviewImage}
                      resizeMode={ResizeMode.COVER}
                      shouldPlay={false}
                      isMuted={true}
                    />
                  ) : (
                    <Image source={{ uri: annPicked.uri }} style={styles.mediaPreviewImage} />
                  )}
                  <Pressable style={styles.removeMedia} onPress={() => setAnnPicked(null)}>
                    <X size={16} color="#fff" />
                  </Pressable>
                </View>
              ) : (
                <View style={styles.mediaPlaceholder}>
                  <ImageIcon size={32} color={Colors.textMuted} />
                  <Text style={styles.mediaPlaceholderText}>Select Photo/Video</Text>
                </View>
              )}
            </Pressable>

            {/* Title */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Title</Text>
              <View style={styles.captionRow}>
                <TextInput
                  style={[styles.input, styles.captionInput]}
                  placeholder="Announcement title..."
                  value={annTitle}
                  onChangeText={setAnnTitle}
                  maxLength={100}
                />
                <Pressable onPress={generateAnnouncementCaption} style={styles.aiCaptionButton}>
                  <Sparkles size={12} color={Colors.gold} />
                  <Text style={styles.aiCaptionText}>AI Title</Text>
                </Pressable>
              </View>
            </View>

            {/* Description */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Brief description..."
                value={annDescription}
                onChangeText={setAnnDescription}
                multiline
                maxLength={280}
              />
            </View>

            {/* Target Audience */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Target Audience</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                {AUDIENCE_OPTIONS.map((audience) => (
                  <Pressable
                    key={audience}
                    style={[
                      styles.categoryButton,
                      annTargetAudience.includes(audience) && styles.categoryButtonActive
                    ]}
                    onPress={() => {
                      setAnnTargetAudience(prev =>
                        prev.includes(audience)
                          ? prev.filter(a => a !== audience)
                          : [...prev, audience]
                      );
                    }}
                  >
                    <Text style={[
                      styles.categoryButtonText,
                      annTargetAudience.includes(audience) && styles.categoryButtonTextActive
                    ]}>
                      {audience}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Expiry */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Expires After (days)</Text>
              <TextInput
                style={styles.input}
                placeholder="30"
                value={annExpiryDays}
                onChangeText={setAnnExpiryDays}
                keyboardType="numeric"
              />
            </View>

            {/* Schedule */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Schedule For (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD HH:MM"
                value={annScheduledFor}
                onChangeText={setAnnScheduledFor}
              />
            </View>

            <Pressable
              style={[styles.uploadButton, posting && styles.uploadButtonDisabled]}
              onPress={uploadAnnouncement}
              disabled={posting}
            >
              {posting ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text style={styles.uploadButtonText}>Post Announcement</Text>
              )}
            </Pressable>
          </View>
        )}

        {/* Portfolio Form */}
        {contentType === 'portfolio' && (
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Upload Portfolio Item</Text>

            <Pressable
              style={styles.mediaPicker}
              onPress={() => pickMedia('portfolio')}
            >
              {portfolioPicked ? (
                <View style={styles.mediaPreview}>
                  <Image source={{ uri: portfolioPicked.uri }} style={styles.mediaPreviewImage} />
                  <Pressable style={styles.removeMedia} onPress={() => setPortfolioPicked(null)}>
                    <X size={16} color="#fff" />
                  </Pressable>
                </View>
              ) : (
                <View style={styles.mediaPlaceholder}>
                  <ImageIcon size={32} color={Colors.textMuted} />
                  <Text style={styles.mediaPlaceholderText}>Select Photo/Video</Text>
                </View>
              )}
            </Pressable>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Title</Text>
              <TextInput
                style={styles.input}
                placeholder="Portfolio item title"
                placeholderTextColor={Colors.textMuted}
                value={portfolioTitle}
                onChangeText={setPortfolioTitle}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Brief description..."
                placeholderTextColor={Colors.textMuted}
                value={portfolioDescription}
                onChangeText={setPortfolioDescription}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Category</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Wedding, Portrait, Corporate"
                placeholderTextColor={Colors.textMuted}
                value={portfolioCategory}
                onChangeText={setPortfolioCategory}
              />
            </View>

            {/* Featured Checkbox */}
            <View style={styles.inputGroup}>
              <View style={styles.checkboxRow}>
                <Pressable
                  style={styles.checkbox}
                  onPress={() => setPortfolioFeatured(!portfolioFeatured)}
                >
                  <View style={[styles.checkboxBox, portfolioFeatured && styles.checkboxBoxChecked]}>
                    {portfolioFeatured && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                </Pressable>
                <Text style={styles.checkboxLabel}>Feature in portfolio showcase</Text>
              </View>
            </View>

            {/* Top Rated Checkbox */}
            <View style={styles.inputGroup}>
              <View style={styles.checkboxRow}>
                <Pressable
                  style={styles.checkbox}
                  onPress={() => setPortfolioTopRated(!portfolioTopRated)}
                >
                  <View style={[styles.checkboxBox, portfolioTopRated && styles.checkboxBoxChecked]}>
                    {portfolioTopRated && <Text style={styles.checkmark}>⭐</Text>}
                  </View>
                </Pressable>
                <Text style={styles.checkboxLabel}>Mark as Top Rated</Text>
              </View>
            </View>

            {/* Preview Button */}
            {portfolioPicked && portfolioTitle.trim() && (
              <Pressable
                style={styles.previewButton}
                onPress={() => setShowPortfolioPreview(!showPortfolioPreview)}
              >
                <Text style={styles.previewButtonText}>
                  {showPortfolioPreview ? 'Hide Preview' : '👁️ Show Preview'}
                </Text>
              </Pressable>
            )}

            {/* Preview Section */}
            {showPortfolioPreview && portfolioPicked && (
              <View style={styles.previewContainer}>
                <Text style={styles.previewTitle}>Preview - As it will appear in client gallery</Text>
                <View style={styles.portfolioPreviewCard}>
                  <Image
                    source={{ uri: portfolioPicked.uri }}
                    style={styles.portfolioPreviewImage}
                  />
                  {(portfolioFeatured || portfolioTopRated) && (
                    <View style={styles.featuredBadge}>
                      <Text style={styles.featuredBadgeText}>
                        {portfolioTopRated ? '⭐ Top Rated' : '⭐ Featured'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.portfolioPreviewContent}>
                    <Text style={styles.portfolioPreviewTitleText} numberOfLines={2}>{portfolioTitle}</Text>
                    {portfolioCategory && (
                      <Text style={styles.portfolioPreviewCategory}>{portfolioCategory}</Text>
                    )}
                    {portfolioDescription && (
                      <Text style={styles.portfolioPreviewDescription} numberOfLines={2}>{portfolioDescription}</Text>
                    )}
                  </View>
                </View>
              </View>
            )}

            <Pressable
              style={[styles.uploadButton, posting && styles.uploadButtonDisabled]}
              onPress={uploadPortfolio}
              disabled={posting}
            >
              {posting ? (
                <View style={styles.uploadingContainer}>
                  <ActivityIndicator color="#000" size="small" />
                  <Text style={styles.uploadingText}>
                    {uploadStatus || 'Uploading...'}
                  </Text>
                </View>
              ) : (
                <Text style={styles.uploadButtonText}>Upload to Portfolio</Text>
              )}
            </Pressable>
          </View>
        )}

        {/* Content List */}
        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>Recent Content</Text>

          <SectionList<SectionItem, SectionData>
            sections={sections}
            keyExtractor={(item) => item.id}
            renderItem={({ item, section }) => (
              <Pressable 
                style={styles.contentCard} 
                onPress={() => {
                  router.push({
                    pathname: '/(admin)/post-details/[id]',
                    params: { 
                      id: item.id,
                      type: section.type 
                    }
                  } as any);
                }}
              >
                {section.type === 'bts' ? (
                  <>
                    <Image source={{ uri: (item as BTSPost).media_url }} style={styles.contentImage} />
                    <View style={styles.contentInfo}>
                      <Text style={styles.contentTitle} numberOfLines={1}>{(item as BTSPost).title}</Text>
                      <Text style={styles.contentMeta}>{(item as BTSPost).category} • {new Date((item as BTSPost).created_at).toLocaleDateString()}</Text>
                      <View style={styles.engagementRow}>
                        <View style={styles.statChip}>
                          <Heart size={10} color={Colors.error} />
                          <Text style={styles.statChipText}>{(item as any).likes_count || 0}</Text>
                        </View>
                        <View style={styles.statChip}>
                          <MessageCircle size={10} color={Colors.gold} />
                          <Text style={styles.statChipText}>{(item as any).comments_count || 0}</Text>
                        </View>
                        <View style={styles.statChip}>
                          <Eye size={10} color="#60A5FA" />
                          <Text style={styles.statChipText}>{(item as any).views_count || 0}</Text>
                        </View>
                      </View>
                      <View style={styles.analyticsHint}>
                        <BarChart2 size={10} color={Colors.gold} />
                        <Text style={styles.analyticsHintText}>View Analytics</Text>
                      </View>
                    </View>
                  </>
                ) : section.type === 'announcement' ? (
                  <>
                    <Image source={{ uri: (item as AnnouncementRow).media_url || (item as AnnouncementRow).image_url || '' }} style={styles.contentImage} />
                    <View style={styles.contentInfo}>
                      <Text style={styles.contentTitle} numberOfLines={1}>{(item as AnnouncementRow).title}</Text>
                      <Text style={styles.contentMeta} numberOfLines={1}>{(item as AnnouncementRow).description || 'No description'}</Text>
                      <View style={styles.engagementRow}>
                        <View style={styles.statChip}>
                          <Heart size={10} color={Colors.error} />
                          <Text style={styles.statChipText}>{(item as any).likes_count || 0}</Text>
                        </View>
                        <View style={styles.statChip}>
                          <MessageCircle size={10} color={Colors.gold} />
                          <Text style={styles.statChipText}>{(item as any).comments_count || 0}</Text>
                        </View>
                      </View>
                      <View style={styles.analyticsHint}>
                        <BarChart2 size={10} color={Colors.gold} />
                        <Text style={styles.analyticsHintText}>View Analytics & Comments</Text>
                      </View>
                    </View>
                  </>
                ) : section.type === 'portfolio' ? (
                  <>
                    <Image source={{ uri: (item as PortfolioItem).media_url }} style={styles.contentImage} />
                    <View style={styles.contentInfo}>
                      <Text style={styles.contentTitle} numberOfLines={1}>{(item as PortfolioItem).title}</Text>
                      <Text style={styles.contentMeta}>{(item as PortfolioItem).category || 'Portfolio'} • {new Date((item as PortfolioItem).created_at).toLocaleDateString()}</Text>
                      {((item as PortfolioItem).is_featured || (item as PortfolioItem).is_top_rated) && (
                        <Text style={styles.contentBadge}>
                          {(item as PortfolioItem).is_featured ? '⭐ Featured' : '⭐ Top Rated'}
                        </Text>
                      )}
                    </View>
                  </>
                ) : null}
                {/* Tappable arrow */}
                <ChevronRight size={18} color={Colors.textMuted} style={{ marginLeft: 4 }} />
              </Pressable>
            )}
            renderSectionHeader={({ section }) => (
              <Text style={styles.sectionHeader}>{section.title}</Text>
            )}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  typeSelector: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 8,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeButtonActive: {
    backgroundColor: Colors.gold + '15',
    borderColor: Colors.gold,
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  typeButtonTextActive: {
    color: Colors.gold,
  },
  referralCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
    backgroundColor: 'rgba(59,130,246,0.03)',
  },
  referralGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  referralIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(59,130,246,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  referralInfo: {
    flex: 1,
  },
  referralTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3B82F6',
    marginBottom: 2,
  },
  referralDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    opacity: 0.9,
  },
  referralCta: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  referralCtaText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
  formSection: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  mediaPicker: {
    marginBottom: 16,
  },
  mediaPreview: {
    position: 'relative',
  },
  mediaPreviewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: Colors.card,
  },
  removeMedia: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 16,
    padding: 4,
  },
  mediaPlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  mediaPlaceholderText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  captionRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  captionInput: {
    flex: 1,
    minHeight: 60,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  aiCaptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
    backgroundColor: Colors.gold + '15',
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  aiCaptionText: {
    fontSize: 10,
    color: Colors.gold,
    fontWeight: '600',
  },
  categoryScroll: {
    flexGrow: 0,
    marginHorizontal: -4,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    marginHorizontal: 4,
  },
  categoryButtonActive: {
    backgroundColor: Colors.gold + '15',
    borderColor: Colors.gold,
  },
  categoryButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textMuted,
  },
  categoryButtonTextActive: {
    color: Colors.gold,
  },
  switchGroup: {
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
  uploadButton: {
    backgroundColor: Colors.gold,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  listSection: {
    padding: 20,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 12,
    marginTop: 8,
  },
  contentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.card,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  contentImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: Colors.border,
    resizeMode: 'cover',
  },
  contentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  contentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  contentMeta: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  contentBadge: {
    fontSize: 10,
    color: Colors.gold,
    fontWeight: '600' as const,
    marginTop: 2,
    textTransform: 'uppercase' as const,
  },
  contentDate: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  previewButton: {
    backgroundColor: Colors.gold + '25',
    borderWidth: 1,
    borderColor: Colors.gold,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  previewButtonText: {
    color: Colors.gold,
    fontSize: 14,
    fontWeight: '600',
  },
  previewContainer: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  previewTitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  portfolioPreviewCard: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  portfolioPreviewImage: {
    width: '100%',
    height: 180,
    backgroundColor: Colors.card,
  },
  portfolioPreviewContent: {
    padding: 12,
  },
  portfolioPreviewTitleText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  portfolioPreviewCategory: {
    fontSize: 12,
    color: Colors.gold,
    fontWeight: '600',
    marginBottom: 8,
  },
  portfolioPreviewDescription: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  featuredBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: Colors.gold,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  featuredBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    padding: 4,
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxBoxChecked: {
    backgroundColor: Colors.gold + '25',
    borderColor: Colors.gold,
  },
  checkmark: {
    fontSize: 14,
    color: Colors.gold,
    fontWeight: '700',
  },
  checkboxLabel: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadingText: {
    fontSize: 14,
    color: '#000',
    fontWeight: '500',
  },
  engagementRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginBottom: 2,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statChipText: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  analyticsHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  analyticsHintText: {
    fontSize: 10,
    color: Colors.gold,
    fontWeight: '600',
  },
});
