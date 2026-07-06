import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, CreditCard, Check, AlertCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';

interface SMSRefillModalProps {
  visible: boolean;
  onClose: () => void;
  adminId: string;
  adminName: string;
  currentBalance: number;
  onRefillComplete: (newBalance: number) => void;
}

const QUICK_AMOUNTS = [100, 250, 500, 1000];

export default function SMSRefillModal({
  visible,
  onClose,
  adminId,
  adminName,
  currentBalance,
  onRefillComplete,
}: SMSRefillModalProps) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [newBalance, setNewBalance] = useState<number | null>(null);

  const handleRefill = async () => {
    const refillAmount = parseInt(amount, 10);
    if (!refillAmount || refillAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-refill-sms', {
        body: {
          admin_id: adminId,
          amount: refillAmount,
          reason: reason || `Manual refill by super admin`,
        },
      });

      if (error) throw error;

      setSuccess(true);
      setNewBalance(data.balance_after);
      onRefillComplete(data.balance_after);

      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (e: any) {
      Alert.alert('Refill Failed', e.message || 'Failed to refill SMS credits. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setAmount('');
    setReason('');
    setSuccess(false);
    setNewBalance(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <CreditCard size={20} color={Colors.gold} />
              <Text style={styles.headerTitle}>Refill SMS Credits</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <X size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {success ? (
            <View style={styles.successContainer}>
              <View style={styles.successIcon}>
                <Check size={40} color="#2ECC71" />
              </View>
              <Text style={styles.successTitle}>Refill Successful!</Text>
              <Text style={styles.successMessage}>
                {amount} SMS credits added to {adminName}'s account.
              </Text>
              <Text style={styles.successBalance}>
                New Balance: {newBalance?.toLocaleString()} credits
              </Text>
            </View>
          ) : (
            <View style={styles.content}>
              <View style={styles.adminInfo}>
                <Text style={styles.adminLabel}>Refilling for:</Text>
                <Text style={styles.adminName}>{adminName}</Text>
                <Text style={styles.currentBalance}>
                  Current Balance: {currentBalance.toLocaleString()} credits
                </Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>Amount</Text>
                <View style={styles.quickAmounts}>
                  {QUICK_AMOUNTS.map((quickAmount) => (
                    <TouchableOpacity
                      key={quickAmount}
                      style={[
                        styles.quickAmountBtn,
                        amount === String(quickAmount) && styles.quickAmountBtnActive,
                      ]}
                      onPress={() => setAmount(String(quickAmount))}
                    >
                      <Text
                        style={[
                          styles.quickAmountText,
                          amount === String(quickAmount) && styles.quickAmountTextActive,
                        ]}
                      >
                        {quickAmount}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={styles.input}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="Enter custom amount"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>Reason (Optional)</Text>
                <TextInput
                  style={styles.input}
                  value={reason}
                  onChangeText={setReason}
                  placeholder="e.g. Monthly credit allocation"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              <View style={styles.summary}>
                <Text style={styles.summaryLabel}>New Balance Will Be:</Text>
                <Text style={styles.summaryValue}>
                  {currentBalance + (parseInt(amount, 10) || 0)} credits
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.refillBtn, loading && styles.refillBtnDisabled]}
                onPress={handleRefill}
                disabled={loading || !amount || parseInt(amount, 10) <= 0}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <CreditCard size={18} color="#fff" />
                    <Text style={styles.refillBtnText}>
                      Refill {amount ? `${amount} Credits` : ''}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  closeBtn: {
    padding: 4,
  },
  content: {
    padding: 16,
  },
  adminInfo: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  adminLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  adminName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  currentBalance: {
    fontSize: 13,
    color: Colors.gold,
    fontWeight: '600',
  },
  section: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  quickAmounts: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  quickAmountBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: Colors.card,
  },
  quickAmountBtnActive: {
    borderColor: Colors.gold,
    backgroundColor: Colors.gold + '15',
  },
  quickAmountText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  quickAmountTextActive: {
    color: Colors.gold,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    backgroundColor: Colors.card,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.gold + '10',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.gold + '30',
  },
  summaryLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.gold,
  },
  refillBtn: {
    backgroundColor: Colors.gold,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  refillBtnDisabled: {
    opacity: 0.6,
  },
  refillBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  successContainer: {
    alignItems: 'center',
    padding: 40,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2ECC7120',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  successBalance: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gold,
  },
});
