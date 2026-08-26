/**
 * Type-safe models for the in-app update system.
 *
 * Designed so the `provider` field can later be swapped from
 * 'apk-direct' to 'play-store' without touching the UI layer.
 */

export type UpdateProvider = 'apk-direct' | 'play-store' | 'apple-app-store';

export type UpdateSeverity = 'optional' | 'force';

export interface VersionInfo {
  /** Latest version available on the server (semver string) */
  latestVersion: string;
  /** Minimum version the server still supports */
  minimumVersion: string;
  /** If true, block app access until the user updates */
  forceUpdate: boolean;
  /** What's new in this release */
  releaseNotes: string;
  /** Direct download URL for the APK (or store listing URL) */
  downloadUrl: string;
  /** Human-readable file size, e.g. "24.5 MB" */
  fileSize?: string;
  /** SHA-256 checksum of the APK for integrity verification */
  sha256?: string;
  /** Which distribution channel */
  provider: UpdateProvider;
  /** ISO timestamp of when this version was published */
  publishedAt?: string;
  /** Previous versions for changelog display */
  versionHistory?: VersionHistoryEntry[];
}

export interface VersionHistoryEntry {
  version: string;
  releaseNotes: string;
  publishedAt: string;
  fileSize?: string;
}

export type UpdateCheckStatus =
  | 'idle'
  | 'checking'
  | 'update-available'
  | 'force-update'
  | 'up-to-date'
  | 'error'
  | 'offline';

export interface UpdateCheckResult {
  status: UpdateCheckStatus;
  versionInfo?: VersionInfo;
  error?: UpdateError;
}

export interface UpdateError {
  code: UpdateErrorCode;
  message: string;
  /** User-friendly message shown in the UI */
  friendlyMessage: string;
}

export type UpdateErrorCode =
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'INVALID_JSON'
  | 'SERVER_ERROR'
  | 'PARSE_ERROR'
  | 'UNKNOWN';

/**
 * Snapshot of the installed app version.
 * Populated from Constants.expoConfig.version or expo-updates.
 */
export interface InstalledVersion {
  /** e.g. "1.0.0" */
  version: string;
  /** e.g. 3 (the integer build number from expo-const) */
  buildNumber: number;
}
