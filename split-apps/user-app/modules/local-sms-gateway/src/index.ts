import { PermissionsAndroid, Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

export type PermissionStatus = 'granted' | 'denied';

export type LocalSmsGatewayStatus = {
  simState: 'unknown' | 'ready' | 'absent';
  sendSmsPermission: PermissionStatus;
  readSmsPermission: PermissionStatus;
  receiveSmsPermission: PermissionStatus;
  readPhoneStatePermission: PermissionStatus;
  signalStrength: number | null;
  defaultSubscriptionId: number | null;
  lastSentAt: string | null;
};

export type LocalSmsSendResult =
  | { status: 'sent'; sentAt: string; errorCode: null; errorMessage: null }
  | { status: 'queued'; sentAt: null; errorCode: string; errorMessage: string }
  | { status: 'failed'; sentAt: null; errorCode: string; errorMessage: string };

type NativeStatus = {
  simState?: string | null;
  sendSmsPermission?: PermissionStatus | null;
  readSmsPermission?: PermissionStatus | null;
  readPhoneStatePermission?: PermissionStatus | null;
  signalStrengthLevel?: number | null;
  defaultSmsSubscriptionId?: number | null;
};

type NativeSendResult = {
  status?: 'sent' | 'failed';
  sentAt?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
};

type NativeLocalSmsGateway = {
  getStatus: () => Promise<NativeStatus>;
  sendSms: (phoneNumber: string, message: string, subscriptionId: number | null) => Promise<NativeSendResult>;
  findLatestAccessCode: (regex: string, maxMessages: number) => Promise<{ code: string; body: string; receivedAt: string } | null>;
};

function getNativeModule(): NativeLocalSmsGateway | null {
  if (Platform.OS !== 'android') return null;
  try {
    return requireNativeModule('LocalSmsGateway') as NativeLocalSmsGateway;
  } catch {
    return null;
  }
}

async function checkPermission(permission: string): Promise<PermissionStatus> {
  if (Platform.OS !== 'android') return 'denied';
  const ok = await PermissionsAndroid.check(permission as any);
  return ok ? 'granted' : 'denied';
}

export const LocalSmsGateway = {
  getStatus: async (): Promise<LocalSmsGatewayStatus> => {
    if (Platform.OS !== 'android') {
      return {
        simState: 'unknown',
        sendSmsPermission: 'denied',
        readSmsPermission: 'denied',
        receiveSmsPermission: 'denied',
        readPhoneStatePermission: 'denied',
        signalStrength: null,
        defaultSubscriptionId: null,
        lastSentAt: null,
      };
    }

    const native = getNativeModule();
    if (native) {
      const status = await native.getStatus();
      const simStateRaw = String(status.simState ?? 'unknown').toLowerCase();
      const simState: LocalSmsGatewayStatus['simState'] =
        simStateRaw === 'active' || simStateRaw === 'ready'
          ? 'ready'
          : simStateRaw === 'not_detected' || simStateRaw === 'absent'
            ? 'absent'
            : 'unknown';

      const [receiveSmsPermission] = await Promise.all([
        checkPermission(PermissionsAndroid.PERMISSIONS.RECEIVE_SMS),
      ]);

      return {
        simState,
        sendSmsPermission: status.sendSmsPermission ?? 'denied',
        readSmsPermission: status.readSmsPermission ?? 'denied',
        receiveSmsPermission,
        readPhoneStatePermission: status.readPhoneStatePermission ?? 'denied',
        signalStrength: status.signalStrengthLevel ?? null,
        defaultSubscriptionId: status.defaultSmsSubscriptionId ?? null,
        lastSentAt: null,
      };
    }

    const [sendSmsPermission, readSmsPermission, receiveSmsPermission, readPhoneStatePermission] = await Promise.all([
      checkPermission(PermissionsAndroid.PERMISSIONS.SEND_SMS),
      checkPermission(PermissionsAndroid.PERMISSIONS.READ_SMS),
      checkPermission(PermissionsAndroid.PERMISSIONS.RECEIVE_SMS),
      checkPermission(PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE),
    ]);

    return {
      simState: 'unknown',
      sendSmsPermission,
      readSmsPermission,
      receiveSmsPermission,
      readPhoneStatePermission,
      signalStrength: null,
      defaultSubscriptionId: null,
      lastSentAt: null,
    };
  },

  sendSms: async (params: { phoneNumber: string; message: string; subscriptionId: number | null }): Promise<LocalSmsSendResult> => {
    if (Platform.OS !== 'android') {
      return { status: 'failed', sentAt: null, errorCode: 'UNSUPPORTED', errorMessage: 'Local SMS Gateway is Android-only' };
    }

    const native = getNativeModule();
    if (!native) {
      const permOk = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.SEND_SMS);
      if (!permOk) {
        return { status: 'failed', sentAt: null, errorCode: 'PERMISSION_DENIED', errorMessage: 'SEND_SMS permission not granted' };
      }
      return { status: 'failed', sentAt: null, errorCode: 'NATIVE_MODULE_MISSING', errorMessage: 'LocalSmsGateway native module not installed' };
    }

    const result = await native.sendSms(params.phoneNumber, params.message, params.subscriptionId);
    if (result.status === 'sent') {
      return { status: 'sent', sentAt: result.sentAt ?? new Date().toISOString(), errorCode: null, errorMessage: null };
    }

    const errorCode = result.errorCode ?? 'UNKNOWN';
    const errorMessage = result.errorMessage ?? 'Failed to send';
    return { status: errorCode === 'NO_SERVICE' || errorCode === 'RADIO_OFF' ? 'queued' : 'failed', sentAt: null, errorCode, errorMessage };
  },

  findLatestAccessCode: async (params: { regex: string; maxMessages?: number }) => {
    const native = getNativeModule();
    if (!native) return null;
    return await native.findLatestAccessCode(params.regex, params.maxMessages ?? 30);
  },
};
