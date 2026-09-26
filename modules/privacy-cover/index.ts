/**
 * The App Switcher cover (native, modules/privacy-cover/ios). It turns itself on when the app
 * starts; `setColor` matches it to the app background. No-op where the module isn't built in
 * (Jest, or a development build made before M5).
 */
import { requireOptionalNativeModule } from 'expo';

interface PrivacyCoverModule {
  setColor(hex: string): void;
}

const native = requireOptionalNativeModule<PrivacyCoverModule>('PrivacyCover');

export const privacyCoverAvailable = native !== null;

export function setPrivacyCoverColor(hex: string): void {
  native?.setColor(hex);
}
