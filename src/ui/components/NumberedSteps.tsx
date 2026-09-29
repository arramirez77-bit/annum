import { View } from 'react-native';

import { color, radius, size, space } from '@/theme';

import { Text } from './Text';

/** Numbered how-it-works steps: a 28pt raised circle, Body title, Footnote line (S11, O3). */
export function NumberedSteps({ steps }: { steps: readonly { title: string; detail: string }[] }) {
  return (
    <View style={{ gap: space[16] }}>
      {steps.map((step, i) => (
        <View
          key={step.title}
          accessible
          accessibilityLabel={`Step ${i + 1}: ${step.title}. ${step.detail}.`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space[12] }}
        >
          <View
            style={{
              width: size.stepNumber,
              height: size.stepNumber,
              borderRadius: radius.full,
              backgroundColor: color.bgRaised,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text variant="subhead">{i + 1}</Text>
          </View>
          <View style={{ flex: 1, gap: space[2] }}>
            <Text>{step.title}</Text>
            <Text variant="footnote" tone="secondary">
              {step.detail}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/** Onboarding progress in the header: "Step 1 of 4" (Figma O2–O4c). */
export function StepLabel({ step, total }: { step: number; total: number }) {
  return (
    <Text variant="subhead" tone="secondary">
      {`Step ${step} of ${total}`}
    </Text>
  );
}
