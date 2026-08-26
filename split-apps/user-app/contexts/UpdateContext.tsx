import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { UpdateService } from '../lib/update-service';
import type {
  UpdateCheckStatus,
  VersionInfo,
  UpdateError,
  UpdateProvider,
} from '../types/update';

// ─── Storage keys ────────────────────────────────────────────────────────────

const STORAGE_KEYS = {
  LAST_CHECK_TS: '@update_last_check_ts',
  LAST_DISMISSED_VERSION: '@update_last_dismissed_version',
  LAST_DISMISSED_TS: '@update_last_dismissed_ts',
  SKIP_VERSIONS: '@update_skip_versions',
} as const;

// ─── Config ──────────────────────────────────────────────────────────────────

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const NAG_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours after "Later"
const CHECK_ON_FOREGROUND_COOLDOWN_MS = 30 * 60 * 1000; // 30 min between foreground checks

// ─── Context ─────────────────────────────────────────────────────────────────

interface UpdateContextValue {
  /** Current status of the update check */
  status: UpdateCheckStatus;
  /** Version info if an update is available */
  versionInfo: VersionInfo | null;
  /** Error details if the check failed */
  error: UpdateError | null;
  /** Whether the app is blocked (force update) */
  isBlocked: boolean;
  /** Whether the update dialog is visible */
  showDialog: boolean;
  /** Manually trigger a check for updates */
  checkForUpdate: (force?: boolean) => Promise<void>;
  /** User tapped "Update Now" — opens download URL */
  applyUpdate: () => void;
  /** User tapped "Later" — dismiss and set nag cooldown */
  dismissUpdate: () => void;
  /** Permanently skip a specific version */
  skipVersion: (version: string) => void;
  /** The installed app version string */
  installedVersion: string;
}

const UpdateContext = createContext<UpdateContextValue | undefined>(undefined);

// ─── Provider ────────────────────────────────────────────────────────────────

export function UpdateProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<UpdateCheckStatus>('idle');
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [error, setError] = useState<UpdateError | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  const installedVersion = UpdateService.getInstalledVersion().version;
  const appState = useRef(AppState.currentState);
  const lastForegroundCheck = useRef(0);
  const hasInitialized = useRef(false);

  // ── Helpers ────────────────────────────────────────────────────────────

  const shouldSkipVersion = useCallback(async (version: string): Promise<boolean> => {
    try {
      // Check if this version was dismissed
      const dismissedVersion = await AsyncStorage.getItem(STORAGE_KEYS.LAST_DISMISSED_VERSION);
      if (dismissedVersion === version) {
        const dismissedTs = await AsyncStorage.getItem(STORAGE_KEYS.LAST_DISMISSED_TS);
        if (dismissedTs) {
          const elapsed = Date.now() - Number(dismissedTs);
          if (elapsed < NAG_COOLDOWN_MS) return true;
        }
      }
      // Check if permanently skipped
      const skipRaw = await AsyncStorage.getItem(STORAGE_KEYS.SKIP_VERSIONS);
      if (skipRaw) {
        const skipped: string[] = JSON.parse(skipRaw);
        if (skipped.includes(version)) return true;
      }
    } catch { /* ignore storage errors */ }
    return false;
  }, []);

  const recordCheck = useCallback(async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_CHECK_TS, Date.now().toString());
    } catch { /* ignore */ }
  }, []);

  // ── Core check ─────────────────────────────────────────────────────────

  const checkForUpdate = useCallback(
    async (force = false) => {
      // Don't re-check if already showing a force update
      if (isBlocked && !force) return;

      // Rate-limit: don't check more than once per 30 minutes (unless forced)
      if (!force) {
        const lastCheck = await AsyncStorage.getItem(STORAGE_KEYS.LAST_CHECK_TS);
        if (lastCheck) {
          const elapsed = Date.now() - Number(lastCheck);
          if (elapsed < CHECK_INTERVAL_MS && elapsed > 0) {
            // Only skip if within cooldown AND not our first check
            if (hasInitialized.current && elapsed < CHECK_ON_FOREGROUND_COOLDOWN_MS) {
              return;
            }
          }
        }
      }

      // Check network
      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        setStatus('offline');
        return;
      }

      setStatus('checking');
      setError(null);

      const result = await UpdateService.checkForUpdate('apk-direct');
      await recordCheck();

      if (result.status === 'error') {
        setStatus('error');
        setError(result.error ?? null);
        return;
      }

      if (result.status === 'up-to-date') {
        setStatus('up-to-date');
        setVersionInfo(result.versionInfo ?? null);
        return;
      }

      // Update available or force-update
      const info = result.versionInfo;
      if (!info) {
        setStatus('up-to-date');
        return;
      }

      // Should we skip this version?
      if (await shouldSkipVersion(info.latestVersion)) {
        setStatus('up-to-date');
        setVersionInfo(info);
        return;
      }

      setVersionInfo(info);

      if (result.status === 'force-update') {
        setStatus('force-update');
        setIsBlocked(true);
        setShowDialog(true);
      } else {
        setStatus('update-available');
        setShowDialog(true);
      }
    },
    [isBlocked, recordCheck, shouldSkipVersion]
  );

  // ── Actions ────────────────────────────────────────────────────────────

  const applyUpdate = useCallback(() => {
    if (versionInfo?.downloadUrl) {
      // Open the download page — handled by the component using Linking
      setShowDialog(false);
    }
  }, [versionInfo]);

  const dismissUpdate = useCallback(async () => {
    setShowDialog(false);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_DISMISSED_VERSION, versionInfo?.latestVersion ?? '');
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_DISMISSED_TS, Date.now().toString());
    } catch { /* ignore */ }
  }, [versionInfo]);

  const skipVersion = useCallback(async (version: string) => {
    setShowDialog(false);
    setIsBlocked(false);
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.SKIP_VERSIONS);
      const skipped: string[] = raw ? JSON.parse(raw) : [];
      if (!skipped.includes(version)) {
        skipped.push(version);
        await AsyncStorage.setItem(STORAGE_KEYS.SKIP_VERSIONS, JSON.stringify(skipped));
      }
    } catch { /* ignore */ }
  }, []);

  // ── Startup check ──────────────────────────────────────────────────────

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // Check after a short delay to let splash screen settle
    const timer = setTimeout(() => {
      checkForUpdate();
    }, 3000);

    return () => clearTimeout(timer);
  }, [checkForUpdate]);

  // ── Foreground check ───────────────────────────────────────────────────

  useEffect(() => {
    const handleAppState = (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        const now = Date.now();
        if (now - lastForegroundCheck.current > CHECK_ON_FOREGROUND_COOLDOWN_MS) {
          lastForegroundCheck.current = now;
          checkForUpdate();
        }
      }
      appState.current = next;
    };

    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [checkForUpdate]);

  return (
    <UpdateContext.Provider
      value={{
        status,
        versionInfo,
        error,
        isBlocked,
        showDialog,
        checkForUpdate,
        applyUpdate,
        dismissUpdate,
        skipVersion,
        installedVersion,
      }}
    >
      {children}
    </UpdateContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useUpdate(): UpdateContextValue {
  const ctx = useContext(UpdateContext);
  if (!ctx) {
    throw new Error('useUpdate must be used within an UpdateProvider');
  }
  return ctx;
}
