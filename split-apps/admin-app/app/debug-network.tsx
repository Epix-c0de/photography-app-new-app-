import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { runNetworkDiagnostics, checkConnectivityWithRetry, showNetworkDiagnosticsAlert, quickConnectivityCheck } from '@/lib/network-debug';
import { checkSupabaseConnectivity } from '@/lib/signup';

const DebugNetworkScreen = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const router = useRouter();

  const runFullDiagnostics = async () => {
    setLoading(true);
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ujunohfpcmjywsblsoel.supabase.co';
      
      // Run comprehensive diagnostics
      const diagnostics = await runNetworkDiagnostics(supabaseUrl);
      const connectivity = await checkSupabaseConnectivity();
      const retryTest = await checkConnectivityWithRetry(supabaseUrl);
      const quickCheck = await quickConnectivityCheck();

      setResults({
        diagnostics,
        connectivity,
        retryTest,
        quickCheck,
        timestamp: new Date().toISOString(),
        envVars: {
          supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ? 'configured' : 'missing',
          anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? 'configured' : 'missing',
        }
      });

      showNetworkDiagnosticsAlert(diagnostics);

    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const runQuickCheck = async () => {
    setLoading(true);
    try {
      const result = await quickConnectivityCheck();
      setResults({ quickCheck: result, timestamp: new Date().toISOString() });
      
      Alert.alert(
        'Quick Check', 
        result.ok 
          ? '✅ Server is reachable and responding!' 
          : `❌ Server unreachable: ${result.error}`
      );
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Network Debug Tools</Text>
        <Text style={styles.subtitle}>Test Supabase server connectivity</Text>

        <Pressable 
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={runFullDiagnostics}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Running Diagnostics...' : 'Run Full Diagnostics'}
          </Text>
        </Pressable>

        <Pressable 
          style={[styles.button, styles.secondaryButton, loading && styles.buttonDisabled]}
          onPress={runQuickCheck}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Quick Connectivity Check</Text>
        </Pressable>

        {results && (
          <View style={styles.results}>
            <Text style={styles.resultsTitle}>Results:</Text>
            <Text style={styles.resultsText}>
              {JSON.stringify(results, null, 2)}
            </Text>
          </View>
        )}

        <Pressable 
          style={[styles.button, styles.backButton]}
          onPress={() => router.back()}
        >
          <Text style={styles.buttonText}>Go Back</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryButton: {
    backgroundColor: '#5856D6',
  },
  backButton: {
    backgroundColor: '#8E8E93',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  results: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  resultsTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  resultsText: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
});

export default DebugNetworkScreen;