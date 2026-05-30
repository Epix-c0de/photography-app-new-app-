import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const [status, setStatus] = useState('Processing authentication...');
  const { url, provider, access_token, refresh_token, code, error, error_description, type, next } = useLocalSearchParams<{
    url?: string;
    provider?: string;
    access_token?: string;
    refresh_token?: string;
    code?: string;
    error?: string;
    error_description?: string;
    type?: string;
    next?: string;
  }>();

  useEffect(() => {
    async function handleAuthCallback() {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      
      try {
        console.log('[Auth Callback] Started');
        console.log('[Auth Callback] Params:', { 
          hasUrl: !!url,
          provider,
          hasAccessToken: !!access_token,
          hasRefreshToken: !!refresh_token,
          hasCode: !!code,
          error,
        });

        // Set a timeout for the entire process
        timeoutId = setTimeout(() => {
          console.error('[Auth Callback] Timeout after 30 seconds');
          setStatus('Authentication timeout');
          setTimeout(() => {
            Alert.alert('Authentication Timeout', 'Sign-in took too long. Please try again.', [
              {
                text: 'Go Back',
                onPress: () => router.replace('/login'),
              }
            ]);
          }, 500);
        }, 30000); // 30 second timeout

        // Handle direct OAuth errors
        if (error) {
          if (timeoutId) clearTimeout(timeoutId);
          const errorMsg = error_description || error;
          console.error('[Auth Callback] OAuth error:', errorMsg);
          setStatus('Authentication failed');
          
          setTimeout(() => {
            Alert.alert('Authentication Failed', errorMsg, [
              {
                text: 'Go Back',
                onPress: () => router.replace('/login'),
              }
            ]);
          }, 500);
          return;
        }

        let finalAccessToken: string | undefined = access_token;
        let finalRefreshToken: string | undefined = refresh_token;
        let finalCode: string | undefined = code;
        let finalType: string | undefined = type;
        let finalNext: string | undefined = next;

        // If we have a URL parameter, extract tokens from it
        if (url && !access_token && !refresh_token) {
          console.log('[Auth Callback] Extracting tokens from URL');
          const extractParam = (urlStr: string, name: string): string | null => {
            try {
              // Try fragment first (standard OAuth)
              let regex = new RegExp(`[#&]${name}=([^&#]*)`);
              let match = regex.exec(urlStr);
              if (match) return decodeURIComponent(match[1]);
              
              // Try query string
              regex = new RegExp(`[?&]${name}=([^&#]*)`);
              match = regex.exec(urlStr);
              return match ? decodeURIComponent(match[1]) : null;
            } catch (e) {
              console.warn('[Auth Callback] Error extracting param:', name, e);
              return null;
            }
          };

          const urlSource: string = url ?? '';
          const at = extractParam(urlSource, 'access_token');
          const rt = extractParam(urlSource, 'refresh_token');
          const c = extractParam(urlSource, 'code');
          const t = extractParam(urlSource, 'type');
          const n = extractParam(urlSource, 'next');
          const oe = extractParam(urlSource, 'error');
          finalAccessToken = at || finalAccessToken;
          finalRefreshToken = rt || finalRefreshToken;
          finalCode = c || finalCode;
          finalType = t || finalType;
          finalNext = n || finalNext;
          const oauthError = oe;

          if (oauthError) {
            if (timeoutId) clearTimeout(timeoutId);
            const errorDesc = extractParam(urlSource, 'error_description');
            throw new Error(errorDesc || oauthError);
          }

          console.log('[Auth Callback] Extracted tokens:', { 
            hasAccessToken: !!finalAccessToken,
            hasRefreshToken: !!finalRefreshToken,
            hasCode: !!finalCode,
          });
        }

        if ((!finalAccessToken || !finalRefreshToken) && finalCode) {
          setStatus('Exchanging authorization code...');
          console.log('[Auth Callback] Exchanging authorization code for session');
          const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(finalCode);
          if (exchangeError) {
            throw exchangeError;
          }
          finalAccessToken = exchangeData?.session?.access_token ?? finalAccessToken;
          finalRefreshToken = exchangeData?.session?.refresh_token ?? finalRefreshToken;
        }

        if (finalAccessToken && finalRefreshToken) {
          setStatus('Establishing session...');
          console.log('[Auth Callback] Setting session with tokens');
          
          try {
            // Create AbortController for session setup with timeout
            const controller = new AbortController();
            const sessionTimeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for session setup
            
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: finalAccessToken,
              refresh_token: finalRefreshToken,
            });

            clearTimeout(sessionTimeoutId);

            if (sessionError) {
              console.error('[Auth Callback] Session error:', sessionError);
              throw sessionError;
            }

            console.log('[Auth Callback] Session set, verifying...');
            setStatus('Verifying session...');
            
            const { data: { session }, error: sessionCheckError } = await supabase.auth.getSession();
            
            if (sessionCheckError) {
              console.error('[Auth Callback] Session verification error:', sessionCheckError);
              throw sessionCheckError;
            }

            if (!session) {
              throw new Error('Session was not established properly');
            }

            if (timeoutId) clearTimeout(timeoutId);
            console.log('[Auth Callback] Session verified successfully, navigating');
            setStatus('Authentication successful!');

            if (finalType === 'recovery' || finalNext === 'forgot-password') {
              setTimeout(() => {
                router.replace('/forgot-password?mode=recovery');
              }, 500);
              return;
            }
            
            // Fetch profile to route correctly (admin vs client)
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('role')
              .eq('id', session.user.id)
              .maybeSingle();

            const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

            setTimeout(() => {
              if (isAdmin) {
                router.replace('/(admin)/dashboard');
              } else {
                router.replace('/(tabs)/home');
              }
            }, 500);

          } catch (sessionError: any) {
            console.error('[Auth Callback] Session establishment failed:', sessionError);
            
            // If session setup failed, try navigating anyway - the app might still have valid tokens
            if (sessionError?.message?.includes('abort')) {
              console.log('[Auth Callback] Session setup timed out, but proceeding');
              if (timeoutId) clearTimeout(timeoutId);
              setStatus('Completing sign-in...');
              setTimeout(() => {
                router.replace('/(tabs)/home');
              }, 500);
            } else {
              throw new Error('Failed to establish session: ' + (sessionError?.message || 'Unknown error'));
            }
          }
        } else {
          if (timeoutId) clearTimeout(timeoutId);
          throw new Error('No authentication tokens received');
        }
      } catch (error: any) {
        if (timeoutId) clearTimeout(timeoutId);
        console.error('[Auth Callback] Error:', error);
        setStatus('Authentication failed');
        
        const errorMsg = error?.message || 'Authentication failed unexpectedly';
        
        setTimeout(() => {
          Alert.alert('Authentication Failed', errorMsg, [
            {
              text: 'Try Again',
              onPress: () => router.replace('/login'),
            }
          ]);
        }, 500);
      }
    }

    handleAuthCallback();
  }, [url, provider, access_token, refresh_token, code, error, error_description, type, next, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.gold} />
      <Text style={styles.text}>{status}</Text>
      <Text style={styles.subtext}>This should only take a moment...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  subtext: {
    marginTop: 8,
    fontSize: 12,
    color: Colors.textMuted,
  },
});
