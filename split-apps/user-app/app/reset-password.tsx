import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [status, setStatus] = useState('Processing password reset...');
  const [handled, setHandled] = useState(false);

  useEffect(() => {
    if (handled) return;
    setHandled(true);

    async function handleReset() {
      try {
        const url = await Linking.getInitialURL();
        console.log('[Reset Password] Deep link URL:', url);

        if (!url) {
          setStatus('No reset link found');
          Alert.alert('Error', 'No password reset link found.', [
            { text: 'OK', onPress: () => router.replace('/login') },
          ]);
          return;
        }

        // Extract tokens/code from the URL
        const extractParam = (urlStr: string, name: string): string | null => {
          try {
            // Try fragment first
            let regex = new RegExp(`[#&]${name}=([^&#]*)`);
            let match = regex.exec(urlStr);
            if (match) return decodeURIComponent(match[1]);
            // Try query string
            regex = new RegExp(`[?&]${name}=([^&#]*)`);
            match = regex.exec(urlStr);
            return match ? decodeURIComponent(match[1]) : null;
          } catch {
            return null;
          }
        };

        const code = extractParam(url, 'code');
        const accessToken = extractParam(url, 'access_token');
        const refreshToken = extractParam(url, 'refresh_token');

        console.log('[Reset Password] Extracted:', {
          hasCode: !!code,
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
        });

        // Exchange code for session (PKCE flow)
        if (code && !accessToken && !refreshToken) {
          setStatus('Verifying reset link...');
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error('[Reset Password] Code exchange error:', exchangeError);
            throw exchangeError;
          }
          console.log('[Reset Password] Session established via code exchange');
        }
        // Set session directly if tokens are present
        else if (accessToken && refreshToken) {
          setStatus('Establishing session...');
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) {
            console.error('[Reset Password] Session error:', sessionError);
            throw sessionError;
          }
          console.log('[Reset Password] Session established via tokens');
        } else {
          throw new Error('Invalid reset link - no authentication tokens found');
        }

        // Verify session is valid
        const { data: { session }, error: sessionCheckError } = await supabase.auth.getSession();
        if (sessionCheckError || !session) {
          throw new Error('Failed to verify session after reset');
        }

        console.log('[Reset Password] Session verified, navigating to forgot-password');
        setStatus('Redirecting to password reset...');
        router.replace('/forgot-password?mode=recovery');
      } catch (error: any) {
        console.error('[Reset Password] Error:', error);
        setStatus('Reset link expired or invalid');
        Alert.alert('Reset Failed', error?.message || 'The reset link is invalid or has expired.', [
          { text: 'Try Again', onPress: () => router.replace('/forgot-password') },
        ]);
      }
    }

    handleReset();
  }, [handled, router]);

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
