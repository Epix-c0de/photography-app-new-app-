import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Alert, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lock, Eye, EyeOff, Shield, Phone, Mail, Save, LogOut, AlertTriangle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function SecurityScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [phone, setPhone] = useState(user?.phone ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [contactSaving, setContactSaving] = useState(false);

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      Alert.alert('Error', 'Please fill in all password fields');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }
    setPasswordSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Password updated successfully');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update password');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleUpdateContact = async () => {
    setContactSaving(true);
    try {
      if (email && email !== user?.email) {
        const { error } = await supabase.auth.updateUser({ email });
        if (error) throw error;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Saved', 'Contact info updated');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update contact');
    } finally {
      setContactSaving(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
        await supabase.auth.signOut();
      }},
    ]);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Account & Security' }} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}>

        {/* ── Change Password ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}><Lock size={18} color={Colors.gold} /><Text style={styles.sectionTitle}>Change Password</Text></View>

          <View style={styles.field}>
            <Text style={styles.label}>Current Password</Text>
            <View style={styles.passwordRow}>
              <TextInput style={styles.passwordInput} value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry={!showCurrent} placeholder="Enter current password" placeholderTextColor={Colors.textMuted} />
              <Pressable style={styles.eyeBtn} onPress={() => setShowCurrent(!showCurrent)}>
                {showCurrent ? <EyeOff size={18} color={Colors.textMuted} /> : <Eye size={18} color={Colors.textMuted} />}
              </Pressable>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>New Password</Text>
            <View style={styles.passwordRow}>
              <TextInput style={styles.passwordInput} value={newPassword} onChangeText={setNewPassword} secureTextEntry={!showNew} placeholder="Min. 6 characters" placeholderTextColor={Colors.textMuted} />
              <Pressable style={styles.eyeBtn} onPress={() => setShowNew(!showNew)}>
                {showNew ? <EyeOff size={18} color={Colors.textMuted} /> : <Eye size={18} color={Colors.textMuted} />}
              </Pressable>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Confirm New Password</Text>
            <View style={styles.passwordRow}>
              <TextInput style={styles.passwordInput} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showConfirm} placeholder="Re-enter new password" placeholderTextColor={Colors.textMuted} />
              <Pressable style={styles.eyeBtn} onPress={() => setShowConfirm(!showConfirm)}>
                {showConfirm ? <EyeOff size={18} color={Colors.textMuted} /> : <Eye size={18} color={Colors.textMuted} />}
              </Pressable>
            </View>
          </View>

          <Pressable style={[styles.saveBtn, passwordSaving && { opacity: 0.6 }]} onPress={handleChangePassword} disabled={passwordSaving}>
            {passwordSaving ? <ActivityIndicator size="small" color={Colors.background} /> : <Lock size={16} color={Colors.background} />}
            <Text style={styles.saveBtnText}>{passwordSaving ? 'Updating...' : 'Update Password'}</Text>
          </Pressable>
        </View>

        {/* ── Contact Info ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}><Phone size={18} color={Colors.gold} /><Text style={styles.sectionTitle}>Contact Info</Text></View>

          <View style={styles.field}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput style={styles.inputFull} value={phone} onChangeText={setPhone} placeholder="+254..." placeholderTextColor={Colors.textMuted} keyboardType="phone-pad" editable={false} />
            <Text style={styles.fieldHint}>Contact support to change your phone number</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.inputFull} value={email} onChangeText={setEmail} placeholder="email@example.com" placeholderTextColor={Colors.textMuted} keyboardType="email-address" />
          </View>

          <Pressable style={[styles.saveBtn, contactSaving && { opacity: 0.6 }]} onPress={handleUpdateContact} disabled={contactSaving}>
            {contactSaving ? <ActivityIndicator size="small" color={Colors.background} /> : <Save size={16} color={Colors.background} />}
            <Text style={styles.saveBtnText}>{contactSaving ? 'Saving...' : 'Save Contact'}</Text>
          </Pressable>
        </View>

        {/* ── Two-Factor Authentication ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}><Shield size={18} color={Colors.gold} /><Text style={styles.sectionTitle}>Two-Factor Authentication</Text></View>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Shield size={20} color={twoFactorEnabled ? Colors.gold : Colors.textMuted} />
              <View>
                <Text style={styles.toggleLabel}>2FA</Text>
                <Text style={styles.toggleDesc}>Add an extra layer of security</Text>
              </View>
            </View>
            <View style={styles.badge}><Text style={styles.badgeText}>Coming Soon</Text></View>
          </View>
        </View>

        {/* ── Active Sessions ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}><AlertTriangle size={18} color={Colors.gold} /><Text style={styles.sectionTitle}>Account</Text></View>

          <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
            <LogOut size={20} color="#EF4444" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: 16 },
  section: { backgroundColor: Colors.card, borderRadius: 12, padding: 16, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  field: { marginBottom: 16 },
  label: { fontSize: 13, color: Colors.textMuted, marginBottom: 8 },
  fieldHint: { fontSize: 11, color: Colors.textMuted, marginTop: 4, fontStyle: 'italic' },
  inputFull: { backgroundColor: Colors.background, borderRadius: 8, padding: 12, fontSize: 14, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },
  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1, backgroundColor: Colors.background, borderRadius: 8, padding: 12, fontSize: 14, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },
  eyeBtn: { padding: 12, marginLeft: -44 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  toggleInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  toggleLabel: { fontSize: 14, color: Colors.textPrimary },
  toggleDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  badge: { backgroundColor: 'rgba(212,175,55,0.15)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '600', color: Colors.gold },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.gold, borderRadius: 12, padding: 14, marginTop: 8 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: Colors.background },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12, padding: 14, marginTop: 8, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  signOutText: { fontSize: 15, fontWeight: '700', color: '#EF4444' },
});
