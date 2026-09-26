/**
 * SPIKE (branch spike/widgets): the lock-screen / home-screen widget via expo-widgets.
 * Widget functions run in an isolated runtime: pure, no hooks, no module-scope values —
 * so everything (including colors in M8) must arrive as props from the app.
 */
import { Gauge, Text, VStack } from '@expo/ui/swift-ui';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export type AnnumSpendProps = {
  amount: string;
  perDay: string;
  until: string;
  runwayMonths: number;
  runwayTargetMonths: number;
};

const AnnumSpend = (props: AnnumSpendProps, environment: WidgetEnvironment) => {
  'widget';
  if (environment.widgetFamily === 'accessoryCircular') {
    return (
      <Gauge
        value={props.runwayMonths}
        min={0}
        max={props.runwayTargetMonths}
        currentValueLabel={<Text>{String(props.runwayMonths)}</Text>}
      >
        <Text>Runway</Text>
      </Gauge>
    );
  }
  return (
    <VStack alignment="leading">
      <Text>{`${props.amount} to spend`}</Text>
      <Text>{`${props.perDay}/day · till ${props.until}`}</Text>
    </VStack>
  );
};

export const AnnumSpendWidget = createWidget<AnnumSpendProps>('AnnumSpend', AnnumSpend);
