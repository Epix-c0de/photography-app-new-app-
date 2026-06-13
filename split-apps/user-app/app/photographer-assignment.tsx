import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/services/client';

export default function PhotographerAssignmentScreen() {
  const router = useRouter();
  const [photographerCode, setPhotographerCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmitCode = async () => {
    if (!photographerCode.trim()) {
      Alert.alert('Error', 'Please enter a photographer code');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Please log in first');
        router.replace('/');
        return;
      }

      // Call the assignment function
      const { data, error } = await supabase.rpc('assign_client_to_photographer', {
        p_client_id: user.id,
        p_photographer_code: photographerCode.toUpperCase().trim()
      });

      if (error) throw error;

      if (data?.success) {
        Alert.alert(
          'Success!',
          `You've been connected to ${data.admin_name}`,
          [
            {
              text: 'Continue',
              onPress: () => router.replace('/(tabs)/home')
            }
          ]
        );
      } else {
        Alert.alert('Error', data?.error || 'Invalid photographer code');
      }
    } catch (error: any) {
      console.error('Assignment error:', error);
      Alert.alert('Error', error.message || 'Failed to connect to photographer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>📸</Text>
          <Text style={styles.title}>Welcome to Epix Visuals</Text>
          <Text style={styles.subtitle}>
            To get started, enter your photographer's code
          </Text>
        </View>

        {/* Code Input */}
        <View style={styles.form}>
          <Text style={styles.label}>Photographer Code</Text>
          <TextInput
            style={styles.input}
            value={photographerCode}
            onChangeText={setPhotographerCode}
            placeholder="Enter 8-character code"
            placeholderTextColor="rgba(255,255,255,0.3)"
            autoCapitalize="characters"
            maxLength={8}
            editable={!loading}
          />
          <Text style={styles.hint}>
            Ask your photographer for their unique code
          </Text>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmitCode}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#080810" />
            ) : (
              <Text style={styles.buttonText}>Connect to Photographer</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Help Section */}
        <View style={styles.help}>
          <Text style={styles.helpTitle}>Don't have a code?</Text>
          <Text style={styles.helpText}>
            Contact your photographer to get your unique access code. They can find it in their app settings.
          </Text>
        </View>

        {/* QR Code Option */}
        <TouchableOpacity style={styles.qrButton}>
          <Text style={styles.qrButtonText}>📷 Scan QR Code Instead</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080810',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  form: {
    marginBottom: 32,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#D4AF37',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 2,
  },
  hint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 8,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#D4AF37',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 24,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#080810',
  },
  help: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 16,
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 20,
  },
  qrButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  qrButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D4AF37',
  },
});
