// Task 17.1: Biometric Toggle component for user app
// Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.8, 8.10

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Fingerprint } from 'lucide-react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';

interface BiometricToggleProps {
  value: boolean;
  onValueChange: (enabled: boolean) => void;
}

export default function BiometricToggle({ value, onValueChange }: BiometricToggleProps) {
  const { user } = useAuth();
  const [isAvailable, setIsAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('');
  const [checking, setChecking] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    checkBiometricAvailability();
  }, []);

  const checkBiometricAvailability = async () => {
    try {
      setChecking(true);

      // Check if device has biometric hardware
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      
      if (!hasHardware) {
        setIsAvailable(false);
        setChecking(false);
        return;
      }

      // Check if biometrics are enrolled
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      
      if (!isEnrolled) {
        setIsAvailable(false);
        setChecking(false);
        return;
      }

      // Get supported authentication types
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      
      let typeName = 'Biometric';
      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        typeName = 'Face ID';
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        typeName = 'Fingerprint';
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        typeName = 'Iris';
      }

      setBiometricType(typeName);
      setIsAvailable(true);
    } catch (error) {
      console.error('[BiometricToggle] Availability check error:', error);
      setIsAvailable(false);
    } finally {
      setChecking(false);
    }
  };

  const handleToggle = async (newValue: boolean) => {
    if (!isAvailable) {
      Alert.alert(
        'Not Available',
        'Biometric authentication is not available on this device. Please ensure you have enrolled fingerprint or face recognition in your device settings.'
      );
      return;
    }

    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to change biometric settings.');
      return;
    }

    setUpdating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      if (newValue) {
        // Enabling biometric - prompt for authentication first
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: `Enable ${biometricType}`,
          fallbackLabel: 'Use Password',
          cancelLabel: 'Cancel',
        });

        if (!result.success) {
          if (result.error === 'user_cancel') {
            // User cancelled, no error message needed
            setUpdating(false);
            return;
          }
          
          Alert.alert(
            'Authentication Failed',
            'Biometric authentication failed. Please try again or use your device password.'
          );
          setUpdating(false);
          return;
        }
      }

      // Update biometric setting in database
      const { data, error } = await supabase.rpc('update_biometric_setting' as any, {
        p_enabled: newValue,
      }) as any;

      if (error) {
        console.error('[BiometricToggle] RPC error:', error);
        Alert.alert('Error', 'Failed to update biometric setting. Please try again.');
        setUpdating(false);
        return;
      }

      if (!data?.success) {
        Alert.alert('Error', data?.error || 'Failed to update biometric setting.');
        setUpdating(false);
        return;
      }

      // Success!
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onValueChange(newValue);
      
      Alert.alert(
        newValue ? 'Biometric Enabled' : 'Biometric Disabled',
        newValue
          ? `${biometricType} authentication has been enabled for this app.`
          : 'Biometric authentication has been disabled.'
      );
    } catch (error) {
      console.error('[BiometricToggle] Unexpected error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  if (checking) {
    return (
      <View style={styles.container}>
        <View style={styles.iconContainer}>
          <Fingerprint size={20} color={Colors.textMuted} strokeWidth={2} />
        </View>
        <View style={styles.content}>
          <Text style={styles.label}>Biometric Authentication</Text>
          <Text style={styles.description}>Checking availability...</Text>
        </View>
        <ActivityIndicator size="small" color={Colors.gold} />
      </View>
    );
  }

  if (!isAvailable) {
    return (
      <View style={styles.container}>
        <View style={[styles.iconContainer, styles.iconContainerDisabled]}>
          <Fingerprint size={20} color={Colors.textMuted} strokeWidth={2} />
        </View>
        <View style={styles.content}>
          <Text style={[styles.label, styles.labelDisabled]}>Biometric Authentication</Text>
          <Text style={styles.description}>
            Not available on this device
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Fingerprint size={20} color={Colors.gold} strokeWidth={2} />
      </View>
      <View style={styles.content}>
        <Text style={styles.label}>{biometricType} Authentication</Text>
        <Text style={styles.description}>
          {value
            ? `Unlock app with ${biometricType.toLowerCase()}`
            : `Enable ${biometricType.toLowerCase()} for quick access`}
        </Text>
      </View>
      {updating ? (
        <ActivityIndicator size="small" color={Colors.gold} />
      ) : (
        <Switch
          value={value}
          onValueChange={handleToggle}
          disabled={updating}
          trackColor={{ false: Colors.border, true: Colors.goldMuted }}
          thumbColor={value ? Colors.gold : Colors.textMuted}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: Colors.card,
    borderRadius: 12,
    marginBottom: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconContainerDisabled: {
    opacity: 0.5,
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 4,
  },
  labelDisabled: {
    color: Colors.textMuted,
  },
  description: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
});
