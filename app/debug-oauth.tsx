import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Application from 'expo-application';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';

interface DiagnosticsInfo {
  timestamp: string;
  device: {
    platform: string;
    osVersion: string;
  };
  app: {
    bundleId: string | null;
    nativeBuildVersion: string | null;
  };
  environment: {
    supabaseUrl: string;
    supabaseAnonKey: string;
  };
  session: any;
}

export default function OAuthDiagnosticsScreen() {
  const router = useRouter();
  const [diagnostics, setDiagnostics] = useState<DiagnosticsInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    runDiagnostics();
  }, []);

  const runDiagnostics = async () => {
    try {
      setLoading(true);
      const info: DiagnosticsInfo = {
        timestamp: new Date().toISOString(),
        device: {
          platform: Platform.OS,
          osVersion: Platform.Version?.toString() || 'unknown',
        },
        app: {
          bundleId: Application.applicationId,
          nativeBuildVersion: Application.nativeBuildVersion,
        },
        environment: {
          supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ? '✓ Configured' : '✗ Missing',
          supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? '✓ Configured' : '✗ Missing',
        },
        session: null,
      };

      // Check current session
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        info.session = session ? {
          user: session.user?.email,
          expiresAt: session.expires_at,
          isValid: session.expires_at ? new Date(session.expires_at * 1000) > new Date() : false,
        } : { message: 'No active session' };
      } catch (e: any) {
        info.session = { error: e.message };
      }

      setDiagnostics(info);
    } catch (error: any) {
      console.error('Diagnostics error:', error);
      // Create a partial info object with error
      const errorInfo: DiagnosticsInfo = {
        timestamp: new Date().toISOString(),
        device: { platform: Platform.OS, osVersion: 'unknown' },
        app: { bundleId: null, nativeBuildVersion: null },
        environment: { supabaseUrl: '✗ Error', supabaseAnonKey: '✗ Error' },
        session: { error: error.message },
      };
      setDiagnostics(errorInfo);
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    try {
      Alert.alert('Testing', 'Connecting to Supabase...');
      const { error } = await supabase.from('user_profiles').select('count').limit(1);
      if (error) {
        Alert.alert('Connection Failed', error.message);
      } else {
        Alert.alert('Connection OK', 'Successfully connected to Supabase');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>OAuth Diagnostics</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.gold} style={styles.loader} />
      ) : diagnostics ? (
        <View style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Device Information</Text>
            <Text style={styles.text}>Platform: {diagnostics.device?.platform}</Text>
            <Text style={styles.text}>OS Version: {diagnostics.device?.osVersion}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Configuration</Text>
            <Text style={styles.text}>Bundle ID: {diagnostics.app?.bundleId}</Text>
            <Text style={styles.text}>Supabase URL: {diagnostics.environment?.supabaseUrl}</Text>
            <Text style={styles.text}>Anon Key: {diagnostics.environment?.supabaseAnonKey}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Authentication Status</Text>
            {diagnostics.session ? (
              <>
                <Text style={styles.text}>User: {diagnostics.session.user}</Text>
                <Text style={styles.text}>Valid: {diagnostics.session.isValid ? '✓ Yes' : '✗ No'}</Text>
              </>
            ) : (
              <Text style={styles.text}>No active session</Text>
            )}
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.button} onPress={runDiagnostics}>
              <Text style={styles.buttonText}>Refresh</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={testConnection}>
              <Text style={styles.buttonText}>Test Connection</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.backButton]} onPress={() => router.back()}>
              <Text style={styles.buttonText}>Back</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: 20,
    paddingTop: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  loader: {
    marginTop: 40,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 20,
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gold,
    marginBottom: 12,
  },
  text: {
    fontSize: 14,
    color: Colors.textPrimary,
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  actions: {
    gap: 12,
    marginTop: 20,
  },
  button: {
    backgroundColor: Colors.gold,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  backButton: {
    backgroundColor: '#666',
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
});
