import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from '@/types/supabase';
import {
  announcements as mockAnnouncements,
  bookings as mockBookings,
  chatMessages as mockChatMessages,
  galleries as mockGalleries,
  galleryPhotos as mockGalleryPhotos,
  notifications as mockNotifications,
  packages as mockPackages,
  reviews as mockReviews,
  stories as mockStories,
} from '@/mocks/data';

export const DEMO_MODE_STORAGE_KEY = 'user_app_demo_mode_enabled';
export const isDemoModeEnvEnabled = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';

export async function isDemoModeEnabled() {
  return isDemoModeEnvEnabled || await getStoredDemoModeEnabled();
}

export async function getStoredDemoModeEnabled() {
  try {
    const value = await AsyncStorage.getItem(DEMO_MODE_STORAGE_KEY);
    return value === 'true';
  } catch {
    return false;
  }
}

export async function setStoredDemoModeEnabled(enabled: boolean) {
  try {
    if (enabled) {
      await AsyncStorage.setItem(DEMO_MODE_STORAGE_KEY, 'true');
      return;
    }
    await AsyncStorage.removeItem(DEMO_MODE_STORAGE_KEY);
  } catch {
    // Ignore storage issues in demo mode.
  }
}

const now = Date.now();
const isoDaysAgo = (daysAgo: number) => new Date(now - daysAgo * 24 * 60 * 60 * 1000).toISOString();

export const demoIds = {
  user: 'demo-user',
  admin: 'demo-admin',
  client: 'demo-client',
};

export const demoUser = {
  id: demoIds.user,
  email: 'demo@epixvisuals.app',
  user_metadata: {
    name: 'Demo Client',
    full_name: 'Demo Client',
  },
  app_metadata: {
    role: 'client',
  },
};

export const demoProfile: Database['public']['Tables']['user_profiles']['Row'] = {
  id: demoIds.user,
  role: 'client',
  name: 'Demo Client',
  phone: '+254700000000',
  email: 'demo@epixvisuals.app',
  avatar_url: mockReviews[0]?.avatar ?? null,
  phone_verified: true,
  pin_hash: null,
  biometric_enabled: false,
  client_type: 'premium',
  profile_complete: true,
  created_at: isoDaysAgo(120),
  updated_at: isoDaysAgo(1),
};

export const demoSession = {
  user: demoUser,
  access_token: 'demo-access-token',
  refresh_token: 'demo-refresh-token',
};

export const demoAnnouncements: Database['public']['Tables']['announcements']['Row'][] = mockAnnouncements.map((item, index) => ({
  id: item.id,
  title: item.title,
  description: item.description,
  content_html: `<p>${item.description}</p>`,
  image_url: item.image,
  media_url: item.image,
  media_type: 'image',
  tag: item.tag ?? null,
  category: 'promo',
  cta: item.cta,
  created_at: isoDaysAgo(index + 1),
  expires_at: null,
  scheduled_for: null,
  views_count: 10 + index * 4,
  clicks_count: 2 + index,
  target_audience: ['clients'],
  is_active: true,
  created_by: demoIds.admin,
  comments_count: 2,
}));

export const demoAnnouncementComments = {
  '1': [
    {
      id: 'ann-comment-1',
      announcement_id: '1',
      client_id: demoIds.user,
      comment: 'This offer looks amazing.',
      created_at: isoDaysAgo(0),
      user_profiles: { name: 'Demo Client', avatar_url: mockReviews[0]?.avatar ?? null },
      replies: [],
    },
  ],
} as Record<string, any[]>;

export const demoBtsPosts: Database['public']['Tables']['bts_posts']['Row'][] = mockStories.map((item, index) => ({
  id: item.id,
  title: item.title,
  media_url: item.image,
  image_url: item.image,
  media_type: 'image',
  category: item.type,
  created_at: isoDaysAgo(index + 1),
  expires_at: null,
  scheduled_for: null,
  has_music: false,
  music_url: null,
  views_count: 24 + index * 5,
  clicks_count: 2 + index,
  target_audience: ['clients'],
  is_active: true,
  shoot_type: item.type,
  created_by: demoIds.admin,
  likes_count: 5 + index * 3,
  comments_count: 1 + (index % 3),
}));

export const demoBtsComments = {
  '1': [
    {
      id: 'bts-comment-1',
      user_name: 'Demo Client',
      user_avatar: mockReviews[0]?.avatar ?? undefined,
      comment: 'Love seeing the process behind this shoot.',
      created_at: isoDaysAgo(0),
    },
  ],
} as Record<string, any[]>;

export const demoGalleries: Database['public']['Tables']['galleries']['Row'][] = mockGalleries.map((item, index) => ({
  id: item.id,
  owner_admin_id: demoIds.admin,
  client_id: demoIds.client,
  name: item.title,
  cover_photo_url: item.coverImage,
  access_code: `DEMO${index + 1}`,
  is_paid: !item.isLocked,
  is_locked: item.isLocked,
  price: item.price ?? 0,
  shoot_type: item.type,
  scheduled_release: item.date,
  created_at: isoDaysAgo(index + 10),
}));

export const demoGalleryPhotosByGalleryId = demoGalleries.reduce<Record<string, any[]>>((acc, gallery, galleryIndex) => {
  acc[gallery.id] = mockGalleryPhotos.slice(0, 8).map((photo, photoIndex) => ({
    id: `${gallery.id}-photo-${photo.id}`,
    gallery_id: gallery.id,
    photo_url: photo.uri,
    file_name: `demo-${galleryIndex + 1}-${photoIndex + 1}.jpg`,
    file_size: 1024,
    mime_type: 'image/jpeg',
    width: photo.width,
    height: photo.height,
    is_watermarked: photo.isWatermarked,
    upload_order: photoIndex,
    created_at: isoDaysAgo(photoIndex + 1),
    updated_at: isoDaysAgo(photoIndex + 1),
    url: photo.uri,
    thumbnailUrl: photo.uri,
    variant: photo.isWatermarked ? 'watermarked' : 'clean',
  }));
  return acc;
}, {});

export const demoPackages = mockPackages.map((item, index) => ({
  id: item.id,
  owner_admin_id: demoIds.admin,
  name: item.name,
  price: item.price,
  sms_included: 0,
  storage_limit_gb: 10,
  features: item.features,
  is_active: true,
  created_at: isoDaysAgo(index + 30),
  updated_at: isoDaysAgo(index + 2),
  is_popular: item.popular ?? false,
  description: item.description,
  detailed_description: item.description,
  duration: item.duration,
  cover_image_url: demoAnnouncements[index % demoAnnouncements.length]?.image_url ?? null,
}));

export const demoPortfolioItems = [
  ...demoAnnouncements.map((item, index) => ({
    id: `portfolio-ann-${item.id}`,
    title: item.title,
    media_url: item.media_url ?? item.image_url ?? '',
    image_url: item.image_url,
    media_type: 'image' as const,
    category: item.tag,
    content_type: 'portfolio' as const,
    is_public: true,
    is_top_rated: index < 2,
    likes_count: 12 + index,
    shares_count: 3 + index,
    created_at: item.created_at,
    expires_at: null,
    created_by: demoIds.admin,
  })),
  ...demoBtsPosts.map((item, index) => ({
    id: `portfolio-bts-${item.id}`,
    title: item.title,
    media_url: item.media_url,
    image_url: item.image_url,
    media_type: item.media_type,
    category: item.category,
    content_type: 'bts' as const,
    is_public: true,
    is_top_rated: index === 0,
    likes_count: item.likes_count,
    shares_count: 2 + index,
    created_at: item.created_at,
    expires_at: item.expires_at,
    created_by: item.created_by,
  })),
];

export const demoBookings = mockBookings.map((item) => ({
  id: item.id,
  user_id: demoIds.user,
  package_id: demoPackages.find((pkg) => pkg.name.toLowerCase().includes(item.packageName.split(' ')[0].toLowerCase()))?.id ?? demoPackages[0]?.id ?? null,
  status: item.status,
  date: item.date,
  time: item.time,
  location: item.location,
  created_at: isoDaysAgo(14),
  packages: {
    name: item.packageName,
  },
}));

export const demoPayments: Database['public']['Tables']['payments']['Row'][] = [
  {
    id: 'payment-1',
    owner_admin_id: demoIds.admin,
    client_id: demoIds.client,
    gallery_id: demoGalleries[0]?.id ?? null,
    amount: 35000,
    currency: 'KES',
    status: 'paid',
    mpesa_receipt_number: 'DEMO12345',
    mpesa_checkout_request_id: 'demo-checkout-1',
    phone_number: '+254700000000',
    created_at: isoDaysAgo(12),
    updated_at: isoDaysAgo(12),
  },
  {
    id: 'payment-2',
    owner_admin_id: demoIds.admin,
    client_id: demoIds.client,
    gallery_id: demoGalleries[2]?.id ?? null,
    amount: 4500,
    currency: 'KES',
    status: 'pending',
    mpesa_receipt_number: null,
    mpesa_checkout_request_id: 'demo-checkout-2',
    phone_number: '+254700000000',
    created_at: isoDaysAgo(2),
    updated_at: isoDaysAgo(2),
  },
];

export const demoNotifications = mockNotifications.map((item, index) => ({
  id: item.id,
  user_id: demoIds.user,
  type: item.type,
  title: item.title,
  body: item.body,
  data: item.galleryId
    ? { galleryId: item.galleryId, accessCode: `DEMO${item.galleryId}` }
    : index === 3
      ? { announcementId: demoAnnouncements[0]?.id }
      : null,
  read: item.read,
  created_at: isoDaysAgo(index),
}));

export const demoMessages: Database['public']['Tables']['messages']['Row'][] = mockChatMessages.map((message, index) => ({
  id: message.id,
  owner_admin_id: demoIds.admin,
  client_id: demoIds.client,
  sender_role: message.sender === 'client' ? 'client' : 'admin',
  content: message.text,
  is_read: message.read,
  created_at: new Date(now - (mockChatMessages.length - index) * 5 * 60 * 1000).toISOString(),
}));

export const demoUnreadNotificationCount = demoNotifications.filter((item) => !item.read).length;
