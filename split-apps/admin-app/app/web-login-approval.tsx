/**
 * Web Login Approval Screen
 * Shown when the admin receives a notification that someone is trying
 * to log in to their web dashboard. They can approve or reject.
 */
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Shield, Monitor, X, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';

export default function WebLoginApprovalScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    loadRequest();
  }, [token]);

  const loadRequest = async () => {
    try {
      const { data } = await supabase
        .from('web_login_requests')
        .select('*')
        .eq('token', token)
        .maybeSingle();
      setRequest(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!request) return;
    setActionLoading(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      await supabase
        .from('web_login_requests')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', request.id);

      Alert.alert('Approved', 'Web dashboard login has been approved.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!request) return;
    Alert.alert('Reject Login', 'Are you sure you want to reject this login attempt?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          try {
            await supabase
              .from('web_login_requests')
              .update({ status: 'rejected' })
              .eq('id', request.id);
            router.back();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          } finally {
            setActionLoading(false);
          }
        }
      }
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  if (!request || request.status === 'expired' || new Date(request.expires_at) < new Date()) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 20, alignItems: 'center', justifyContent: 'center' }]}>
        <X size={48} color={Colors.error} />
        <Text style={styles.title}>Request Expired</Text>
        <Text style={styles.subtitle}>This login request has expired or is no longer valid.</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  if (request.status === 'approved') {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 20, alignItems: 'center', justifyContent: 'center' }]}>
        <Check size={48} color={Colors.success} />
        <Text style={[styles.title, { color: Colors.success }]}>Already Approved</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const expiresIn = Math.max(0, Math.ceil((new Date(request.expires_at).getTime() - Date.now()) / 60000));

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <X size={22} color={Colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Shield size={40} color={Colors.gold} />
        </View>

        <Text style={styles.title}>Web Login Request</Text>
        <Text style={styles.subtitle}>
          Someone is trying to log in to your web dashboard.
          {'\n'}Approve only if this was you.
        </Text>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Monitor size={16} color={Colors.textMuted} />
            <Text style={styles.infoText}>{request.device_info || 'Unknown device'}</Text>
          </View>
          {request.ip_address && (
            <View style={styles.infoRow}>
              <Shield size={16} color={Colors.textMuted} />
              <Text style={styles.infoText}>IP: {request.ip_address}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Expires in:</Text>
            <Text style={[styles.infoText, { color: expiresIn <= 2 ? Colors.error : Colors.warning }]}>
              {expiresIn} minute{expiresIn !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        <Text style={styles.warning}>
          ⚠️ If you did not request this, reject it immediately and change your password.
        </Text>

        <View style={styles.actions}>
          <Pressable
            style={[styles.rejectBtn, actionLoading && { opacity: 0.5 }]}
            onPress={handleReject}
            disabled={actionLoading}
          >
            <X size={18} color={Colors.error} />
            <Text style={styles.rejectBtnText}>Reject</Text>
          </Pressable>

          <Pressable
            style={[styles.approveBtn, actionLoading && { opacity: 0.5 }]}
            onPress={handleApprove}
            disabled={actionLoading}
          >
            {actionLoading
              ? <ActivityIndicator size="small" color={Colors.background} />
              : <Check size={18} color={Colors.background} />
            }
            <Text style={styles.approveBtnText}>Approve</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingBottom: 8, alignItems: 'flex-end' },
  closeBtn: { padding: 8 },
  content: { flex: 1, paddingHorizontal: 24, alignItems: 'center', paddingTop: 20 },
  iconWrap: {
    width: 88, height: 88, borderRadius: 24,
    backgroundColor: 'rgba(212,175,55,0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)',
    marginBottom: 24,
  },
  title: { fontSize: 24, fontWeight: '800', color: Colors.white, textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 15, color: Colors.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  infoCard: {
    width: '100%', backgroundColor: '#111', borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: Colors.border,
    gap: 12, marginBottom: 20,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoLabel: { fontSize: 13, color: Colors.textMuted },
  infoText: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  warning: { fontSize: 13, color: Colors.warning, textAlign: 'center', lineHeight: 20, marginBottom: 32, paddingHorizontal: 8 },
  actions: { flexDirection: 'row', gap: 14, width: '100%' },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(231,76,60,0.3)',
    backgroundColor: 'rgba(231,76,60,0.08)',
  },
  rejectBtnText: { fontSize: 16, fontWeight: '700', color: Colors.error },
  approveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16, borderRadius: 16,
    backgroundColor: Colors.success,
  },
  approveBtnText: { fontSize: 16, fontWeight: '700', color: Colors.background },
  backBtn: { marginTop: 24, paddingHorizontal: 32, paddingVertical: 14, backgroundColor: Colors.card, borderRadius: 12 },
  backBtnText: { color: Colors.textMuted, fontWeight: '600' },
});
