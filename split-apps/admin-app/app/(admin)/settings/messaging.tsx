import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native'
import { Stack } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import {
  MessageSquare,
  Send,
  Clock,
  BarChart3,
  Plus,
  X,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Trash2,
  Edit3,
  FileText,
  Users,
  DollarSign,
  Zap,
  Smartphone,
  ChevronDown,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Settings,
  Copy,
  Star,
  TrendingUp,
  Filter,
  CreditCard,
  Package,
  Gift,
  Shield,
  TrendingDown,
  Phone,
  Check,
  CircleDollarSign,
  Wallet,
  Cloud,
} from 'lucide-react-native'
import Colors from '@/constants/colors'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import SMSService from '@/services/sms'
import AdminService from '@/services/admin'

let LocalSmsGateway: any = null
try {
  LocalSmsGateway = require('@lenzart/local-sms-gateway').default
} catch {}

const TABS = [
  { key: 'compose', label: 'Compose', icon: MessageSquare },
  { key: 'credits', label: 'Credits', icon: Wallet },
  { key: 'templates', label: 'Templates', icon: FileText },
  { key: 'history', label: 'History', icon: Clock },
]

const SUPER_ADMIN_TABS = [
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'gateway', label: 'Gateway', icon: Settings },
  { key: 'packages', label: 'Packages', icon: Package },
  { key: 'balances', label: 'Balances', icon: Users },
  { key: 'revenue', label: 'Revenue', icon: DollarSign },
]

const STATUS_CONFIG: Record<string, { color: string; icon: any }> = {
  sent: { color: '#2ECC71', icon: CheckCircle },
  delivered: { color: '#2ECC71', icon: CheckCircle },
  failed: { color: '#E74C3C', icon: XCircle },
  pending: { color: '#F39C12', icon: AlertCircle },
  queued: { color: '#9B59B6', icon: Clock },
  completed: { color: '#2ECC71', icon: CheckCircle },
}

export default function MessagingScreen() {
  const insets = useSafeAreaInsets()
  const { user, profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'

  const [activeTab, setActiveTab] = useState(isSuperAdmin ? 'overview' : 'compose')
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)

  const [smsBalance, setSmsBalance] = useState(0)
  const [gatewayStatus, setGatewayStatus] = useState<any>(null)
  const [templates, setTemplates] = useState<any[]>([])
  const [smsLogs, setSmsLogs] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [packages, setPackages] = useState<any[]>([])
  const [purchaseHistory, setPurchaseHistory] = useState<any[]>([])

  const [recipientModalVisible, setRecipientModalVisible] = useState(false)
  const [templateModalVisible, setTemplateModalVisible] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<any>(null)
  const [templateName, setTemplateName] = useState('')
  const [templateBody, setTemplateBody] = useState('')
  const [isDefaultTemplate, setIsDefaultTemplate] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClient, setSelectedClient] = useState<any>(null)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [messageText, setMessageText] = useState('')
  const [sending, setSending] = useState(false)
  const [signature, setSignature] = useState('')

  const [storeModalVisible, setStoreModalVisible] = useState(false)
  const [selectedPackage, setSelectedPackage] = useState<any>(null)
  const [buying, setBuying] = useState(false)
  const [mpesaPhone, setMpesaPhone] = useState('')
  const [processingPayment, setProcessingPayment] = useState(false)

  const [adminBalances, setAdminBalances] = useState<any[]>([])
  const [revenueData, setRevenueData] = useState<any>(null)
  const [editingPackage, setEditingPackage] = useState<any>(null)
  const [packageModalVisible, setPackageModalVisible] = useState(false)
  const [packageName, setPackageName] = useState('')
  const [packageSmsCount, setPackageSmsCount] = useState('')
  const [packagePrice, setPackagePrice] = useState('')
  const [packageDescription, setPackageDescription] = useState('')
  const [packageBonusSms, setPackageBonusSms] = useState('')
  const [storageInfo, setStorageInfo] = useState({ used_mb: 0, total_mb: 10240, extra_mb: 0, galleries: 0 })

  const [adjustmentModalVisible, setAdjustmentModalVisible] = useState(false)
  const [selectedAdmin, setSelectedAdmin] = useState<any>(null)
  const [adjustmentAmount, setAdjustmentAmount] = useState('')
  const [adjustmentReason, setAdjustmentReason] = useState('')

  // Gateway config state
  const [gatewayApiKey, setGatewayApiKey] = useState('')
  const [gatewayUsername, setGatewayUsername] = useState('epixvisuals')
  const [gatewaySenderId, setGatewaySenderId] = useState('')
  const [savingGateway, setSavingGateway] = useState(false)

  // Commission state
  const [commissionPercent, setCommissionPercent] = useState('5')
  const [savingCommission, setSavingCommission] = useState(false)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)

      const [templatesRes, logsRes, clientsRes, packagesRes, purchaseRes] = await Promise.all([
        supabase.from('sms_templates').select('*').order('created_at', { ascending: false }),
        supabase.from('sms_logs').select('*').order('created_at', { ascending: false }).limit(100),
        AdminService.getClients(),
        supabase.from('sms_credit_packages').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('sms_purchase_transactions').select('*').order('created_at', { ascending: false }).limit(50),
      ])

      setTemplates(templatesRes.data || [])
      setSmsLogs(logsRes.data || [])
      setClients(clientsRes || [])
      setPackages(packagesRes.data || [])
      setPurchaseHistory(purchaseRes.data || [])

      const [{ data: resourceData }, { data: storageAlloc }, { data: storageUsage }, { data: galleryCount }] = await Promise.all([
        supabase.from('admin_resources').select('sms_balance').eq('admin_id', user?.id).single(),
        supabase.from('admin_storage_allocations').select('*').eq('admin_id', user?.id).single(),
        supabase.from('admin_storage_usage').select('used_mb').eq('admin_id', user?.id).single(),
        supabase.from('galleries').select('id', { count: 'exact', head: true }).eq('admin_id', user?.id),
      ])

      setSmsBalance(resourceData?.sms_balance || 0)
      if (storageAlloc) {
        setStorageInfo({
          used_mb: storageUsage?.used_mb || 0,
          total_mb: (storageAlloc.base_storage_mb || 10240) + (storageAlloc.extra_storage_mb || 0),
          extra_mb: storageAlloc.extra_storage_mb || 0,
          galleries: galleryCount || 0,
        })
      }

      if (LocalSmsGateway) {
        try {
          const status = await LocalSmsGateway.getStatus()
          setGatewayStatus(status)
        } catch {
          setGatewayStatus({ online: false })
        }
      }

      if (isSuperAdmin) {
        const { data: adminsData } = await supabase
          .from('admin_resources')
          .select(`
            *,
            user_profiles!inner(id, name, email, role)
          `)
          .order('sms_balance', { ascending: false })

        setAdminBalances(adminsData || [])

        // Load gateway config from platform_settings
        const { data: gwSettings } = await supabase
          .from('platform_settings')
          .select('key, value')
          .in('key', ['africastalking_api_key', 'africastalking_username', 'sms_sender_id', 'sms_commission_percent'])

        if (gwSettings) {
          const config = Object.fromEntries(gwSettings.map((s: any) => [s.key, s.value]))
          setGatewayApiKey(config.africastalking_api_key || '')
          setGatewayUsername(config.africastalking_username || 'epixvisuals')
          setGatewaySenderId(config.sms_sender_id || '')
          setCommissionPercent(config.sms_commission_percent || '5')
        }

        const totalRevenue = purchaseRes.data?.reduce((sum: number, t: any) => {
          if (t.status === 'completed') return sum + (t.amount || 0)
          return sum
        }, 0) || 0

        const totalSmsSold = purchaseRes.data?.reduce((sum: number, t: any) => {
          if (t.status === 'completed') return sum + (t.total_sms || 0)
          return sum
        }, 0) || 0

        setRevenueData({
          totalRevenue,
          totalSmsSold,
          totalTransactions: purchaseRes.data?.length || 0,
          completedTransactions: purchaseRes.data?.filter((t: any) => t.status === 'completed').length || 0,
        })
      }

      const defaultSig = templates.find((t: any) => t.is_default)
      if (defaultSig) setSignature(defaultSig.signature || '')
    } catch (err) {
      console.error('Failed to load messaging data:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.id, isSuperAdmin])

  useEffect(() => {
    loadData()
  }, [loadData])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }, [loadData])

  const sendSMS = async () => {
    if (!messageText.trim()) {
      Alert.alert('Error', 'Please enter a message')
      return
    }
    if (!phoneNumber.trim() && !selectedClient) {
      Alert.alert('Error', 'Please select a recipient')
      return
    }
    if (smsBalance <= 0) {
      Alert.alert('Insufficient Credits', 'Please buy SMS credits to send messages.')
      return
    }

    try {
      setSending(true)
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

      const recipient = selectedClient?.phone || phoneNumber
      const recipientName = selectedClient?.name || 'Direct'

      const { error: deductError } = await supabase.rpc('decrement_sms_balance', {
        p_admin_id: user?.id,
        p_amount: 1,
      })

      if (deductError) throw deductError

      await SMSService.send({
        phoneNumber: recipient,
        message: messageText + (signature ? `\n\n${signature}` : ''),
        clientId: selectedClient?.id || undefined,
      })

      await supabase.from('sms_logs').insert({
        phone_number: recipient,
        client_name: recipientName,
        client_id: selectedClient?.id || null,
        message: messageText,
        signature,
        status: 'sent',
        provider: 'local_gateway',
        cost: 1,
        user_id: user?.id,
        owner_admin_id: user?.id,
      })

      setSmsBalance(prev => Math.max(0, prev - 1))
      Alert.alert('Success', 'SMS sent successfully')
      setMessageText('')
      setSelectedClient(null)
      setPhoneNumber('')
      await loadData()
    } catch (err: any) {
      Alert.alert('Failed', err.message || 'Failed to send SMS')
    } finally {
      setSending(false)
    }
  }

  const initiatePurchase = (pkg: any) => {
    setSelectedPackage(pkg)
    setMpesaPhone('')
    setStoreModalVisible(true)
  }

  const processMpesaPayment = async () => {
    if (!mpesaPhone.trim()) {
      Alert.alert('Error', 'Enter your M-Pesa phone number')
      return
    }

    try {
      setProcessingPayment(true)
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

      const totalSms = (selectedPackage.sms_count || 0) + (selectedPackage.bonus_sms || 0)

      const { data: txData, error: txError } = await supabase
        .from('sms_purchase_transactions')
        .insert({
          admin_id: user?.id,
          package_id: selectedPackage.id,
          sms_amount: selectedPackage.sms_count,
          bonus_sms: selectedPackage.bonus_sms || 0,
          total_sms: totalSms,
          amount: selectedPackage.price,
          currency: selectedPackage.currency || 'KES',
          payment_method: 'mpesa',
          status: 'pending',
        })
        .select()
        .single()

      if (txError) throw txError

      const { data: mpesaData, error: mpesaError } = await supabase.functions.invoke('mpesa-stk-push', {
        body: {
          phone_number: mpesaPhone,
          amount: selectedPackage.price,
          account_reference: `SMS-${txData.id.slice(0, 8)}`,
          transaction_desc: `Purchase ${totalSms} SMS credits`,
        },
      })

      if (mpesaError) throw mpesaError

      if (mpesaData?.success) {
        await supabase
          .from('sms_purchase_transactions')
          .update({
            checkout_request_id: mpesaData.checkout_request_id,
            status: 'processing',
          })
          .eq('id', txData.id)

        Alert.alert(
          'STK Push Sent',
          `Check your phone (${mpesaPhone}) for the M-Pesa payment prompt. Enter your PIN to complete.`,
        )

        pollTransactionStatus(txData.id)
      } else {
        throw new Error(mpesaData?.error || 'Failed to initiate M-Pesa payment')
      }

      setStoreModalVisible(false)
      setSelectedPackage(null)
      setMpesaPhone('')
    } catch (err: any) {
      Alert.alert('Payment Failed', err.message || 'Failed to process payment')
    } finally {
      setProcessingPayment(false)
    }
  }

  const pollTransactionStatus = async (transactionId: string) => {
    let attempts = 0
    const maxAttempts = 30

    const poll = async () => {
      if (attempts >= maxAttempts) return

      const { data } = await supabase
        .from('sms_purchase_transactions')
        .select('status')
        .eq('id', transactionId)
        .single()

      if (data?.status === 'completed') {
        // Apply super admin commission
        try {
          const { data: txData } = await supabase
            .from('sms_purchase_transactions')
            .select('amount, admin_id')
            .eq('id', transactionId)
            .single()

          if (txData?.amount) {
            const { data: settings } = await supabase
              .from('platform_settings')
              .select('value')
              .eq('key', 'sms_commission_percent')
              .single()

            const commissionPct = parseFloat(settings?.value || '5')
            if (commissionPct > 0) {
              const commissionAmount = Math.ceil(txData.amount * commissionPct / 100)
              // Deduct commission from photographer's SMS balance
              await supabase.rpc('decrement_sms_balance', {
                p_admin_id: txData.admin_id,
                p_amount: commissionAmount,
              })
              // Credit commission to super admin's till account
              const { data: superAdmin } = await supabase
                .from('user_profiles')
                .select('id')
                .eq('role', 'super_admin')
                .limit(1)
                .single()
              if (superAdmin?.id) {
                await supabase.rpc('increment_sms_balance', {
                  p_admin_id: superAdmin.id,
                  p_amount: commissionAmount,
                })
                // Log commission transaction
                await supabase.from('sms_purchase_transactions').insert({
                  admin_id: superAdmin.id,
                  sms_amount: 0,
                  bonus_sms: 0,
                  total_sms: 0,
                  amount: commissionAmount,
                  currency: 'KES',
                  payment_method: 'commission',
                  status: 'completed',
                  package_id: null,
                } as any)
              }
            }
          }
        } catch (e) {
          console.error('[Commission] Failed:', e)
        }

        await loadData()
        Alert.alert('Payment Confirmed', 'SMS credits have been added to your balance!')
        return
      }

      if (data?.status === 'failed') {
        Alert.alert('Payment Failed', 'The payment was not completed. Please try again.')
        return
      }

      attempts++
      if (attempts < maxAttempts) {
        setTimeout(poll, 3000)
      }
    }

    setTimeout(poll, 5000)
  }

  const saveTemplate = async () => {
    if (!templateName.trim() || !templateBody.trim()) {
      Alert.alert('Error', 'Name and body are required')
      return
    }

    try {
      if (isDefaultTemplate) {
        await supabase.from('sms_templates').update({ is_default: false }).eq('is_default', true)
      }

      const payload = {
        name: templateName,
        body: templateBody,
        is_default: isDefaultTemplate,
        owner_admin_id: user?.id,
      }

      if (editingTemplate) {
        await supabase.from('sms_templates').update(payload).eq('id', editingTemplate.id)
      } else {
        await supabase.from('sms_templates').insert(payload)
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setTemplateModalVisible(false)
      resetTemplateForm()
      await loadData()
    } catch (err: any) {
      Alert.alert('Failed', err.message || 'Failed to save template')
    }
  }

  const deleteTemplate = async (id: string) => {
    Alert.alert('Delete Template', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('sms_templates').delete().eq('id', id)
          await loadData()
        },
      },
    ])
  }

  const resetTemplateForm = () => {
    setTemplateName('')
    setTemplateBody('')
    setIsDefaultTemplate(false)
    setEditingTemplate(null)
  }

  const openTemplateEditor = (template?: any) => {
    if (template) {
      setEditingTemplate(template)
      setTemplateName(template.name)
      setTemplateBody(template.body)
      setIsDefaultTemplate(template.is_default || false)
    } else {
      resetTemplateForm()
    }
    setTemplateModalVisible(true)
  }

  const applyTemplate = (template: any) => {
    setMessageText(template.body)
    setTemplateModalVisible(false)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  const savePackage = async () => {
    if (!packageName.trim() || !packageSmsCount.trim() || !packagePrice.trim()) {
      Alert.alert('Error', 'Name, SMS count, and price are required')
      return
    }

    try {
      const payload = {
        name: packageName,
        sms_count: parseInt(packageSmsCount),
        price: parseFloat(packagePrice),
        description: packageDescription || `${packageSmsCount} SMS credits`,
        bonus_sms: parseInt(packageBonusSms || '0'),
        is_active: true,
      }

      if (editingPackage) {
        await supabase.from('sms_credit_packages').update(payload).eq('id', editingPackage.id)
      } else {
        await supabase.from('sms_credit_packages').insert(payload)
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setPackageModalVisible(false)
      resetPackageForm()
      await loadData()
    } catch (err: any) {
      Alert.alert('Failed', err.message || 'Failed to save package')
    }
  }

  const deletePackage = async (id: string) => {
    Alert.alert('Delete Package', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('sms_credit_packages').delete().eq('id', id)
          await loadData()
        },
      },
    ])
  }

  const resetPackageForm = () => {
    setPackageName('')
    setPackageSmsCount('')
    setPackagePrice('')
    setPackageDescription('')
    setPackageBonusSms('')
    setEditingPackage(null)
  }

  const openPackageEditor = (pkg?: any) => {
    if (pkg) {
      setEditingPackage(pkg)
      setPackageName(pkg.name)
      setPackageSmsCount(String(pkg.sms_count))
      setPackagePrice(String(pkg.price))
      setPackageDescription(pkg.description || '')
      setPackageBonusSms(String(pkg.bonus_sms || ''))
    } else {
      resetPackageForm()
    }
    setPackageModalVisible(true)
  }

  const processAdjustment = async () => {
    if (!selectedAdmin || !adjustmentAmount.trim()) {
      Alert.alert('Error', 'Select an admin and enter amount')
      return
    }

    const amount = parseInt(adjustmentAmount)
    if (isNaN(amount) || amount === 0) {
      Alert.alert('Error', 'Enter a valid amount')
      return
    }

    try {
      const fn = amount > 0 ? 'increment_sms_balance' : 'decrement_sms_balance'
      const absAmount = Math.abs(amount)

      const { error } = await supabase.rpc(fn, {
        p_admin_id: selectedAdmin.admin_id,
        p_amount: absAmount,
      })

      if (error) throw error

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      Alert.alert('Success', `${amount > 0 ? 'Added' : 'Deducted'} ${absAmount} credits`)
      setAdjustmentModalVisible(false)
      setSelectedAdmin(null)
      setAdjustmentAmount('')
      setAdjustmentReason('')
      await loadData()
    } catch (err: any) {
      Alert.alert('Failed', err.message || 'Failed to adjust credits')
    }
  }

  const saveGatewayConfig = async () => {
    if (!gatewayApiKey.trim()) {
      Alert.alert('Error', 'Africa\'s Talking API key is required')
      return
    }
    try {
      setSavingGateway(true)
      const updates = [
        supabase.from('platform_settings').upsert({ key: 'africastalking_api_key', value: gatewayApiKey.trim() }),
        supabase.from('platform_settings').upsert({ key: 'africastalking_username', value: gatewayUsername.trim() || 'epixvisuals' }),
        supabase.from('platform_settings').upsert({ key: 'sms_sender_id', value: gatewaySenderId.trim() }),
      ]
      const results = await Promise.all(updates)
      const hasError = results.some(r => r.error)
      if (hasError) throw new Error('Failed to save one or more settings')
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      Alert.alert('Success', 'SMS gateway configuration saved')
    } catch (err: any) {
      Alert.alert('Failed', err.message || 'Failed to save gateway config')
    } finally {
      setSavingGateway(false)
    }
  }

  const saveCommissionConfig = async () => {
    const pct = parseFloat(commissionPercent)
    if (isNaN(pct) || pct < 0 || pct > 50) {
      Alert.alert('Error', 'Commission must be between 0% and 50%')
      return
    }
    try {
      setSavingCommission(true)
      await supabase.from('platform_settings').upsert({ key: 'sms_commission_percent', value: String(pct) })
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      Alert.alert('Success', `Commission set to ${pct}% on SMS refills`)
    } catch (err: any) {
      Alert.alert('Failed', err.message || 'Failed to save commission')
    } finally {
      setSavingCommission(false)
    }
  }

  const filteredClients = useMemo(() => {
    if (!searchQuery) return clients
    const q = searchQuery.toLowerCase()
    return clients.filter(
      (c: any) =>
        c.name?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.email?.toLowerCase().includes(q)
    )
  }, [clients, searchQuery])

  const charCount = messageText.length + (signature ? signature.length + 2 : 0)
  const maxChars = 160

  const renderCreditsBalance = () => (
    <View style={styles.balanceCard}>
      <View style={styles.balanceHeader}>
        <View style={styles.balanceIconContainer}>
          <Wallet size={24} color={Colors.gold} />
        </View>
        <View style={styles.balanceInfo}>
          <Text style={styles.balanceLabel}>SMS Credits</Text>
          <Text style={styles.balanceValue}>{smsBalance.toLocaleString()}</Text>
        </View>
        <TouchableOpacity
          style={styles.buyCreditsBtn}
          onPress={() => setStoreModalVisible(true)}
        >
          <Plus size={16} color="#fff" />
          <Text style={styles.buyCreditsBtnText}>Buy</Text>
        </TouchableOpacity>
      </View>
      {smsBalance <= 10 && (
        <View style={styles.lowBalanceWarning}>
          <AlertCircle size={14} color="#F39C12" />
          <Text style={styles.lowBalanceText}>Low balance! Buy more credits to continue sending.</Text>
        </View>
      )}
    </View>
  )

  const renderComposeTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {renderCreditsBalance()}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SMS Signature</Text>
        <TextInput
          style={styles.input}
          value={signature}
          onChangeText={setSignature}
          placeholder="Your signature..."
          placeholderTextColor={Colors.textMuted}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recipient</Text>
        <TouchableOpacity style={styles.recipientSelector} onPress={() => setRecipientModalVisible(true)}>
          {selectedClient ? (
            <View style={styles.selectedRecipient}>
              <Users size={18} color={Colors.gold} />
              <View style={styles.recipientInfo}>
                <Text style={styles.recipientName}>{selectedClient.name}</Text>
                <Text style={styles.recipientPhone}>{selectedClient.phone}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedClient(null)}>
                <X size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Users size={18} color={Colors.textMuted} />
              <Text style={styles.recipientPlaceholder}>Select a client or enter phone number</Text>
              <ChevronDown size={18} color={Colors.textMuted} />
            </>
          )}
        </TouchableOpacity>

        {!selectedClient && (
          <View style={styles.phoneInputRow}>
            <TextInput
              style={[styles.input, styles.phoneInput]}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="+254 7XX XXX XXX"
              placeholderTextColor={Colors.textMuted}
              keyboardType="phone-pad"
            />
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Message</Text>
          <TouchableOpacity onPress={() => { setEditingTemplate(null); setTemplateModalVisible(true) }}>
            <Text style={styles.applyTemplateText}>Templates</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={[styles.input, styles.messageInput]}
          value={messageText}
          onChangeText={setMessageText}
          placeholder="Type your message..."
          placeholderTextColor={Colors.textMuted}
          multiline
          textAlignVertical="top"
        />
        <View style={styles.charCountRow}>
          <Text style={[styles.charCount, charCount > maxChars && styles.charCountOver]}>
            {charCount}/{maxChars}
          </Text>
        </View>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.sendBtn, (sending || smsBalance <= 0) && styles.sendBtnDisabled]}
          onPress={sendSMS}
          disabled={sending || smsBalance <= 0}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Send size={18} color="#fff" />
          )}
          <Text style={styles.sendBtnText}>Send SMS (1 Credit)</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  )

  const renderCreditsTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.creditsHeader}>
        <View style={styles.creditsBalanceLarge}>
          <Wallet size={32} color={Colors.gold} />
          <Text style={styles.creditsBalanceValue}>{smsBalance.toLocaleString()}</Text>
          <Text style={styles.creditsBalanceLabel}>SMS Credits Available</Text>
        </View>
        <TouchableOpacity
          style={styles.buyCreditsLargeBtn}
          onPress={() => setStoreModalVisible(true)}
        >
          <CreditCard size={20} color="#fff" />
          <Text style={styles.buyCreditsLargeBtnText}>Buy More Credits</Text>
        </TouchableOpacity>
      </View>

      {/* Storage Info */}
      <View style={[styles.section, { backgroundColor: 'rgba(147,51,234,0.08)', borderRadius: 16, padding: 16, marginTop: 16 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Cloud size={20} color="#9333EA" />
          <Text style={[styles.sectionTitle, { color: '#C084FC', marginBottom: 0 }]}>Cloud Storage</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 10 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 10 }}>
            <Text style={{ fontSize: 11, color: Colors.textMuted }}>Used</Text>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#C084FC' }}>{(storageInfo.used_mb / 1024).toFixed(1)} GB</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 10 }}>
            <Text style={{ fontSize: 11, color: Colors.textMuted }}>Total</Text>
            <Text style={{ fontSize: 18, fontWeight: '800', color: Colors.text }}>{(storageInfo.total_mb / 1024).toFixed(1)} GB</Text>
          </View>
        </View>
        <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
          <View style={{
            height: 6, borderRadius: 3, width: `${Math.min(100, (storageInfo.used_mb / storageInfo.total_mb) * 100)}%`,
            backgroundColor: '#9333EA',
          }} />
        </View>
        <Text style={{ fontSize: 10, color: Colors.textMuted, marginTop: 6 }}>{storageInfo.galleries} galleries · {storageInfo.extra_mb > 0 ? `${(storageInfo.extra_mb / 1024).toFixed(1)} GB extra purchased` : 'Base 10 GB'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Purchases</Text>
        {purchaseHistory.length === 0 ? (
          <View style={styles.emptyStateSmall}>
            <Text style={styles.emptySubtitle}>No purchases yet</Text>
          </View>
        ) : (
          purchaseHistory.slice(0, 5).map((purchase: any) => (
            <View key={purchase.id} style={styles.purchaseCard}>
              <View style={styles.purchaseLeft}>
                <View style={[styles.purchaseStatusIcon, { backgroundColor: STATUS_CONFIG[purchase.status]?.color + '20' }]}>
                  {purchase.status === 'completed' ? (
                    <CheckCircle size={16} color={STATUS_CONFIG[purchase.status]?.color} />
                  ) : purchase.status === 'failed' ? (
                    <XCircle size={16} color={STATUS_CONFIG[purchase.status]?.color} />
                  ) : (
                    <Clock size={16} color={STATUS_CONFIG[purchase.status]?.color} />
                  )}
                </View>
                <View style={styles.purchaseInfo}>
                  <Text style={styles.purchaseAmount}>{purchase.total_sms} SMS Credits</Text>
                  <Text style={styles.purchaseDate}>
                    {new Date(purchase.created_at).toLocaleDateString()} {new Date(purchase.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
              <View style={styles.purchaseRight}>
                <Text style={styles.purchasePrice}>KES {purchase.amount}</Text>
                <Text style={[styles.purchaseStatus, { color: STATUS_CONFIG[purchase.status]?.color }]}>
                  {purchase.status}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  )

  const renderTemplatesTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Templates</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => openTemplateEditor()}>
          <Plus size={16} color="#fff" />
          <Text style={styles.addBtnText}>Add Template</Text>
        </TouchableOpacity>
      </View>

      {templates.length === 0 ? (
        <View style={styles.emptyState}>
          <FileText size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No Templates</Text>
          <Text style={styles.emptySubtitle}>Create templates to speed up messaging</Text>
        </View>
      ) : (
        templates.map((template: any) => (
          <TouchableOpacity
            key={template.id}
            style={styles.templateCard}
            onPress={() => applyTemplate(template)}
          >
            <View style={styles.templateHeader}>
              <View style={styles.templateNameRow}>
                <Text style={styles.templateName}>{template.name}</Text>
                {template.is_default && (
                  <View style={styles.defaultBadge}>
                    <Star size={10} color={Colors.gold} />
                    <Text style={styles.defaultBadgeText}>Default</Text>
                  </View>
                )}
              </View>
              <View style={styles.templateActions}>
                <TouchableOpacity onPress={() => openTemplateEditor(template)} style={styles.templateActionBtn}>
                  <Edit3 size={14} color={Colors.gold} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteTemplate(template.id)} style={styles.templateActionBtn}>
                  <Trash2 size={14} color="#E74C3C" />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.templatePreview} numberOfLines={3}>
              {template.body}
            </Text>
            <View style={styles.templateHintRow}>
              <Text style={styles.variableHint}>Variables: {'{client_name}'}, {'{access_code}'}, {'{gallery_name}'}, {'{app_link}'}, {'{business_name}'}</Text>
            </View>
          </TouchableOpacity>
        ))
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  )

  const renderHistoryTab = () => (
    <FlatList
      data={smsLogs}
      keyExtractor={(item: any) => item.id}
      style={styles.tabContent}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Clock size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No SMS History</Text>
          <Text style={styles.emptySubtitle}>Sent messages will appear here</Text>
        </View>
      }
      renderItem={({ item }: { item: any }) => {
        const statusConf = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending
        const StatusIcon = statusConf.icon
        return (
          <View style={styles.logCard}>
            <View style={styles.logLeft}>
              <View style={[styles.logStatusIcon, { backgroundColor: statusConf.color + '20' }]}>
                <StatusIcon size={14} color={statusConf.color} />
              </View>
              <View style={styles.logInfo}>
                <Text style={styles.logClient}>{item.client_name || item.phone_number}</Text>
                <Text style={styles.logMessage} numberOfLines={1}>{item.message}</Text>
                <Text style={styles.logTimestamp}>
                  {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
            <View style={styles.logRight}>
              <Text style={[styles.logStatus, { color: statusConf.color }]}>{item.status}</Text>
              {item.cost > 0 && <Text style={styles.logCost}>-{item.cost} credit</Text>}
            </View>
          </View>
        )
      }}
    />
  )

  const renderSuperAdminOverview = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <View style={[styles.metricIcon, { backgroundColor: Colors.gold + '20' }]}>
            <DollarSign size={18} color={Colors.gold} />
          </View>
          <Text style={styles.metricValue}>KES {revenueData?.totalRevenue?.toLocaleString() || '0'}</Text>
          <Text style={styles.metricLabel}>Total Revenue</Text>
        </View>
        <View style={styles.metricCard}>
          <View style={[styles.metricIcon, { backgroundColor: '#2ECC7120' }]}>
            <MessageSquare size={18} color="#2ECC71" />
          </View>
          <Text style={styles.metricValue}>{revenueData?.totalSmsSold?.toLocaleString() || '0'}</Text>
          <Text style={styles.metricLabel}>SMS Credits Sold</Text>
        </View>
        <View style={styles.metricCard}>
          <View style={[styles.metricIcon, { backgroundColor: '#3498DB20' }]}>
            <CheckCircle size={18} color="#3498DB" />
          </View>
          <Text style={styles.metricValue}>{revenueData?.completedTransactions || '0'}</Text>
          <Text style={styles.metricLabel}>Completed</Text>
        </View>
        <View style={styles.metricCard}>
          <View style={[styles.metricIcon, { backgroundColor: '#F39C1220' }]}>
            <Users size={18} color="#F39C12" />
          </View>
          <Text style={styles.metricValue}>{adminBalances.length}</Text>
          <Text style={styles.metricLabel}>Active Admins</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Admin Balances</Text>
        {adminBalances.slice(0, 5).map((admin: any) => (
          <View key={admin.admin_id} style={styles.adminBalanceCard}>
            <View style={styles.adminLeft}>
              <View style={styles.adminAvatar}>
                <Text style={styles.adminAvatarText}>{admin.user_profiles?.name?.charAt(0) || '?'}</Text>
              </View>
              <View style={styles.adminInfo}>
                <Text style={styles.adminName}>{admin.user_profiles?.name || 'Unknown'}</Text>
                <Text style={styles.adminEmail}>{admin.user_profiles?.email}</Text>
              </View>
            </View>
            <View style={styles.adminRight}>
              <Text style={styles.adminBalance}>{admin.sms_balance || 0}</Text>
              <Text style={styles.adminBalanceLabel}>credits</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  )

  const renderSuperAdminPackages = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Credit Packages</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => openPackageEditor()}>
          <Plus size={16} color="#fff" />
          <Text style={styles.addBtnText}>Add Package</Text>
        </TouchableOpacity>
      </View>

      {packages.length === 0 ? (
        <View style={styles.emptyState}>
          <Package size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No Packages</Text>
          <Text style={styles.emptySubtitle}>Create packages for admins to purchase</Text>
        </View>
      ) : (
        packages.map((pkg: any) => (
          <View key={pkg.id} style={styles.packageCard}>
            <View style={styles.packageHeader}>
              <View style={styles.packageNameRow}>
                <Text style={styles.packageName}>{pkg.name}</Text>
                {pkg.bonus_sms > 0 && (
                  <View style={styles.bonusBadge}>
                    <Gift size={10} color={Colors.gold} />
                    <Text style={styles.bonusBadgeText}>+{pkg.bonus_sms} bonus</Text>
                  </View>
                )}
              </View>
              <View style={styles.packageActions}>
                <TouchableOpacity onPress={() => openPackageEditor(pkg)} style={styles.packageActionBtn}>
                  <Edit3 size={14} color={Colors.gold} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deletePackage(pkg.id)} style={styles.packageActionBtn}>
                  <Trash2 size={14} color="#E74C3C" />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.packageDetails}>
              <View style={styles.packageDetailItem}>
                <Text style={styles.packageDetailValue}>{pkg.sms_count + (pkg.bonus_sms || 0)}</Text>
                <Text style={styles.packageDetailLabel}>Total SMS</Text>
              </View>
              <View style={styles.packageDetailItem}>
                <Text style={styles.packageDetailValue}>KES {pkg.price}</Text>
                <Text style={styles.packageDetailLabel}>Price</Text>
              </View>
              <View style={styles.packageDetailItem}>
                <Text style={styles.packageDetailValue}>KES {(pkg.price / (pkg.sms_count + (pkg.bonus_sms || 0))).toFixed(2)}</Text>
                <Text style={styles.packageDetailLabel}>Per SMS</Text>
              </View>
            </View>
            {pkg.description && (
              <Text style={styles.packageDescription}>{pkg.description}</Text>
            )}
          </View>
        ))
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  )

  const renderSuperAdminBalances = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>All Admin Balances</Text>
      </View>

      {adminBalances.map((admin: any) => (
        <View key={admin.admin_id} style={styles.adminBalanceCard}>
          <View style={styles.adminLeft}>
            <View style={styles.adminAvatar}>
              <Text style={styles.adminAvatarText}>{admin.user_profiles?.name?.charAt(0) || '?'}</Text>
            </View>
            <View style={styles.adminInfo}>
              <Text style={styles.adminName}>{admin.user_profiles?.name || 'Unknown'}</Text>
              <Text style={styles.adminEmail}>{admin.user_profiles?.email}</Text>
            </View>
          </View>
          <View style={styles.adminRight}>
            <Text style={styles.adminBalance}>{admin.sms_balance || 0}</Text>
            <Text style={styles.adminBalanceLabel}>credits</Text>
          </View>
          <TouchableOpacity
            style={styles.adjustBtn}
            onPress={() => {
              setSelectedAdmin(admin)
              setAdjustmentAmount('')
              setAdjustmentReason('')
              setAdjustmentModalVisible(true)
            }}
          >
            <Settings size={14} color={Colors.gold} />
          </TouchableOpacity>
        </View>
      ))}

      <View style={{ height: 40 }} />
    </ScrollView>
  )

  const renderSuperAdminRevenue = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Purchase History</Text>
        {purchaseHistory.length === 0 ? (
          <View style={styles.emptyStateSmall}>
            <Text style={styles.emptySubtitle}>No transactions yet</Text>
          </View>
        ) : (
          purchaseHistory.map((purchase: any) => (
            <View key={purchase.id} style={styles.purchaseCard}>
              <View style={styles.purchaseLeft}>
                <View style={[styles.purchaseStatusIcon, { backgroundColor: STATUS_CONFIG[purchase.status]?.color + '20' }]}>
                  {purchase.status === 'completed' ? (
                    <CheckCircle size={16} color={STATUS_CONFIG[purchase.status]?.color} />
                  ) : purchase.status === 'failed' ? (
                    <XCircle size={16} color={STATUS_CONFIG[purchase.status]?.color} />
                  ) : (
                    <Clock size={16} color={STATUS_CONFIG[purchase.status]?.color} />
                  )}
                </View>
                <View style={styles.purchaseInfo}>
                  <Text style={styles.purchaseAmount}>{purchase.total_sms} SMS Credits</Text>
                  <Text style={styles.purchaseDate}>
                    {new Date(purchase.created_at).toLocaleDateString()} {new Date(purchase.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
              <View style={styles.purchaseRight}>
                <Text style={styles.purchasePrice}>KES {purchase.amount}</Text>
                <Text style={[styles.purchaseStatus, { color: STATUS_CONFIG[purchase.status]?.color }]}>
                  {purchase.status}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  )

  const renderSuperAdminGateway = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Africa's Talking Config */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Smartphone size={18} color={Colors.gold} />
          <Text style={styles.sectionTitle}>Africa's Talking SMS Gateway</Text>
        </View>
        <Text style={[styles.emptySubtitle, { marginBottom: 16, textAlign: 'left' }]}>
          Configure your Africa's Talking API credentials. These are used to send SMS to clients when galleries are published.
        </Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>API Key *</Text>
          <TextInput
            style={styles.input}
            value={gatewayApiKey}
            onChangeText={setGatewayApiKey}
            placeholder="Enter your Africa's Talking API key"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry
            autoCapitalize="none"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Username</Text>
          <TextInput
            style={styles.input}
            value={gatewayUsername}
            onChangeText={setGatewayUsername}
            placeholder="epixvisuals"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Sender ID (optional)</Text>
          <TextInput
            style={styles.input}
            value={gatewaySenderId}
            onChangeText={setGatewaySenderId}
            placeholder="e.g. EPIX"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="characters"
          />
        </View>

        <TouchableOpacity
          style={[styles.sendBtn, savingGateway && styles.sendBtnDisabled]}
          onPress={saveGatewayConfig}
          disabled={savingGateway}
        >
          {savingGateway ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Settings size={18} color="#fff" />
          )}
          <Text style={styles.sendBtnText}>Save Gateway Config</Text>
        </TouchableOpacity>
      </View>

      {/* Commission Settings */}
      <View style={[styles.section, { marginTop: 24 }]}>
        <View style={styles.sectionTitleRow}>
          <CircleDollarSign size={18} color={Colors.gold} />
          <Text style={styles.sectionTitle}>Super Admin Commission</Text>
        </View>
        <Text style={[styles.emptySubtitle, { marginBottom: 16, textAlign: 'left' }]}>
          Set the percentage fee that goes to the super admin's till account when photographers purchase SMS credits.
        </Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Commission Percentage (%)</Text>
          <TextInput
            style={styles.input}
            value={commissionPercent}
            onChangeText={setCommissionPercent}
            placeholder="5"
            placeholderTextColor={Colors.textMuted}
            keyboardType="numeric"
          />
        </View>

        <TouchableOpacity
          style={[styles.sendBtn, savingCommission && styles.sendBtnDisabled]}
          onPress={saveCommissionConfig}
          disabled={savingCommission}
        >
          {savingCommission ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <CircleDollarSign size={18} color="#fff" />
          )}
          <Text style={styles.sendBtnText}>Save Commission Rate</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  )

  const renderStoreModal = () => (
    <Modal visible={storeModalVisible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <CreditCard size={20} color={Colors.gold} />
              <Text style={styles.modalTitle}>Buy SMS Credits</Text>
            </View>
            <TouchableOpacity onPress={() => setStoreModalVisible(false)}>
              <X size={22} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <View style={styles.storeBalanceCard}>
              <Text style={styles.storeBalanceLabel}>Current Balance</Text>
              <Text style={styles.storeBalanceValue}>{smsBalance.toLocaleString()} credits</Text>
            </View>

            <Text style={styles.fieldLabel}>Select a Package</Text>
            {packages.map((pkg: any) => {
              const totalSms = pkg.sms_count + (pkg.bonus_sms || 0)
              const isSelected = selectedPackage?.id === pkg.id
              return (
                <TouchableOpacity
                  key={pkg.id}
                  style={[styles.packageSelectCard, isSelected && styles.packageSelectCardActive]}
                  onPress={() => setSelectedPackage(pkg)}
                >
                  <View style={styles.packageSelectLeft}>
                    <View style={[styles.packageRadio, isSelected && styles.packageRadioActive]}>
                      {isSelected && <Check size={12} color="#fff" />}
                    </View>
                    <View>
                      <Text style={styles.packageSelectName}>{pkg.name}</Text>
                      <Text style={styles.packageSelectSms}>{totalSms} SMS{pkg.bonus_sms > 0 ? ` (+${pkg.bonus_sms} bonus)` : ''}</Text>
                    </View>
                  </View>
                  <Text style={styles.packageSelectPrice}>KES {pkg.price}</Text>
                </TouchableOpacity>
              )
            })}

            {selectedPackage && (
              <View style={styles.mpesaSection}>
                <Text style={styles.fieldLabel}>M-Pesa Phone Number</Text>
                <TextInput
                  style={styles.input}
                  value={mpesaPhone}
                  onChangeText={setMpesaPhone}
                  placeholder="07XX XXX XXX"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="phone-pad"
                />

                <View style={styles.paymentSummary}>
                  <View style={styles.paymentSummaryRow}>
                    <Text style={styles.paymentSummaryLabel}>Package:</Text>
                    <Text style={styles.paymentSummaryValue}>{selectedPackage.name}</Text>
                  </View>
                  <View style={styles.paymentSummaryRow}>
                    <Text style={styles.paymentSummaryLabel}>Credits:</Text>
                    <Text style={styles.paymentSummaryValue}>{selectedPackage.sms_count + (selectedPackage.bonus_sms || 0)} SMS</Text>
                  </View>
                  <View style={styles.paymentSummaryRow}>
                    <Text style={styles.paymentSummaryLabel}>Amount:</Text>
                    <Text style={styles.paymentSummaryValueLarge}>KES {selectedPackage.price}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.payBtn, processingPayment && styles.payBtnDisabled]}
                  onPress={processMpesaPayment}
                  disabled={processingPayment}
                >
                  {processingPayment ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Smartphone size={18} color="#fff" />
                      <Text style={styles.payBtnText}>Pay via M-Pesa</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )

  const renderAdjustmentModal = () => (
    <Modal visible={adjustmentModalVisible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <Settings size={20} color={Colors.gold} />
              <Text style={styles.modalTitle}>Adjust Credits</Text>
            </View>
            <TouchableOpacity onPress={() => setAdjustmentModalVisible(false)}>
              <X size={22} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            {selectedAdmin && (
              <View style={styles.adjustmentAdminCard}>
                <Text style={styles.adjustmentAdminName}>{selectedAdmin.user_profiles?.name}</Text>
                <Text style={styles.adjustmentAdminBalance}>Current: {selectedAdmin.sms_balance || 0} credits</Text>
              </View>
            )}

            <Text style={styles.fieldLabel}>Amount (use negative to deduct)</Text>
            <TextInput
              style={styles.input}
              value={adjustmentAmount}
              onChangeText={setAdjustmentAmount}
              placeholder="+100 or -50"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numeric"
            />

            <Text style={styles.fieldLabel}>Reason (Optional)</Text>
            <TextInput
              style={styles.input}
              value={adjustmentReason}
              onChangeText={setAdjustmentReason}
              placeholder="e.g. Manual refill, correction"
              placeholderTextColor={Colors.textMuted}
            />

            <TouchableOpacity style={styles.adjustmentBtn} onPress={processAdjustment}>
              <CreditCard size={18} color="#fff" />
              <Text style={styles.adjustmentBtnText}>Apply Adjustment</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )

  const tabs = isSuperAdmin ? SUPER_ADMIN_TABS : TABS

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: isSuperAdmin ? 'SMS Management' : 'Messaging',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerShadowVisible: false,
        }}
      />

      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
              onPress={() => {
                setActiveTab(tab.key)
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              }}
            >
              <Icon size={16} color={isActive ? Colors.gold : Colors.textMuted} />
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.gold} />
        </View>
      ) : (
        <>
          {!isSuperAdmin && activeTab === 'compose' && renderComposeTab()}
          {!isSuperAdmin && activeTab === 'credits' && renderCreditsTab()}
          {!isSuperAdmin && activeTab === 'templates' && renderTemplatesTab()}
          {!isSuperAdmin && activeTab === 'history' && renderHistoryTab()}

          {isSuperAdmin && activeTab === 'overview' && renderSuperAdminOverview()}
          {isSuperAdmin && activeTab === 'gateway' && renderSuperAdminGateway()}
          {isSuperAdmin && activeTab === 'packages' && renderSuperAdminPackages()}
          {isSuperAdmin && activeTab === 'balances' && renderSuperAdminBalances()}
          {isSuperAdmin && activeTab === 'revenue' && renderSuperAdminRevenue()}
        </>
      )}

      <Modal visible={recipientModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Client</Text>
              <TouchableOpacity onPress={() => setRecipientModalVisible(false)}>
                <X size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.searchContainer}>
              <Search size={16} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search clients..."
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <FlatList
              data={filteredClients}
              keyExtractor={(item: any) => item.id}
              ListEmptyComponent={
                <Text style={styles.emptyListText}>No clients found</Text>
              }
              renderItem={({ item }: { item: any }) => (
                <TouchableOpacity
                  style={styles.clientItem}
                  onPress={() => {
                    setSelectedClient(item)
                    setPhoneNumber(item.phone || '')
                    setRecipientModalVisible(false)
                    setSearchQuery('')
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  }}
                >
                  <View style={styles.clientAvatar}>
                    <Text style={styles.clientAvatarText}>{item.name?.charAt(0) || '?'}</Text>
                  </View>
                  <View style={styles.clientInfo}>
                    <Text style={styles.clientName}>{item.name}</Text>
                    <Text style={styles.clientPhone}>{item.phone}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={templateModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingTemplate ? 'Edit Template' : 'Templates'}</Text>
              <TouchableOpacity onPress={() => { setTemplateModalVisible(false); resetTemplateForm() }}>
                <X size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {editingTemplate !== null || templateName ? (
              <ScrollView style={styles.modalBody}>
                <Text style={styles.fieldLabel}>Template Name</Text>
                <TextInput
                  style={styles.input}
                  value={templateName}
                  onChangeText={setTemplateName}
                  placeholder="e.g. Welcome Message"
                  placeholderTextColor={Colors.textMuted}
                />
                <Text style={styles.fieldLabel}>Message Body</Text>
                <TextInput
                  style={[styles.input, styles.templateBodyInput]}
                  value={templateBody}
                  onChangeText={setTemplateBody}
                  placeholder="Type your template..."
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  textAlignVertical="top"
                />
                <View style={styles.variableHints}>
                  <Text style={styles.variableHintTitle}>Available Variables:</Text>
                  <Text style={styles.variableHintItem}>{'{client_name}'} — Client name</Text>
                  <Text style={styles.variableHintItem}>{'{access_code}'} — Access code</Text>
                  <Text style={styles.variableHintItem}>{'{gallery_name}'} — Gallery name</Text>
                  <Text style={styles.variableHintItem}>{'{app_link}'} — App link</Text>
                  <Text style={styles.variableHintItem}>{'{business_name}'} — Business name</Text>
                </View>
                <View style={styles.defaultToggle}>
                  <Text style={styles.defaultToggleLabel}>Set as Default</Text>
                  <TouchableOpacity
                    style={[styles.toggle, isDefaultTemplate && styles.toggleActive]}
                    onPress={() => setIsDefaultTemplate(!isDefaultTemplate)}
                  >
                    {isDefaultTemplate && <CheckCircle size={14} color="#fff" />}
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.saveTemplateBtn} onPress={saveTemplate}>
                  <Text style={styles.saveTemplateBtnText}>Save Template</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              <FlatList
                data={templates}
                keyExtractor={(item: any) => item.id}
                style={styles.modalBody}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <FileText size={36} color={Colors.textMuted} />
                    <Text style={styles.emptyTitle}>No Templates</Text>
                  </View>
                }
                renderItem={({ item }: { item: any }) => (
                  <TouchableOpacity
                    style={styles.templateCard}
                    onPress={() => { setEditingTemplate(item); setTemplateName(item.name); setTemplateBody(item.body); setIsDefaultTemplate(item.is_default || false) }}
                  >
                    <View style={styles.templateHeader}>
                      <View style={styles.templateNameRow}>
                        <Text style={styles.templateName}>{item.name}</Text>
                        {item.is_default && <View style={styles.defaultBadge}><Star size={10} color={Colors.gold} /><Text style={styles.defaultBadgeText}>Default</Text></View>}
                      </View>
                    </View>
                    <Text style={styles.templatePreview} numberOfLines={2}>{item.body}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {renderStoreModal()}
      {renderAdjustmentModal()}

      {isSuperAdmin && (
        <Modal visible={packageModalVisible} animationType="slide" transparent>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingPackage ? 'Edit Package' : 'Add Package'}</Text>
                <TouchableOpacity onPress={() => { setPackageModalVisible(false); resetPackageForm() }}>
                  <X size={22} color={Colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <Text style={styles.fieldLabel}>Package Name</Text>
                <TextInput
                  style={styles.input}
                  value={packageName}
                  onChangeText={setPackageName}
                  placeholder="e.g. Starter"
                  placeholderTextColor={Colors.textMuted}
                />
                <Text style={styles.fieldLabel}>SMS Count</Text>
                <TextInput
                  style={styles.input}
                  value={packageSmsCount}
                  onChangeText={setPackageSmsCount}
                  placeholder="100"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                />
                <Text style={styles.fieldLabel}>Bonus SMS (Optional)</Text>
                <TextInput
                  style={styles.input}
                  value={packageBonusSms}
                  onChangeText={setPackageBonusSms}
                  placeholder="10"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                />
                <Text style={styles.fieldLabel}>Price (KES)</Text>
                <TextInput
                  style={styles.input}
                  value={packagePrice}
                  onChangeText={setPackagePrice}
                  placeholder="200"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                />
                <Text style={styles.fieldLabel}>Description</Text>
                <TextInput
                  style={styles.input}
                  value={packageDescription}
                  onChangeText={setPackageDescription}
                  placeholder="100 SMS credits"
                  placeholderTextColor={Colors.textMuted}
                />
                <TouchableOpacity style={styles.saveTemplateBtn} onPress={savePackage}>
                  <Text style={styles.saveTemplateBtnText}>{editingPackage ? 'Update Package' : 'Create Package'}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 4,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: Colors.gold,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  tabLabelActive: {
    color: Colors.gold,
  },
  tabContent: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceCard: {
    backgroundColor: Colors.card,
    margin: 16,
    marginBottom: 8,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.gold + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  balanceInfo: {
    flex: 1,
  },
  balanceLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  balanceValue: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.gold,
  },
  buyCreditsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.gold,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buyCreditsBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  lowBalanceWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  lowBalanceText: {
    flex: 1,
    fontSize: 12,
    color: '#F39C12',
  },
  creditsHeader: {
    backgroundColor: Colors.card,
    margin: 16,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  creditsBalanceLarge: {
    alignItems: 'center',
    marginBottom: 20,
  },
  creditsBalanceValue: {
    fontSize: 48,
    fontWeight: '800',
    color: Colors.gold,
    marginTop: 12,
  },
  creditsBalanceLabel: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 4,
  },
  buyCreditsLargeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.gold,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    justifyContent: 'center',
  },
  buyCreditsLargeBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.text,
  },
  messageInput: {
    height: 120,
    paddingTop: 12,
  },
  charCountRow: {
    alignItems: 'flex-end',
    marginTop: 6,
  },
  charCount: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  charCountOver: {
    color: '#E74C3C',
  },
  recipientSelector: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectedRecipient: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  recipientInfo: {
    flex: 1,
  },
  recipientName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  recipientPhone: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  recipientPlaceholder: {
    flex: 1,
    fontSize: 14,
    color: Colors.textMuted,
  },
  phoneInputRow: {
    marginTop: 8,
  },
  phoneInput: {
    flex: 1,
  },
  applyTemplateText: {
    fontSize: 13,
    color: Colors.gold,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 20,
    gap: 10,
  },
  sendBtn: {
    flex: 1,
    backgroundColor: Colors.gold,
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sendBtnDisabled: {
    opacity: 0.6,
  },
  sendBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  addBtn: {
    backgroundColor: Colors.gold,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  templateCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 8,
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  templateNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  templateName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.gold + '15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.gold,
  },
  templateActions: {
    flexDirection: 'row',
    gap: 8,
  },
  templateActionBtn: {
    padding: 4,
  },
  templatePreview: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  templateHintRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  variableHint: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  logCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 8,
  },
  logLeft: {
    flexDirection: 'row',
    flex: 1,
    gap: 10,
  },
  logStatusIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logInfo: {
    flex: 1,
  },
  logClient: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  logMessage: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  logTimestamp: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
  },
  logRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  logStatus: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  logCost: {
    fontSize: 11,
    color: Colors.gold,
  },
  purchaseCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
  },
  purchaseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  purchaseStatusIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  purchaseInfo: {
    flex: 1,
  },
  purchaseAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  purchaseDate: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  purchaseRight: {
    alignItems: 'flex-end',
  },
  purchasePrice: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.gold,
  },
  purchaseStatus: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
    marginTop: 16,
  },
  metricCard: {
    width: '48%',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  metricLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  adminBalanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
  },
  adminLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  adminAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.gold + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.gold,
  },
  adminInfo: {
    flex: 1,
  },
  adminName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  adminEmail: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  adminRight: {
    alignItems: 'flex-end',
    marginRight: 10,
  },
  adminBalance: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.gold,
  },
  adminBalanceLabel: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  adjustBtn: {
    padding: 8,
    backgroundColor: Colors.cardHover,
    borderRadius: 8,
  },
  packageCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 8,
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  packageNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  packageName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  bonusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.gold + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  bonusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.gold,
  },
  packageActions: {
    flexDirection: 'row',
    gap: 8,
  },
  packageActionBtn: {
    padding: 4,
  },
  packageDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.cardDark,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  packageDetailItem: {
    alignItems: 'center',
  },
  packageDetailValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  packageDetailLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  packageDescription: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyStateSmall: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  listContent: {
    paddingBottom: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  modalBody: {
    padding: 16,
  },
  storeBalanceCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  storeBalanceLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  storeBalanceValue: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.gold,
  },
  packageSelectCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  packageSelectCardActive: {
    borderColor: Colors.gold,
    backgroundColor: Colors.gold + '10',
  },
  packageSelectLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  packageRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packageRadioActive: {
    borderColor: Colors.gold,
    backgroundColor: Colors.gold,
  },
  packageSelectName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  packageSelectSms: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  packageSelectPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.gold,
  },
  mpesaSection: {
    marginTop: 20,
  },
  paymentSummary: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  paymentSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  paymentSummaryLabel: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  paymentSummaryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  paymentSummaryValueLarge: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.gold,
  },
  payBtn: {
    backgroundColor: Colors.gold,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  payBtnDisabled: {
    opacity: 0.6,
  },
  payBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    margin: 16,
    marginBottom: 0,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
  },
  clientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  clientAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.gold + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.gold,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  clientPhone: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  emptyListText: {
    textAlign: 'center',
    color: Colors.textMuted,
    paddingVertical: 30,
    fontSize: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  templateBodyInput: {
    height: 140,
    paddingTop: 12,
    marginBottom: 12,
  },
  variableHints: {
    backgroundColor: Colors.card,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  variableHintTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  variableHintItem: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  defaultToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  defaultToggleLabel: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '600',
  },
  toggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },
  saveTemplateBtn: {
    backgroundColor: Colors.gold,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveTemplateBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  adjustmentAdminCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  adjustmentAdminName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  adjustmentAdminBalance: {
    fontSize: 14,
    color: Colors.gold,
    fontWeight: '600',
  },
  adjustmentBtn: {
    backgroundColor: Colors.gold,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  adjustmentBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
})
