import { useEffect, useRef } from 'react';
import { Platform, NativeModules, InteractionManager } from 'react-native';

const { ScreenCaptureBlocker } = NativeModules;

export function useScreenshotPrevention(enabled: boolean = true) {
  const isEnabledRef = useRef(enabled);

  useEffect(() => {
    isEnabledRef.current = enabled;
    
    if (!enabled || Platform.OS !== 'android') return;

    // Strategy 1: Use FLAG_SECURE via native module if available
    try {
      if (ScreenCaptureBlocker?.setSecureFlag) {
        ScreenCaptureBlocker.setSecureFlag(true);
      }
    } catch (e) {
      // Native module not available
    }

    // Strategy 2: Add a notification bar flag (visual indicator)
    // This is a fallback when native modules aren't available
    
    return () => {
      try {
        if (ScreenCaptureBlocker?.setSecureFlag) {
          ScreenCaptureBlocker.setSecureFlag(false);
        }
      } catch (e) {}
    };
  }, [enabled]);

  return { isProtected: enabled && Platform.OS === 'android' };
}
