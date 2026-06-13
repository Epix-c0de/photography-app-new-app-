import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import * as SecureStore from 'expo-secure-store';

type PINState = 'CREATE_PIN' | 'CONFIRM_PIN' | 'VERIFY_PIN' | 'CHANGE_PIN';

interface PINLockModalProps {
  visible: boolean;
  mode: PINState;
  onClose: () => void;
  onSuccess: () => void;
  onFallbackToPassword?: () => void;
}

const PIN_LENGTH = 6;
const MAX_ATTEMPTS = 3;
const ATTEMPT_KEY = 'pin_attempts';

export default function PINLockModal({
  visible,
  mode,
  onClose,
  onSuccess,
  onFallbackToPassword,
}: PINLockModalProps) {
  const { user } = useAuth();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [currentState, setCurrentState] = useState<PINState>(mode);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    setCurrentState(mode);
    setPin('');
    setConfirmPin('');
    setError('');
    loadAttempts();
  }, [mode, visible]);

  const loadAttempts = async () => {
    try {
      const stored = await SecureStore.getItemAsync(ATTEMPT_KEY);
      setAttempts(stored ? parseInt(stored, 10) : 0);
    } catch (err) {
      console.error('Error loading attempts:', err);
    }
  };

  const saveAttempts = async (count: number) => {
    try {
      await SecureStore.setItemAsync(ATTEMPT_KEY, count.toString());
      setAttempts(count);
    } catch (err) {
      console.error('Error saving attempts:', err);
    }
  };

  const resetAttempts = async () => {
    await saveAttempts(0);
  };

  const hashPIN = async (pinValue: string): Promise<string> => {
    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      pinValue
    );
    return digest;
  };

  const handleNumberPress = (num: number) => {
    if (isProcessing) return;
    
    if (currentState === 'CREATE_PIN' || currentState === 'CHANGE_PIN') {
      if (pin.length < PIN_LENGTH) {
        setPin(pin + num);
        setError('');
      }
    } else if (currentState === 'CONFIRM_PIN') {
      if (confirmPin.length < PIN_LENGTH) {
        setConfirmPin(confirmPin + num);
        setError('');
      }
    } else if (currentState === 'VERIFY_PIN') {
      if (pin.length < PIN_LENGTH) {
        setPin(pin + num);
        setError('');
      }
    }
  };

  const handleBackspace = () => {
    if (isProcessing) return;
    
    if (currentState === 'CONFIRM_PIN') {
      setConfirmPin(confirmPin.slice(0, -1));
    } else {
      setPin(pin.slice(0, -1));
    }
    setError('');
  };

  const handleClear = () => {
    if (isProcessing) return;
    
    if (currentState === 'CONFIRM_PIN') {
      setConfirmPin('');
    } else {
      setPin('');
    }
    setError('');
  };

  useEffect(() => {
    if (currentState === 'CREATE_PIN' && pin.length === PIN_LENGTH) {
      setCurrentState('CONFIRM_PIN');
    } else if (currentState === 'CONFIRM_PIN' && confirmPin.length === PIN_LENGTH) {
      handleConfirmPIN();
    } else if (currentState === 'VERIFY_PIN' && pin.length === PIN_LENGTH) {
      handleVerifyPIN();
    }
  }, [pin, confirmPin, currentState]);

  const handleConfirmPIN = async () => {
    setIsProcessing(true);
    
    if (pin !== confirmPin) {
      Vibration.vibrate(500);
      setError('PINs do not match. Please try again.');
      setPin('');
      setConfirmPin('');
      setCurrentState('CREATE_PIN');
      setIsProcessing(false);
      return;
    }

    try {
      const hash = await hashPIN(pin);
      
      const { error: dbError } = await supabase.rpc('set_pin_hash' as any, {
        p_pin_hash: hash,
      }) as any;

      if (dbError) throw dbError;

      await resetAttempts();
      setPin('');
      setConfirmPin('');
      onSuccess();
    } catch (err: any) {
      console.error('Error setting PIN:', err);
      setError(err.message || 'Failed to save PIN. Please try again.');
      setPin('');
      setConfirmPin('');
      setCurrentState('CREATE_PIN');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVerifyPIN = async () => {
    setIsProcessing(true);
    
    if (attempts >= MAX_ATTEMPTS) {
      setError('Too many attempts. Please use password or biometric.');
      Vibration.vibrate([100, 50, 100, 50, 100]);
      setIsProcessing(false);
      
      if (onFallbackToPassword) {
        setTimeout(() => {
          onClose();
          onFallbackToPassword();
        }, 2000);
      }
      return;
    }

    try {
      const hash = await hashPIN(pin);
      
      const { data: profile, error: fetchError } = await supabase
        .from('user_profiles')
        .select('pin_hash')
        .eq('id', user?.id)
        .single();

      if (fetchError) throw fetchError;

      if (profile.pin_hash === hash) {
        await resetAttempts();
        setPin('');
        onSuccess();
      } else {
        const newAttempts = attempts + 1;
        await saveAttempts(newAttempts);
        
        Vibration.vibrate(500);
        const remaining = MAX_ATTEMPTS - newAttempts;
        
        if (remaining > 0) {
          setError(`Incorrect PIN. ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.`);
        } else {
          setError('Too many attempts. Please use password or biometric.');
          Vibration.vibrate([100, 50, 100, 50, 100]);
          
          if (onFallbackToPassword) {
            setTimeout(() => {
              onClose();
              onFallbackToPassword();
            }, 2000);
          }
        }
        
        setPin('');
      }
    } catch (err: any) {
      console.error('Error verifying PIN:', err);
      setError('Verification failed. Please try again.');
      setPin('');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemovePIN = async () => {
    Alert.alert(
      'Remove PIN Lock',
      'Are you sure you want to remove your PIN lock?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.rpc('remove_pin_lock' as any) as any;

              if (error) throw error;

              await resetAttempts();
              onSuccess();
            } catch (err: any) {
              console.error('Error removing PIN:', err);
              Alert.alert('Error', 'Failed to remove PIN. Please try again.');
            }
          },
        },
      ]
    );
  };

  const getTitle = () => {
    switch (currentState) {
      case 'CREATE_PIN':
        return 'Create Your PIN';
      case 'CONFIRM_PIN':
        return 'Confirm Your PIN';
      case 'VERIFY_PIN':
        return 'Enter Your PIN';
      case 'CHANGE_PIN':
        return 'Change Your PIN';
      default:
        return 'PIN Lock';
    }
  };

  const getSubtitle = () => {
    switch (currentState) {
      case 'CREATE_PIN':
        return 'Enter a 6-digit PIN';
      case 'CONFIRM_PIN':
        return 'Enter your PIN again';
      case 'VERIFY_PIN':
        return 'Enter your PIN to continue';
      case 'CHANGE_PIN':
        return 'Enter your new PIN';
      default:
        return '';
    }
  };

  const renderPINDots = () => {
    const length = currentState === 'CONFIRM_PIN' ? confirmPin.length : pin.length;
    return (
      <View style={styles.dotsContainer}>
        {Array.from({ length: PIN_LENGTH }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index < length && styles.dotFilled,
              !!error && styles.dotError,
            ]}
          />
        ))}
      </View>
    );
  };

  const renderKeypad = () => {
    const rows = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
      ['clear', 0, 'backspace'],
    ];

    return (
      <View style={styles.keypad}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.keypadRow}>
            {row.map((item, colIndex) => {
              if (item === 'clear') {
                return (
                  <TouchableOpacity
                    key="clear"
                    style={[styles.keypadButton, colIndex < row.length - 1 && styles.keypadButtonGap]}
                    onPress={handleClear}
                    disabled={isProcessing}
                  >
                    <Text style={styles.keypadTextSmall}>{'Clear'}</Text>
                  </TouchableOpacity>
                );
              } else if (item === 'backspace') {
                return (
                  <TouchableOpacity
                    key="backspace"
                    style={styles.keypadButton}
                    onPress={handleBackspace}
                    disabled={isProcessing}
                  >
                    <Ionicons name="backspace-outline" size={28} color="#000" />
                  </TouchableOpacity>
                );
              } else {
                return (
                  <TouchableOpacity
                    key={String(item)}
                    style={[styles.keypadButton, colIndex < row.length - 1 && styles.keypadButtonGap]}
                    onPress={() => handleNumberPress(item as number)}
                    disabled={isProcessing}
                  >
                    <Text style={styles.keypadText}>{String(item)}</Text>
                  </TouchableOpacity>
                );
              }
            })}
          </View>
        ))}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#000" />
          </TouchableOpacity>
          {mode === 'VERIFY_PIN' && (
            <TouchableOpacity onPress={handleRemovePIN} style={styles.removeButton}>
              <Text style={styles.removeText}>{'Remove PIN'}</Text>
            </TouchableOpacity>
          )}
          {mode !== 'VERIFY_PIN' && <View style={styles.removeButton} />}
        </View>

        <View style={styles.content}>
          <View style={styles.titleSection}>
            <Text style={styles.title}>{getTitle()}</Text>
            <Text style={styles.subtitle}>{getSubtitle()}</Text>
          </View>

          {renderPINDots()}

          {!!error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={20} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {renderKeypad()}

          {currentState === 'VERIFY_PIN' && !!onFallbackToPassword && (
            <TouchableOpacity
              style={styles.fallbackButton}
              onPress={() => {
                onClose();
                onFallbackToPassword!();
              }}
            >
              <Text style={styles.fallbackText}>{'Use Password Instead'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  closeButton: {
    padding: 8,
  },
  removeButton: {
    padding: 8,
  },
  removeText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-around',
  },
  titleSection: {
    alignItems: 'center',
    marginTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 40,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
    borderWidth: 2,
    borderColor: '#D1D5DB',
    marginHorizontal: 8,
  },
  dotFilled: {
    backgroundColor: '#D4AF37',
    borderColor: '#D4AF37',
  },
  dotError: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    marginHorizontal: 24,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  keypad: {
    marginTop: 20,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  keypadButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keypadButtonGap: {
    marginRight: 24,
  },
  keypadText: {
    fontSize: 32,
    fontWeight: '600',
    color: '#000',
  },
  keypadTextSmall: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  fallbackButton: {
    alignSelf: 'center',
    padding: 16,
    marginTop: 20,
  },
  fallbackText: {
    color: '#D4AF37',
    fontSize: 16,
    fontWeight: '600',
  },
});
