import { supabase } from './supabase';

let cachedDomain: string | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch the platform domain from platform_settings table.
 * Cached for 5 minutes to avoid repeated DB calls.
 * Use this EVERYWHERE instead of hardcoding 'https://epixvisuals.co.ke'
 */
export async function getPlatformDomain(): Promise<string> {
  if (cachedDomain && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedDomain;
  }

  try {
    const { data } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'platform_domain')
      .single();

    if (data?.value) {
      cachedDomain = data.value;
      cacheTimestamp = Date.now();
      return data.value;
    }
  } catch (e) {
    console.warn('[PlatformConfig] Failed to fetch domain:', e);
  }

  return 'https://epixvisuals.co.ke';
}

/**
 * Fetch platform settings for app download links.
 */
export async function getAppLinks(): Promise<{
  androidLink: string;
  iosLink: string;
  appName: string;
}> {
  try {
    const { data } = await supabase
      .from('platform_settings')
      .select('key, value')
      .in('key', ['platform_app_android_link', 'platform_app_ios_link', 'platform_app_name']);

    if (data) {
      const map: Record<string, string> = {};
      data.forEach((r: any) => { map[r.key] = r.value || ''; });
      return {
        androidLink: map['platform_app_android_link'] || 'https://play.google.com/store',
        iosLink: map['platform_app_ios_link'] || 'https://apps.apple.com',
        appName: map['platform_app_name'] || 'Epix Visuals',
      };
    }
  } catch (e) {
    console.warn('[PlatformConfig] Failed to fetch app links:', e);
  }

  return {
    androidLink: 'https://play.google.com/store',
    iosLink: 'https://apps.apple.com',
    appName: 'Epix Visuals',
  };
}

/**
 * Generate a shareable announcement URL using the admin's domain from DB.
 */
export async function getAnnouncementShareUrl(announcementId: string, adminId?: string): Promise<string> {
  const domain = await getPlatformDomain();

  if (adminId) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('brand_name, business_name, photographer_code')
      .eq('id', adminId)
      .single();

    const slug = profile?.brand_name || profile?.business_name || 'studio';
    return `${domain}/${slug.toLowerCase().replace(/\s+/g, '-')}/announcement/${announcementId}`;
  }

  return `${domain}/announcement/${announcementId}`;
}

/**
 * Generate a shareable gallery URL using the admin's domain from DB.
 */
export async function getGalleryShareUrl(galleryId: string, accessCode?: string, adminId?: string): Promise<string> {
  const domain = await getPlatformDomain();

  if (adminId) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('brand_name, business_name, photographer_code')
      .eq('id', adminId)
      .single();

    const slug = profile?.brand_name || profile?.business_name || 'studio';
    let url = `${domain}/${slug.toLowerCase().replace(/\s+/g, '-')}/gallery/${galleryId}`;
    if (accessCode) url += `?code=${accessCode}`;
    return url;
  }

  let url = `${domain}/gallery/${galleryId}`;
  if (accessCode) url += `?code=${accessCode}`;
  return url;
}

/**
 * Generate a shareable BTS URL using the admin's domain from DB.
 */
export async function getBtsShareUrl(btsId: string, adminId?: string): Promise<string> {
  const domain = await getPlatformDomain();

  if (adminId) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('brand_name, business_name, photographer_code')
      .eq('id', adminId)
      .single();

    const slug = profile?.brand_name || profile?.business_name || 'studio';
    return `${domain}/${slug.toLowerCase().replace(/\s+/g, '-')}/bts/${btsId}`;
  }

  return `${domain}/bts/${btsId}`;
}

/**
 * Generate a referral share URL using the admin's domain from DB.
 */
export async function getReferralShareUrl(referralCode: string): Promise<string> {
  const domain = await getPlatformDomain();
  return `${domain}/signup?ref=${referralCode}`;
}
