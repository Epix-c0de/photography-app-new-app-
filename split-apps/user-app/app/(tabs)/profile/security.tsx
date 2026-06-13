import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import PasswordChangeModal from '../../../components/PasswordChangeModal';
import BiometricToggle from '../../../components/BiometricToggle';
import PINLockModal from '../../../components/PINLockModal';
import SessionManagement from '../../../components/SessionManagement';

interface SecurityProfile {
  biometric_enabled: boolean;
  pin_hash: string | null;
  password_changed_at: string;
  last_password_change_reminder: string | null;
  '2fa_enabled': boolean;
}

export default function SecuritySettingsScreen() {
  const { user } = useAuth();
  
  // Settings State
  const [securityProfile, setSecurityProfile] = useState<SecurityProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinMode, setPinMode] = useState<'CREATE_PIN' | 'VERIFY_PIN' | 'CHANGE_PIN'>('CREATE_PIN');
  const [show2FAModal, setShow2FAModal] = useState(false);

  // Load initial settings
  useEffect(() => {
    loadSecurityProfile();
  }, []);

  const loadSecurityProfile = async () => {
    try {
      setLoading(true);
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user) return;

      const { data, error } = await supabase
        .from('user_profiles')
        .select('biometric_enabled, pin_hash, password_changed_at, last_password_change_reminder, 2fa_enabled')
        .eq('id', session.session.user.id)
        .single() as any;

      if (error) throw error;
      
      setSecurityProfile(data as SecurityProfile);
    } catch (e) {
      console.error('Error loading security profile:', e);
      Alert.alert('Error', 'Failed to load security settings');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricChange = async (enabled: boolean) => {
    // Update local state immediately for better UX
    setSecurityProfile(prev => prev ? { ...prev, biometric_enabled: enabled } : null);
  };

  const handlePINSuccess = async () => {
    setShowPinModal(false);
    await loadSecurityProfile();
  };

  const handlePasswordSuccess = async () => {
    setShowPasswordModal(false);
    await loadSecurityProfile();
  };

  const getPasswordChangedText = () => {
    if (!securityProfile?.password_changed_at) return 'Never changed';
    
    const changedDate = new Date(securityProfile.password_changed_at);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - changedDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 0) return 'Changed today';
    if (daysDiff === 1) return 'Changed yesterday';
    if (daysDiff < 30) return `Changed ${daysDiff} days ago`;
    
    const monthsDiff = Math.floor(daysDiff / 30);
    if (monthsDiff === 1) return 'Changed 1 month ago';
    return `Changed ${monthsDiff} months ago`;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ 
          title: 'Security',
          headerStyle: { backgroundColor: '#000' },
          headerTintColor: '#FFF',
        }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#D4AF37" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ 
          title: 'Security',
          headerStyle: { backgroundColor: '#000' },
          headerTintColor: '#FFF',
      }} />
      <StatusBar style="light" backgroundColor="#000" />
      
      <ScrollView contentContainerStyle={styles.content}>
        
        {/* Section 1: Password Management */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="lock-closed" size={24} color="#D4AF37" />
            <Text style={styles.sectionTitle}>Password Management</Text>
          </View>
          
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>Password</Text>
                <Text style={styles.rowValue}>{getPasswordChangedText()}</Text>
              </View>
              <Pressable 
                style={styles.actionButton}
                onPress={() => setShowPasswordModal(true)}
              >
                <Text style={styles.actionButtonText}>Change</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Section 2: Biometric Authentication */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="finger-print" size={24} color="#D4AF37" />
            <Text style={styles.sectionTitle}>Biometric Authentication</Text>
          </View>
          
          <BiometricToggle 
            value={securityProfile?.biometric_enabled || false}
            onValueChange={handleBiometricChange}
          />
        </View>

        {/* Section 3: PIN Lock */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="keypad" size={24} color="#D4AF37" />
            <Text style={styles.sectionTitle}>PIN Lock</Text>
          </View>
          
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>PIN Lock</Text>
                <Text style={styles.rowValue}>
                  {securityProfile?.pin_hash ? 'Enabled' : 'Not set'}
                </Text>
              </View>
              <Pressable 
                style={styles.actionButton}
                onPress={() => {
                  setPinMode(securityProfile?.pin_hash ? 'CHANGE_PIN' : 'CREATE_PIN');
                  setShowPinModal(true);
                }}
              >
                <Text style={styles.actionButtonText}>
                  {securityProfile?.pin_hash ? 'Change' : 'Set Up'}
                </Text>
              </Pressable>
            </View>
            
            {securityProfile?.pin_hash && (
              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={16} color="#6B7280" />
                <Text style={styles.infoText}>
                  PIN will be required each time you open the app
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Section 4: Session Management */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="phone-portrait-outline" size={24} color="#D4AF37" />
            <Text style={styles.sectionTitle}>Session Management</Text>
          </View>
          
          <SessionManagement />
        </View>

        {/* Section 5: Two-Factor Authentication (Coming Soon) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="shield-checkmark" size={24} color="#6B7280" />
            <Text style={[styles.sectionTitle, styles.comingSoonTitle]}>
              Two-Factor Authentication
            </Text>
          </View>
          
          <Pressable 
            style={[styles.card, styles.comingSoonCard]}
            onPress={() => setShow2FAModal(true)}
          >
            <View style={styles.row}>
              <View style={styles.rowContent}>
                <Text style={[styles.rowLabel, styles.mutedText]}>2FA</Text>
                <Text style={[styles.rowValue, styles.mutedText]}>
                  Additional security layer
                </Text>
              </View>
              <View style={styles.comingSoonBadge}>
                <Text style={styles.comingSoonText}>Coming Soon</Text>
              </View>
            </View>
          </Pressable>
        </View>

      </ScrollView>

      {/* Modals */}
      <PasswordChangeModal 
        visible={showPasswordModal} 
        onClose={() => setShowPasswordModal(false)}
        onSuccess={handlePasswordSuccess}
      />
      
      <PINLockModal
        visible={showPinModal}
        mode={pinMode}
        onClose={() => setShowPinModal(false)}
        onSuccess={handlePINSuccess}
      />

      {/* 2FA Coming Soon Modal */}
      <Modal
        visible={show2FAModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShow2FAModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="shield-checkmark" size={32} color="#D4AF37" />
            </View>
            <Text style={styles.modalTitle}>2FA Coming Soon</Text>
            <Text style={styles.modalMessage}>
              Two-factor authentication via SMS or authenticator app is coming in the next update. 
              This will add an extra layer of security to your account.
            </Text>
            <Pressable 
              style={styles.modalButton}
              onPress={() => setShow2FAModal(false)}
            >
              <Text style={styles.modalButtonText}>Got It</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
    gap: 24,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
  },
  comingSoonTitle: {
    color: '#6B7280',
  },
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
    gap: 12,
  },
  comingSoonCard: {
    opacity: 0.6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  rowContent: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '500',
    marginBottom: 4,
  },
  rowValue: {
    fontSize: 14,
    color: '#6B7280',
  },
  mutedText: {
    color: '#6B7280',
  },
  actionButton: {
    backgroundColor: '#333',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#D4AF37',
    fontSize: 14,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    backgroundColor: '#0F172A',
    borderRadius: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  comingSoonBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  comingSoonText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
  },
  // 2FA Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  modalHeader: {
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#9CA3AF',
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 28,
  },
  modalButton: {
    backgroundColor: '#D4AF37',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
  },
  modalButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
