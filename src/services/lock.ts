/**
 * Face ID lock (docs/02 "Lock", screens S5/E6): Face ID first, the device passcode as the
 * fallback. Nothing here stores or reads money; it only answers "is this the owner?".
 */
import * as LocalAuthentication from 'expo-local-authentication';

export type LockCapability = 'face-id' | 'touch-id' | 'passcode' | 'none';

export async function lockCapability(): Promise<LockCapability> {
  const [hardware, enrolled, types, level] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
    LocalAuthentication.getEnrolledLevelAsync(),
  ]);
  if (hardware && enrolled) {
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'face-id';
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'touch-id';
  }
  return level >= LocalAuthentication.SecurityLevel.SECRET ? 'passcode' : 'none';
}

/**
 * unlocked · not-recognized (E6) · cancelled (stay on S5) · use-passcode (Face ID can't run:
 * not set up or locked out) · no-protection (no passcode on this phone, nothing to check).
 */
export type UnlockResult =
  'unlocked' | 'not-recognized' | 'cancelled' | 'use-passcode' | 'no-protection';

export async function authenticate(allowPasscode: boolean): Promise<UnlockResult> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock Annum',
    cancelLabel: 'Cancel',
    disableDeviceFallback: !allowPasscode,
    // Face ID only: hide the system's own passcode button; E6 offers "Use passcode".
    ...(allowPasscode ? {} : { fallbackLabel: '' }),
  });
  if (result.success) return 'unlocked';
  switch (result.error) {
    case 'user_cancel':
    case 'system_cancel':
    case 'app_cancel':
      return 'cancelled';
    case 'passcode_not_set':
      return 'no-protection';
    case 'not_enrolled':
    case 'not_available':
    case 'lockout':
      return allowPasscode ? 'no-protection' : 'use-passcode';
    default:
      return 'not-recognized';
  }
}
