import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string;
    access_token?: string;
    refresh_token?: string;
    type?: string;
    error?: string;
    error_description?: string;
  }>();
  const [status, setStatus] = useState('Processing password reset...');
  const [handled, setHandled] = useState(false);

  useEffect(() => {
    if (handled) return;
    setHandled(true);

    async function handleReset() {
      try {
        // Prefer route params (works on warm starts too)
        let code = params.code;
        let accessToken = params.access_token;
        let refreshToken = params.refresh_token;

        // Fallback: cold start — parse from initial URL
        if (!code && !accessToken && !refreshToken) {
          const url = await Linking.getInitialURL();
          if (url) {
            const extract = (name: string): string | null => {
              try {
                let m = new RegExp(`[#&]${name}=([^&#]*)`).exec(url);
                if (m) return decodeURIComponent(m[1]);
                m = new RegExp(`[?&]${name}=([^&#]*)`).exec(url);
                return m ? decodeURIComponent(m[1]) : null;
              } catch { return null; }
            };
            code = extract('code') || undefined;
            accessToken = extract('access_token') || undefined;
            refreshToken = extract('refresh_token') || undefined;
          }
        }

        if (params.error) {
          throw new Error(params.error_description || params.error);
        }

        // Exchange code for session (PKCE flow)
        if (code && !accessToken && !refreshToken) {
          setStatus('Verifying reset link...');
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }
        // Set session directly if tokens are present
        else if (accessToken && refreshToken) {
          setStatus('Establishing session...');
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
        } else {
          throw new Error('Invalid reset link — no authentication tokens found');
        }

        // Verify session is valid
        const { data: { session }, error: sessionCheckError } = await supabase.auth.getSession();
        if (sessionCheckError || !session) {
          throw new Error('Failed to verify session after reset');
        }

        setStatus('Redirecting to password reset...');
        router.replace('/forgot-password?mode=recovery');
      } catch (error: any) {
        setStatus('Reset link expired or invalid');
        Alert.alert(
          'Reset Failed',
          error?.message || 'The reset link is invalid or has expired.',
          [{ text: 'Try Again', onPress: () => router.replace('/forgot-password') }]
        );
      }
    }

    handleReset();
  }, [handled, router, params.code, params.access_token, params.refresh_token, params.error, params.error_description]);

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
