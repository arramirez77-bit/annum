import { router, type Href } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { PLAID_ENV, useBank } from '@/state/bank';
import { loginsLeft } from '@/state/bank-views';
import { color, layout, size, space, symbols } from '@/theme';
import { CloseButton, OptionRow, Text } from '@/ui/components';

// S12 Add an account (light sheet from Settings, Figma 117:1778).
export default function AddAccountSheet() {
  const count = useBank((s) => s.count);
  const footnote = loginsLeft(count, PLAID_ENV === 'sandbox');
  // The sheet gives way to the next step.
  const go = (href: Href) => router.replace(href);
  return (
    <ScrollView
      style={{ backgroundColor: color.bgSheet }}
      // The 40pt bottom padding already clears the home indicator (Figma 117:1862).
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={{
        paddingTop: space[28],
        paddingBottom: space[40],
        paddingLeft: layout.screenMargin,
        // The Close circle lines up with the margin; its 44pt tap area reaches past it.
        paddingRight: layout.screenMargin - (layout.touchTarget - size.closeButton) / 2,
        gap: space[16],
      }}
      testID="add-account"
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[8] }}>
        <View style={{ flex: 1 }}>
          <Text variant="title2" tone="onLight" accessibilityRole="header">
            Add an account
          </Text>
        </View>
        <CloseButton onPress={() => router.back()} testID="add-account-close" />
      </View>
      <View>
        <OptionRow
          first
          icon={symbols.bank}
          title="Connect a bank"
          subtitle="Log in once. Balances update on their own."
          onPress={() => go('/bank/connect')}
          testID="add-account-bank"
        />
        <OptionRow
          icon={symbols.byHand}
          title="Enter a balance by hand"
          subtitle="For cash, or banks that won’t connect."
          onPress={() => go({ pathname: '/account/[id]/balance', params: { id: 'new' } })}
          testID="add-account-by-hand"
        />
        <OptionRow
          icon={symbols.importFile}
          title="Import a file"
          subtitle="A file you download from your bank."
          onPress={() => go('/import')}
          testID="add-account-import"
        />
        <OptionRow
          icon={symbols.accessCode}
          title="Scan an access code"
          subtitle="Pair this phone with the code from your laptop."
          onPress={() => go('/pair')}
          testID="add-account-pair"
        />
      </View>
      {footnote ? (
        <Text variant="footnote" tone="onLightSecondary" testID="add-account-logins">
          {footnote}
        </Text>
      ) : null}
    </ScrollView>
  );
}
