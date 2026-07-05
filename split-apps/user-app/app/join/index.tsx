import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';

export default function JoinHandler() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const [status, setStatus] = useState('Processing invite...');

  useEffect(() => {
    if (authLoading) return;
    handleJoin();
  }, [code, user, authLoading]);

  const handleJoin = async () => {
    if (!code) {
      Alert.alert('Invalid Link', 'No photographer code found.', [
        { text: 'OK', onPress: () => router.replace('/') },
      ]);
      return;
    }

    const upperCode = code.toUpperCase();

    // Store the code for later use
    try {
      await AsyncStorage.setItem('pending_join_code', upperCode);
    } catch (e) {
      console.warn('[Join] Failed to store code:', e);
    }

    // If user is not logged in, redirect to login/signup
    if (!user) {
      setStatus('Redirecting to sign in...');
      router.replace(`/login?join_code=${upperCode}`);
      return;
    }

    // User is logged in — attempt auto-linking
    setStatus('Connecting to photographer...');
    try {
      const { data, error } = await supabase.rpc('assign_client_to_photographer', {
        p_client_id: user.id,
        p_photographer_code: upperCode,
      });

      if (error) throw error;

      if (data?.success) {
        // Clear the stored code
        await AsyncStorage.removeItem('pending_join_code');

        Alert.alert(
          'Connected!',
          `You've been connected to ${data.admin_name || 'your photographer'}!`,
          [
            {
              text: 'Continue',
              onPress: () => router.replace('/(tabs)/home'),
            },
          ]
        );
      } else {
        Alert.alert(
          'Could Not Connect',
          data?.error || 'Invalid photographer code. Please check with your photographer.',
          [
            { text: 'OK', onPress: () => router.replace('/') },
          ]
        );
      }
    } catch (err: any) {
      console.error('[Join] Error:', err);
      Alert.alert(
        'Error',
        'Failed to connect. Please try again.',
        [
          { text: 'OK', onPress: () => router.replace('/') },
        ]
      );
    }
  };

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.gold} />
      <Text style={styles.text}>{status}</Text>
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
    color: Colors.textSecondary,
  },
});
