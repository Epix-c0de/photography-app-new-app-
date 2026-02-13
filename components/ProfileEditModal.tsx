import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Animated, Dimensions, Platform } from 'react-native';
import { Camera, Image as ImageIcon, Trash2, X } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import Colors from '@/constants/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

interface ProfileEditModalProps {
  visible: boolean;
  onClose: () => void;
  onOptionSelect: (option: 'camera' | 'library' | 'remove') => void;
  hasCurrentPhoto: boolean;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ProfileEditModal({ visible, onClose, onOptionSelect, hasCurrentPhoto }: ProfileEditModalProps) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleSelect = (option: 'camera' | 'library' | 'remove') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose(); // Close modal first or let parent handle? Better to animate out then callback.
    // Actually, usually we want to trigger action immediately.
    // Let's call callback and let parent handle closing if needed, but usually parent will set visible=false.
    onOptionSelect(option);
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <Pressable style={styles.backdropPress} onPress={onClose}>
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          </Pressable>
        </Animated.View>

        <Animated.View 
          style={[
            styles.sheet, 
            { 
              transform: [{ translateY: slideAnim }],
              paddingBottom: insets.bottom + 20 
            }
          ]}
        >
          <View style={styles.indicator} />
          
          <Text style={styles.title}>Update Profile Picture</Text>
          <Text style={styles.subtitle}>Choose how you want to update your avatar</Text>

          <View style={styles.optionsContainer}>
            <Pressable 
              style={({ pressed }) => [styles.optionButton, pressed && styles.optionPressed]}
              onPress={() => handleSelect('camera')}
            >
              <LinearGradient
                colors={['rgba(212,175,55,0.2)', 'rgba(212,175,55,0.05)']}
                style={styles.optionGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.iconContainer}>
                  <Camera size={24} color={Colors.gold} />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionTitle}>Take Photo</Text>
                  <Text style={styles.optionDesc}>Use your camera</Text>
                </View>
              </LinearGradient>
            </Pressable>

            <Pressable 
              style={({ pressed }) => [styles.optionButton, pressed && styles.optionPressed]}
              onPress={() => handleSelect('library')}
            >
              <View style={styles.optionContent}>
                <View style={[styles.iconContainer, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                  <ImageIcon size={24} color={Colors.white} />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionTitle}>Choose from Library</Text>
                  <Text style={styles.optionDesc}>Select from your gallery</Text>
                </View>
              </View>
            </Pressable>

            {hasCurrentPhoto && (
              <Pressable 
                style={({ pressed }) => [styles.optionButton, pressed && styles.optionPressed]}
                onPress={() => handleSelect('remove')}
              >
                <View style={styles.optionContent}>
                  <View style={[styles.iconContainer, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                    <Trash2 size={24} color={Colors.error} />
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={[styles.optionTitle, { color: Colors.error }]}>Remove Photo</Text>
                    <Text style={styles.optionDesc}>Delete current picture</Text>
                  </View>
                </View>
              </Pressable>
            )}
          </View>

          <Pressable style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  backdropPress: {
    flex: 1,
  },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  indicator: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 32,
  },
  optionsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  optionButton: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  optionPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },
  optionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(212,175,55,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 4,
  },
  optionDesc: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  cancelButton: {
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  }
});
