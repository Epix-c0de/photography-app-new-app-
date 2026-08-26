/**
 * Update service — clean interface for fetching version info.
 *
 * Swap strategy:
 *   - APK direct: hits the Supabase Edge Function `check-version`
 *   - Play Store: swap `fetchVersionInfo` to call Play Developer API
 *   - Apple App Store: same swap, different endpoint
 *
 * The rest of the app only interacts with `UpdateService`.
 */

import { supabaseUrl } from './supabase';
import type {
  VersionInfo,
  UpdateCheckResult,
  UpdateCheckStatus,
  UpdateError,
  UpdateErrorCode,
  InstalledVersion,
  UpdateProvider,
} from '../types/update';
import Constants from 'expo-constants';

const VERSION_FUNCTION_URL = `${supabaseUrl}/functions/v1/check-version`;
const REQUEST_TIMEOUT_MS = 15_000;

// ─── Semantic version helpers ────────────────────────────────────────────────

export function parseSemver(version: string): [number, number, number] {
  const cleaned = version.replace(/^[vV]/, '');
  const parts = cleaned.split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    return [0, 0, 0];
  }
  return [parts[0], parts[1], parts[2]];
}

export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const [a1, a2, a3] = parseSemver(a);
  const [b1, b2, b3] = parseSemver(b);
  if (a1 !== b1) return a1 < b1 ? -1 : 1;
  if (a2 !== b2) return a2 < b2 ? -1 : 1;
  if (a3 !== b3) return a3 < b3 ? -1 : 1;
  return 0;
}

export function isVersionNewer(latest: string, current: string): boolean {
  return compareVersions(latest, current) === 1;
}

export function isVersionSupported(installed: string, minimum: string): boolean {
  return compareVersions(installed, minimum) >= 0;
}

// ─── Installed version ───────────────────────────────────────────────────────

export function getInstalledVersion(): InstalledVersion {
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const buildNumber =
    (Constants.expoConfig?.ios?.buildNumber
      ? Number(Constants.expoConfig.ios.buildNumber)
      : undefined) ??
    (Constants.expoConfig?.android?.versionCode as number | undefined) ??
    1;
  return { version, buildNumber };
}

// ─── Error factories ─────────────────────────────────────────────────────────

function makeError(code: UpdateErrorCode, message: string): UpdateError {
  const friendlyMessages: Record<UpdateErrorCode, string> = {
    NETWORK_ERROR:
      "Can't reach the update server. Please check your internet connection and try again.",
    TIMEOUT:
      'The update check is taking too long. Please try again in a moment.',
    INVALID_JSON:
      'The update server returned an unexpected response. Please try again later.',
    SERVER_ERROR:
      'The update server is temporarily unavailable. Please try again later.',
    PARSE_ERROR:
      'The update information is invalid. Please try again later.',
    UNKNOWN:
      'Something went wrong while checking for updates. Please try again.',
  };
  return { code, message, friendlyMessage: friendlyMessages[code] };
}

// ─── Core fetch with timeout ─────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ─── Provider implementations ────────────────────────────────────────────────

async function fetchFromSupabaseFunction(): Promise<VersionInfo> {
  const res = await fetchWithTimeout(VERSION_FUNCTION_URL, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      apikey: Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    },
  });

  if (!res.ok) {
    throw makeError('SERVER_ERROR', `HTTP ${res.status}`);
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw makeError('INVALID_JSON', 'Response is not valid JSON');
  }

  const v = data as Record<string, unknown>;
  if (
    typeof v.latestVersion !== 'string' ||
    typeof v.minimumVersion !== 'string' ||
    typeof v.forceUpdate !== 'boolean' ||
    typeof v.releaseNotes !== 'string' ||
    typeof v.downloadUrl !== 'string'
  ) {
    throw makeError('PARSE_ERROR', 'Missing required fields in version response');
  }

  return {
    latestVersion: v.latestVersion,
    minimumVersion: v.minimumVersion,
    forceUpdate: v.forceUpdate,
    releaseNotes: v.releaseNotes,
    downloadUrl: v.downloadUrl,
    fileSize: typeof v.fileSize === 'string' ? v.fileSize : undefined,
    sha256: typeof v.sha256 === 'string' ? v.sha256 : undefined,
    provider: (typeof v.provider === 'string' ? v.provider : 'apk-direct') as UpdateProvider,
    publishedAt: typeof v.publishedAt === 'string' ? v.publishedAt : undefined,
    versionHistory: Array.isArray(v.versionHistory)
      ? (v.versionHistory as Array<Record<string, unknown>>).map((e) => ({
          version: String(e.version ?? ''),
          releaseNotes: String(e.releaseNotes ?? ''),
          publishedAt: String(e.publishedAt ?? ''),
          fileSize: typeof e.fileSize === 'string' ? e.fileSize : undefined,
        }))
      : undefined,
  };
}

// Future: Play Store implementation
// async function fetchFromPlayStore(): Promise<VersionInfo> { ... }

const PROVIDER_MAP: Record<UpdateProvider, () => Promise<VersionInfo>> = {
  'apk-direct': fetchFromSupabaseFunction,
  // 'play-store': fetchFromPlayStore,
  'apple-app-store': fetchFromSupabaseFunction,
};

// ─── Public API ──────────────────────────────────────────────────────────────

export const UpdateService = {
  /**
   * Fetch the latest version info from the configured provider.
   * Returns a typed result — never throws.
   */
  async fetchVersionInfo(
    provider: UpdateProvider = 'apk-direct'
  ): Promise<UpdateCheckResult> {
    try {
      const fetcher = PROVIDER_MAP[provider];
      if (!fetcher) {
        return {
          status: 'error',
          error: makeError('UNKNOWN', `Unknown provider: ${provider}`),
        };
      }
      const versionInfo = await fetcher();
      return { status: 'update-available', versionInfo };
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error) {
        return { status: 'error', error: error as UpdateError };
      }
      if (error instanceof TypeError && /network|fetch/i.test(error.message)) {
        return { status: 'error', error: makeError('NETWORK_ERROR', error.message) };
      }
      if (error instanceof DOMException && error.name === 'AbortError') {
        return { status: 'error', error: makeError('TIMEOUT', 'Request timed out') };
      }
      return {
        status: 'error',
        error: makeError('UNKNOWN', String(error)),
      };
    }
  },

  /**
   * Full update check: fetch version info, compare with installed version,
   * return a definitive status.
   */
  async checkForUpdate(
    provider: UpdateProvider = 'apk-direct'
  ): Promise<UpdateCheckResult> {
    const { version: installedVersion } = getInstalledVersion();
    const result = await UpdateService.fetchVersionInfo(provider);

    if (result.status === 'error') return result;
    if (!result.versionInfo) {
      return { status: 'error', error: makeError('PARSE_ERROR', 'No version info') };
    }

    const { latestVersion, minimumVersion, forceUpdate } = result.versionInfo;

    // Check minimum version support
    if (!isVersionSupported(installedVersion, minimumVersion)) {
      return {
        status: 'force-update',
        versionInfo: result.versionInfo,
      };
    }

    // Check if a newer version is available
    if (isVersionNewer(latestVersion, installedVersion)) {
      return {
        status: forceUpdate ? 'force-update' : 'update-available',
        versionInfo: result.versionInfo,
      };
    }

    return { status: 'up-to-date', versionInfo: result.versionInfo };
  },

  parseSemver,
  compareVersions,
  isVersionNewer,
  isVersionSupported,
  getInstalledVersion,
};
