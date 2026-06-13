// Task 14.1: Photographer Code Display component for admin app
// Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 15.10

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Share,
  ActivityIndicator,
} from 'react-native';
import { Copy, Share2, RefreshCw } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';

interface PhotographerCodeDisplayProps {
  photographerCode: string;
  onCodeRegenerated?: (newCode: string) => void;
}

export default function PhotographerCodeDisplay({
  photographerCode,
  onCodeRegenerated,
}: PhotographerCodeDisplayProps) {
  const { user } = useAuth();
  const [regenerating, setRegenerating] = useState(false);
  // User app download links fetched from platform_settings (set by super admin)
  const [userAppAndroid, setUserAppAndroid] = useState('https://play.google.com/store');
  const [userAppIos, setUserAppIos] = useState('https://apps.apple.com');

  useEffect(() => {
    // Load user app download links from super admin platform settings
    supabase
      .from('platform_settings')
      .select('key, value')
      .in('key', ['platform_app_android_link', 'platform_app_ios_link', 'platform_app_name'])
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((r: any) => { map[r.key] = r.value || ''; });
          if (map['platform_app_android_link']) setUserAppAndroid(map['platform_app_android_link']);
          if (map['platform_app_ios_link']) setUserAppIos(map['platform_app_ios_link']);
        }
      });
  }, []);

  const handleCopyCode = async () => {
    try {
      await Clipboard.setStringAsync(photographerCode);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Copied!', 'Photographer code copied to clipboard.');
    } catch (error) {
      console.error('[PhotographerCodeDisplay] Copy error:', error);
      Alert.alert('Error', 'Failed to copy code to clipboard.');
    }
  };

  const handleShareCode = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const shareMessage = [
        `Hi! I'm your photographer on Epix Visuals.`,
        ``,
        `To access your photos, download the app:`,
        `🤖 Android: ${userAppAndroid}`,
        `🍎 iOS: ${userAppIos}`,
        ``,
        `Then enter this code to connect with me:`,
        `🔑 *${photographerCode}*`,
        ``,
        `This code is unique to my clients — it links your account directly to me.`,
      ].join('\n');

      await Share.share({
        message: shareMessage,
        title: 'Download Epix Visuals & Connect',
      });
    } catch (error) {
      console.error('[PhotographerCodeDisplay] Share error:', error);
      // Share dialog was cancelled or failed
    }
  };

  const handleRegenerateCode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    Alert.alert(
      'Regenerate Code?',
      'Are you sure you want to generate a new photographer code? Your current code will no longer work, and clients will need the new code to connect.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Regenerate',
          style: 'destructive',
          onPress: performCodeRegeneration,
        },
      ]
    );
  };

  const performCodeRegeneration = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to regenerate your code.');
      return;
    }

    setRegenerating(true);

    try {
      // Generate a new random 8-character alphanumeric code
      const newCode = generatePhotographerCode();

      // Update user_profiles with new photographer_code
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          photographer_code: newCode,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('[PhotographerCodeDisplay] Update error:', updateError);
        Alert.alert('Error', 'Failed to regenerate code. Please try again.');
        return;
      }

      // Log the regeneration in admin_audit_log
      try {
        await supabase.from('admin_audit_log').insert({
          admin_id: user.id,
          action: 'photographer_code_regenerated',
          entity_type: 'user_profile',
          entity_id: user.id,
          changes: {
            old_code: photographerCode,
            new_code: newCode,
          },
          created_at: new Date().toISOString(),
        });
      } catch (logError) {
        console.warn('[PhotographerCodeDisplay] Audit log error:', logError);
        // Don't fail the operation if audit logging fails
      }

      // Success!
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Code Regenerated',
        `Your new photographer code is: ${newCode}\n\nShare this code with your clients to let them connect with you.`,
        [
          {
            text: 'OK',
            onPress: () => {
              if (onCodeRegenerated) {
                onCodeRegenerated(newCode);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('[PhotographerCodeDisplay] Unexpected error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setRegenerating(false);
    }
  };

  const generatePhotographerCode = (): string => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    
    for (let i = 0; i < 8; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      code += characters[randomIndex];
    }
    
    return code;
  };

  // QR code data payload
  const qrCodeData = JSON.stringify({
    type: 'photographer_code',
    code: photographerCode,
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <Text style={styles.header}>Your Photographer Code</Text>
      <Text style={styles.description}>
        Share this code with clients so they can connect with you and access their photos.
      </Text>

      {/* Code Display */}
      <View style={styles.codeContainer}>
        <Text style={styles.codeLabel}>Photographer Code</Text>
        <Text style={styles.code}>{photographerCode}</Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <Pressable
          style={[styles.actionButton, styles.primaryAction]}
          onPress={handleCopyCode}
          disabled={regenerating}
        >
          <Copy size={20} color={Colors.background} strokeWidth={2} />
          <Text style={styles.primaryActionText}>Copy Code</Text>
        </Pressable>

        <Pressable
          style={[styles.actionButton, styles.secondaryAction]}
          onPress={handleShareCode}
          disabled={regenerating}
        >
          <Share2 size={20} color={Colors.gold} strokeWidth={2} />
          <Text style={styles.secondaryActionText}>Share Code</Text>
        </Pressable>
      </View>

      {/* QR Code */}
      <View style={styles.qrSection}>
        <Text style={styles.qrLabel}>QR Code</Text>
        <Text style={styles.qrDescription}>
          Clients can scan this QR code to connect instantly
        </Text>
        
        <View style={styles.qrContainer}>
          <QRCode
            value={qrCodeData}
            size={200}
            color={Colors.text}
            backgroundColor={Colors.white}
          />
        </View>
      </View>

      {/* Regenerate Button */}
      <Pressable
        style={[styles.regenerateButton, regenerating && styles.regenerateButtonDisabled]}
        onPress={handleRegenerateCode}
        disabled={regenerating}
      >
        {regenerating ? (
          <ActivityIndicator size="small" color={Colors.error} />
        ) : (
          <>
            <RefreshCw size={18} color={Colors.error} strokeWidth={2} />
            <Text style={styles.regenerateButtonText}>Regenerate Code</Text>
          </>
        )}
      </Pressable>

      <Text style={styles.regenerateWarning}>
        ⚠️ Regenerating will invalidate your current code
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
  },
  header: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 24,
  },
  codeContainer: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: Colors.gold,
  },
  codeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  code: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.gold,
    letterSpacing: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  primaryAction: {
    backgroundColor: Colors.gold,
  },
  secondaryAction: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.gold,
  },
  primaryActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.background,
  },
  secondaryActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.gold,
  },
  qrSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  qrLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 8,
  },
  qrDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 20,
    textAlign: 'center',
  },
  qrContainer: {
    backgroundColor: Colors.white,
    padding: 20,
    borderRadius: 12,
  },
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.error,
    gap: 8,
    marginBottom: 8,
  },
  regenerateButtonDisabled: {
    opacity: 0.5,
  },
  regenerateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.error,
  },
  regenerateWarning: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
