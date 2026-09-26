import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

import {
  AmountInput,
  BucketBar,
  Button,
  Chip,
  GuardrailNote,
  LedgerRow,
  OptionCard,
  SegmentedControl,
  StatusPill,
  StepIndicator,
  Text,
  formatDollarDigits,
  parseDollarsToCents,
} from '@/ui/components';
import { fontScale } from '@/theme';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
}));

describe('Button', () => {
  test('is a labelled button that reports disabled and ignores taps', async () => {
    const onPress = jest.fn();
    await render(
      <Button variant="destructive" label="Delete everything" onPress={onPress} disabled />,
    );
    const button = screen.getByRole('button', { name: 'Delete everything' });
    expect(button).toBeDisabled();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  test('fires onPress when enabled', async () => {
    const onPress = jest.fn();
    await render(<Button variant="primary" label="Confirm split" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm split' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('Chip', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('tax chip is a checkbox with a selection haptic', async () => {
    const onPress = jest.fn();
    await render(<Chip kind="tax" label="Tax" selected onPress={onPress} />);
    const chip = screen.getByRole('checkbox', { name: 'Tax, work expense' });
    expect(chip).toBeChecked();
    await fireEvent.press(chip);
    expect(onPress).toHaveBeenCalled();
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  test('category chip is a radio', async () => {
    await render(<Chip kind="category" label="Groceries" selected={false} onPress={jest.fn()} />);
    expect(screen.getByRole('radio', { name: 'Groceries' })).not.toBeSelected();
  });
});

describe('small components', () => {
  test('StepIndicator reads "Step N of M"', async () => {
    await render(<StepIndicator step={2} total={5} />);
    expect(screen.getByLabelText('Step 2 of 5')).toBeTruthy();
  });

  test('StatusPill announces the status; long-press only when interactive', async () => {
    const onLongPress = jest.fn();
    await render(<StatusPill status="heads-up" onLongPress={onLongPress} />);
    await fireEvent(screen.getByRole('button', { name: 'Status: Heads up' }), 'longPress');
    expect(onLongPress).toHaveBeenCalled();
  });

  test('heads-up note is announced as a heads-up, never a warning', async () => {
    await render(<GuardrailNote tone="heads-up">The card statement lands first.</GuardrailNote>);
    expect(screen.getByLabelText('Heads up. The card statement lands first.')).toBeTruthy();
  });

  test('LedgerRow with onPress is a button whose label includes the value', async () => {
    await render(
      <LedgerRow
        surface="light"
        title="Runway"
        value="4.2 mo"
        subtitle="$15k target"
        onPress={jest.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Runway, 4.2 mo, $15k target' })).toBeTruthy();
  });

  test('OptionCard is a radio with selected state', async () => {
    await render(<OptionCard title="Salary" selected onPress={jest.fn()} />);
    expect(screen.getByRole('radio', { name: 'Salary' })).toBeSelected();
  });
});

describe('SegmentedControl', () => {
  test('changes selection with a haptic, ignores taps on the current segment', async () => {
    const onChange = jest.fn();
    await render(
      <SegmentedControl
        options={[
          { value: '25', label: '25%' },
          { value: '30', label: '30%' },
        ]}
        value="30"
        onChange={onChange}
        accessibilityLabel="Tax rate"
      />,
    );
    await fireEvent.press(screen.getByRole('tab', { name: '30%' }));
    expect(onChange).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('tab', { name: '25%' }));
    expect(onChange).toHaveBeenCalledWith('25');
  });
});

describe('BucketBar', () => {
  test('hides zero buckets and exposes one spoken summary', async () => {
    await render(
      <BucketBar
        segments={[
          { bucket: 'tax', amount: 300000 },
          { bucket: 'invest', amount: 0 },
        ]}
        accessibilityLabel="Savings: Tax $3,000"
      />,
    );
    expect(screen.getByLabelText('Savings: Tax $3,000')).toBeTruthy();
  });
});

describe('AmountInput', () => {
  test('whole dollars from the number pad become cents', async () => {
    expect(parseDollarsToCents('2,400')).toBe(240000);
    expect(parseDollarsToCents('')).toBeNull();
    expect(parseDollarsToCents('12345678901')).toBe(123456789 * 100);
    expect(formatDollarDigits(240000)).toBe('2,400');
    expect(formatDollarDigits(null)).toBe('');
  });

  test('typing reports cents and shows separators', async () => {
    const onChange = jest.fn();
    await render(<AmountInput label="If I spend" valueCents={240000} onChangeCents={onChange} />);
    const input = screen.getByLabelText('If I spend');
    expect(input.props.value).toBe('2,400');
    await fireEvent.changeText(input, '2,4005');
    expect(onChange).toHaveBeenCalledWith(2400500);
  });
});

describe('Text', () => {
  test('Dynamic Type caps: 1.3× for Hero/Display, 2× otherwise', async () => {
    await render(
      <>
        <Text variant="hero">$1,000</Text>
        <Text variant="body">about $50 a day</Text>
      </>,
    );
    expect(screen.getByText('$1,000').props.maxFontSizeMultiplier).toBe(fontScale.large);
    expect(screen.getByText('about $50 a day').props.maxFontSizeMultiplier).toBe(fontScale.default);
  });
});
