import { supabase } from './supabase';

type FeatureFlag = {
  key: string;
  enabled: boolean;
  label: string;
  description: string | null;
  category: string;
};

let cachedFlags: FeatureFlag[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getFeatureFlags(): Promise<FeatureFlag[]> {
  const now = Date.now();
  if (cachedFlags && now - cacheTimestamp < CACHE_TTL) {
    return cachedFlags;
  }

  try {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('*')
      .order('category');

    if (error) throw error;

    cachedFlags = data || [];
    cacheTimestamp = now;
    return cachedFlags;
  } catch (error) {
    console.error('[FeatureFlags] Failed to fetch:', error);
    return cachedFlags || [];
  }
}

export async function isFeatureEnabled(key: string): Promise<boolean> {
  const flags = await getFeatureFlags();
  const flag = flags.find(f => f.key === key);
  return flag?.enabled ?? false;
}

export function clearFeatureFlagCache(): void {
  cachedFlags = null;
  cacheTimestamp = 0;
}
