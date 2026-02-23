import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Alert, ActivityIndicator, Switch, Image, KeyboardAvoidingView, Platform, SectionList } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { Camera, X, Sparkles, Image as ImageIcon, Megaphone } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/types/supabase';

type BTSPost = Database['public']['Tables']['bts_posts']['Row'];
type AnnouncementRow = Database['public']['Tables']['announcements']['Row'];
type BTSCategory = 'Wedding' | 'Portrait' | 'Corporate' | 'Event' | 'Other';

type SectionItem = BTSPost | AnnouncementRow;
type SectionData = { title: string; data: SectionItem[]; type: 'bts' | 'announcement' };

const CATEGORIES: BTSCategory[] = ['Wedding', 'Portrait', 'Corporate', 'Event', 'Other'];
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

type ContentType = 'bts' | 'announcement';

export default function AdminBtsAnnouncementsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, verifyAdminGuard } = useAuth();

  const [contentType, setContentType] = useState<ContentType>('bts');
  const [accessReady, setAccessReady] = useState(false);
  const [posting, setPosting] = useState(false);

  // BTS Form State
  const [btsPicked, setBtsPicked] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [btsTitle, setBtsTitle] = useState('');
  const [btsCategory, setBtsCategory] = useState<BTSCategory>('Wedding');
  const [btsExpiryDays, setBtsExpiryDays] = useState('7');
  const [btsScheduledFor, setBtsScheduledFor] = useState('');
  const [btsMusicEnabled, setBtsMusicEnabled] = useState(false);

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

  // Lists
  const [btsPosts, setBtsPosts] = useState<BTSPost[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);

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
      });

      if (!result.canceled && result.assets[0]) {
        if (forType === 'bts') {
          setBtsPicked(result.assets[0]);
        } else {
          setAnnPicked(result.assets[0]);
          setAnnMediaType(inferMediaType(result.assets[0]));
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick media');
    }
  }, []);

  const uploadBtsPost = useCallback(async () => {
    if (!btsPicked || !btsTitle.trim()) {
      Alert.alert('Error', 'Please select media and add a caption');
      return;
    }

    setPosting(true);
    try {
      const fileExt = getFileExtension(btsPicked);
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `bts/${fileName}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, {
          uri: btsPicked.uri,
          type: btsPicked.mimeType || 'image/jpeg',
          name: fileName,
        } as any);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      const expiresAtIso = daysToExpiryIso(Number(btsExpiryDays));
      const scheduledForIso = btsScheduledFor ? new Date(btsScheduledFor).toISOString() : null;

      const { error: insertError } = await supabase
        .from('bts_posts')
        .insert({
          title: btsTitle,
          media_url: publicUrl,
          media_type: inferMediaType(btsPicked),
          category: btsCategory,
          expires_at: expiresAtIso,
          scheduled_for: scheduledForIso,
          has_music: btsMusicEnabled,
          user_id: user?.id,
        });

      if (insertError) throw insertError;

      Alert.alert('Success', 'BTS post uploaded successfully!');
      setBtsPicked(null);
      setBtsTitle('');
      setBtsExpiryDays('7');
      setBtsScheduledFor('');
      setBtsMusicEnabled(false);
      loadBtsPosts();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to upload post');
    } finally {
      setPosting(false);
    }
  }, [btsPicked, btsTitle, btsCategory, btsExpiryDays, btsScheduledFor, btsMusicEnabled, user]);

  const uploadAnnouncement = useCallback(async () => {
    if (!annPicked || !annTitle.trim()) {
      Alert.alert('Error', 'Please select media and add a title');
      return;
    }

    setPosting(true);
    try {
      const fileExt = getFileExtension(annPicked);
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `announcements/${fileName}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, {
          uri: annPicked.uri,
          type: annPicked.mimeType || 'image/jpeg',
          name: fileName,
        } as any);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      const expiresAtIso = daysToExpiryIso(Number(annExpiryDays));
      const scheduledForIso = annScheduledFor ? new Date(annScheduledFor).toISOString() : null;

      const { error: insertError } = await supabase
        .from('announcements')
        .insert({
          title: annTitle,
          description: annDescription,
          content_html: annContentHtml,
          media_url: publicUrl,
          media_type: annMediaType,
          category: annCategory,
          tag: annTag,
          expires_at: expiresAtIso,
          scheduled_for: scheduledForIso,
          target_audience: annTargetAudience,
          user_id: user?.id,
        });

      if (insertError) throw insertError;

      Alert.alert('Success', 'Announcement posted successfully!');
      setAnnPicked(null);
      setAnnTitle('');
      setAnnDescription('');
      setAnnContentHtml('');
      setAnnCategory('');
      setAnnTag('');
      setAnnExpiryDays('30');
      setAnnScheduledFor('');
      setAnnTargetAudience([]);
      loadAnnouncements();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to post announcement');
    } finally {
      setPosting(false);
    }
  }, [annPicked, annTitle, annDescription, annContentHtml, annCategory, annTag, annExpiryDays, annScheduledFor, annTargetAudience, annMediaType, user]);

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
    })();
  }, [router, verifyAdminGuard, loadBtsPosts, loadAnnouncements]);

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
            <View style={styles.switchGroup}>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Enable Background Music</Text>
                <Switch
                  value={btsMusicEnabled}
                  onValueChange={setBtsMusicEnabled}
                  trackColor={{ false: Colors.border, true: Colors.gold + '80' }}
                  thumbColor={btsMusicEnabled ? Colors.gold : '#f4f3f4'}
                />
              </View>
            </View>

            <Pressable
              style={[styles.uploadButton, posting && styles.uploadButtonDisabled]}
              onPress={uploadBtsPost}
              disabled={posting}
            >
              {posting ? (
                <ActivityIndicator color="#000" size="small" />
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

        {/* Content List */}
        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>Recent Content</Text>
          
          <SectionList<SectionItem, SectionData>
            sections={sections}
            keyExtractor={(item) => item.id}
            renderItem={({ item, section }) => (
              <View style={styles.contentCard}>
                {section.type === 'bts' ? (
                  <>
                    <Image source={{ uri: (item as BTSPost).media_url }} style={styles.contentImage} />
                    <View style={styles.contentInfo}>
                      <Text style={styles.contentTitle} numberOfLines={1}>{(item as BTSPost).title}</Text>
                      <Text style={styles.contentMeta}>{(item as BTSPost).category} • {new Date((item as BTSPost).created_at).toLocaleDateString()}</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <Image source={{ uri: (item as AnnouncementRow).media_url || (item as AnnouncementRow).image_url || '' }} style={styles.contentImage} />
                    <View style={styles.contentInfo}>
                      <Text style={styles.contentTitle} numberOfLines={1}>{(item as AnnouncementRow).title}</Text>
                      <Text style={styles.contentMeta} numberOfLines={1}>{(item as AnnouncementRow).description || 'No description'}</Text>
                      <Text style={styles.contentDate}>{new Date((item as AnnouncementRow).created_at).toLocaleDateString()}</Text>
                    </View>
                  </>
                )}
              </View>
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
    padding: 12,
    backgroundColor: Colors.card,
    borderRadius: 8,
    marginBottom: 8,
  },
  contentImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: Colors.border,
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
  contentDate: {
    fontSize: 11,
    color: Colors.textMuted,
  },
});
