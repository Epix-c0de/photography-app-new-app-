import { useState, useEffect, useCallback } from 'react';
import * as Updates from 'expo-updates';
import { AppState, AppStateStatus, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

const UPDATE_CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes
const LAST_CHECK_KEY = '@app_updates_last_check';

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';

interface AppUpdateState {
  status: UpdateStatus;
  isUpdateAvailable: boolean;
  isUpdatePending: boolean;
  manifest?: Updates.Manifest;
  error?: string;
}

export function useAppUpdates() {
  const [state, setState] = useState<AppUpdateState>({
    status: 'idle',
    isUpdateAvailable: false,
    isUpdatePending: false,
  });

  const [isOnline, setIsOnline] = useState(true);

  // Monitor network status
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? false);
    });

    return () => unsubscribe();
  }, []);

  // Check for updates
  const checkForUpdates = useCallback(async () => {
    if (!isOnline) {
      console.log('[Updates] Offline, skipping check');
      return;
    }

    try {
      setState(prev => ({ ...prev, status: 'checking' }));
      
      const update = await Updates.checkForUpdateAsync();
      
      if (update.isAvailable) {
        console.log('[Updates] New update available');
        setState({
          status: 'available',
          isUpdateAvailable: true,
          isUpdatePending: false,
          manifest: update.manifest,
        });
        
        // Auto-download the update
        await downloadUpdate();
      } else {
        console.log('[Updates] No updates available');
        setState({
          status: 'idle',
          isUpdateAvailable: false,
          isUpdatePending: false,
        });
      }
      
      // Save last check time
      await AsyncStorage.setItem(LAST_CHECK_KEY, Date.now().toString());
    } catch (error) {
      console.error('[Updates] Check failed:', error);
      setState({
        status: 'error',
        isUpdateAvailable: false,
        isUpdatePending: false,
        error: error instanceof Error ? error.message : 'Update check failed',
      });
    }
  }, [isOnline]);

  // Download update
  const downloadUpdate = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, status: 'downloading' }));
      
      await Updates.fetchUpdateAsync();
      
      console.log('[Updates] Download complete');
      setState({
        status: 'ready',
        isUpdateAvailable: false,
        isUpdatePending: true,
      });
    } catch (error) {
      console.error('[Updates] Download failed:', error);
      setState({
        status: 'error',
        isUpdateAvailable: false,
        isUpdatePending: false,
        error: error instanceof Error ? error.message : 'Download failed',
      });
    }
  }, []);

  // Apply update (reload app)
  const applyUpdate = useCallback(async () => {
    try {
      await Updates.reloadAsync();
    } catch (error) {
      console.error('[Updates] Reload failed:', error);
    }
  }, []);

  // Dismiss update (ignore this version)
  const dismissUpdate = useCallback(() => {
    setState({
      status: 'idle',
      isUpdateAvailable: false,
      isUpdatePending: false,
    });
  }, []);

  // Auto-check on mount and when app comes to foreground
  useEffect(() => {
    // Initial check after 3 seconds
    const initialTimer = setTimeout(() => {
      checkForUpdates();
    }, 3000);

    // Set up periodic checks
    const intervalTimer = setInterval(() => {
      checkForUpdates();
    }, UPDATE_CHECK_INTERVAL);

    // Check when app comes to foreground
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // Check if enough time has passed since last check
        const lastCheck = await AsyncStorage.getItem(LAST_CHECK_KEY);
        if (lastCheck) {
          const timeSinceLastCheck = Date.now() - parseInt(lastCheck, 10);
          if (timeSinceLastCheck > UPDATE_CHECK_INTERVAL) {
            checkForUpdates();
          }
        } else {
          checkForUpdates();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
      subscription.remove();
    };
  }, [checkForUpdates]);

  return {
    ...state,
    isOnline,
    checkForUpdates,
    downloadUpdate,
    applyUpdate,
    dismissUpdate,
  };
}
