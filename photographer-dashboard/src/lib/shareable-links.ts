import { supabase } from './supabase';

export interface ShareableLink {
  url: string;
  shortUrl?: string;
  qrCode?: string;
  deepLink?: string;
  whatsappLink?: string;
  smsLink?: string;
}

export interface BrandSettings {
  brand_name: string;
  brand_slug: string;
  custom_domain?: string;
  share_app_link: string;
}

// Cache domain from platform_settings
let cachedDomain: string | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function getPlatformDomain(): Promise<string> {
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
    console.warn('[ShareableLinks] Failed to fetch domain:', e);
  }

  return 'https://epixvisuals.co.ke';
}

/**
 * Generate branded shareable links for galleries, BTS posts, and announcements
 */
export async function generateShareableLink(
  type: 'gallery' | 'bts' | 'announcement' | 'portfolio',
  itemId: string,
  brandSettings: BrandSettings,
  options?: {
    accessCode?: string;
    expiryDays?: number;
    customSlug?: string;
  }
): Promise<ShareableLink> {
  // Fetch domain from DB instead of hardcoding
  const baseUrl = brandSettings.custom_domain || await getPlatformDomain();
  const brandSlug = brandSettings.brand_slug || brandSettings.brand_name.toLowerCase().replace(/\s+/g, '-');

  // Generate the canonical URL
  let canonicalUrl: string;
  let deepLink: string;

  switch (type) {
    case 'gallery':
      canonicalUrl = `${baseUrl}/${brandSlug}/gallery/${itemId}`;
      deepLink = `epix-visuals://gallery?id=${itemId}`;
      if (options?.accessCode) {
        canonicalUrl += `?code=${options.accessCode}`;
        deepLink += `&accessCode=${options.accessCode}`;
      }
      break;

    case 'bts':
      canonicalUrl = `${baseUrl}/${brandSlug}/bts/${itemId}`;
      deepLink = `epix-visuals://bts?id=${itemId}`;
      break;

    case 'announcement':
      canonicalUrl = `${baseUrl}/${brandSlug}/announcement/${itemId}`;
      deepLink = `epix-visuals://announcement?id=${itemId}`;
      break;

    case 'portfolio':
      canonicalUrl = `${baseUrl}/${brandSlug}/portfolio/${itemId}`;
      deepLink = `epix-visuals://portfolio?id=${itemId}`;
      break;

    default:
      canonicalUrl = baseUrl;
      deepLink = 'epix-visuals://';
  }

  // Generate short URL using a service (e.g., your own shortener or bit.ly)
  let shortUrl: string | undefined;
  try {
    const { data } = await supabase.functions.invoke('generate-short-url', {
      body: { url: canonicalUrl, brand_slug: brandSlug },
    });
    shortUrl = data?.shortUrl;
  } catch (e) {
    console.warn('Short URL generation failed:', e);
  }

  // Generate WhatsApp share link
  const whatsappText = generateShareText(type, itemId, canonicalUrl, brandSettings);
  const whatsappLink = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;

  // Generate SMS share link
  const smsText = generateShareText(type, itemId, canonicalUrl, brandSettings);
  const smsLink = `sms:?body=${encodeURIComponent(smsText)}`;

  return {
    url: canonicalUrl,
    shortUrl,
    deepLink,
    whatsappLink,
    smsLink,
  };
}

function generateShareText(
  type: string,
  itemId: string,
  url: string,
  brandSettings: BrandSettings
): string {
  const brandName = brandSettings.brand_name;

  switch (type) {
    case 'gallery':
      return `📸 Your photos from ${brandName} are ready!\n\nView and download your gallery:\n${url}\n\nThank you for choosing ${brandName}! 🎉`;

    case 'bts':
      return `🎬 Behind the scenes at ${brandName}!\n\nCheck out our latest work:\n${url}\n\n#${brandName.replace(/\s+/g, '')} #BTS`;

    case 'announcement':
      return `📢 Update from ${brandName}!\n\n${url}`;

    case 'portfolio':
      return `🖼 Check out ${brandName}'s portfolio:\n${url}\n\nBook your session today!`;

    default:
      return `Check out ${brandName}: ${url}`;
  }
}

/**
 * Generate a branded access code link for gallery unlock
 */
export async function generateAccessCodeLink(
  accessCode: string,
  brandSettings: BrandSettings
): Promise<string> {
  const baseUrl = brandSettings.custom_domain || await getPlatformDomain();
  const brandSlug = brandSettings.brand_slug || brandSettings.brand_name.toLowerCase().replace(/\s+/g, '-');
  return `${baseUrl}/${brandSlug}/unlock?code=${accessCode}`;
}

/**
 * Get deep link for opening in app
 */
export function getDeepLink(type: string, itemId: string, params?: Record<string, string>): string {
  let deepLink = `epix-visuals://${type}?id=${itemId}`;

  if (params) {
    const queryString = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    deepLink += `&${queryString}`;
  }

  return deepLink;
}

/**
 * Copy to clipboard with fallback
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    return true;
  } catch (e) {
    console.error('Copy failed:', e);
    return false;
  }
}

/**
 * Share via Web Share API (mobile)
 */
export async function shareViaNative(
  title: string,
  text: string,
  url: string
): Promise<boolean> {
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url });
      return true;
    }
    return false;
  } catch (e) {
    console.error('Share failed:', e);
    return false;
  }
}
