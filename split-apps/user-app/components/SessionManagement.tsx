import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function SessionManagement() {
  const { user } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOutAllDevices = async () => {
    // Show confirmation dialog
    Alert.alert(
      'Sign out of all devices?',
      'You will need to login again on all devices.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await performGlobalSignOut();
          },
        },
      ]
    );
  };

  const performGlobalSignOut = async () => {
    setIsSigningOut(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Log the session termination event
      try {
        await supabase.from('admin_audit_log').insert({
          admin_id: user?.id,
          action: 'global_signout',
          description: 'User signed out of all devices',
          metadata: {
            timestamp: new Date().toISOString(),
          },
        });
      } catch (logError) {
        console.error('Error logging sign out event:', logError);
        // Continue with sign out even if logging fails
      }

      // Sign out from all devices (global scope)
      const { error: signOutError } = await supabase.auth.signOut({
        scope: 'global',
      });

      if (signOutError) {
        throw signOutError;
      }

      // Clear all local authentication state
      try {
        await AsyncStorage.clear();
      } catch (clearError) {
        console.error('Error clearing AsyncStorage:', clearError);
        // Continue even if clear fails
      }

      // Provide haptic feedback for success
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Navigate to login screen
      router.replace('/login');
    } catch (error: any) {
      console.error('Error signing out:', error);
      
      // Even if API call fails, still clear local state and navigate
      try {
        await AsyncStorage.clear();
      } catch (clearError) {
        console.error('Error clearing AsyncStorage:', clearError);
      }

      // Show error to user but still navigate to login
      Alert.alert(
        'Sign Out',
        'Failed to sign out. Please try again. You have been logged out locally.',
        [
          {
            text: 'OK',
            onPress: () => {
              router.replace('/login');
            },
          },
        ]
      );

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="phone-portrait-outline" size={24} color="#D4AF37" />
          <Text style={styles.sectionTitle}>Active Sessions</Text>
        </View>
        
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color="#6B7280" />
          <Text style={styles.infoText}>
            Manage your login sessions across all devices
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.signOutButton, isSigningOut && styles.signOutButtonDisabled]}
          onPress={handleSignOutAllDevices}
          disabled={isSigningOut}
        >
          {isSigningOut ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={24} color="#FFFFFF" />
              <Text style={styles.signOutButtonText}>Sign Out of All Devices</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.warningBox}>
          <Ionicons name="warning-outline" size={20} color="#F59E0B" />
          <Text style={styles.warningText}>
            You will need to log in again on all devices after signing out
          </Text>
        </View>
      </View>

      <View style={styles.securityTips}>
        <Text style={styles.tipsTitle}>Security Tips</Text>
        <View style={styles.tipItem}>
          <Ionicons name="checkmark-circle" size={20} color="#10B981" />
          <Text style={styles.tipText}>
            Sign out from all devices if you suspect unauthorized access
          </Text>
        </View>
        <View style={styles.tipItem}>
          <Ionicons name="checkmark-circle" size={20} color="#10B981" />
          <Text style={styles.tipText}>
            Change your password after signing out for maximum security
          </Text>
        </View>
        <View style={styles.tipItem}>
          <Ionicons name="checkmark-circle" size={20} color="#10B981" />
          <Text style={styles.tipText}>
            Enable biometric or PIN lock for quick and secure access
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  signOutButtonDisabled: {
    backgroundColor: '#FCA5A5',
  },
  signOutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  securityTips: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tipsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
});
