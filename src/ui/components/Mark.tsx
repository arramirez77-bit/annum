import Svg, { Circle, Path } from 'react-native-svg';

import { color, size as sizes, type as typeScale } from '@/theme';

import { Text } from './Text';

/**
 * Arc geometry from the Figma component "Annum / Mark" (node 53:3), on a 100 × 100 grid:
 * five bucket arcs clockwise from 12 in fixed order and proportion, with Today at the center.
 * Geometry is brand data; colors come from the theme so each arc always means its bucket.
 */
const ARCS = {
  tax: 'M51.9188 18.0576C56.1687 18.3129 60.3248 19.4137 64.1439 21.2955C67.9629 23.1773 71.3681 25.8022 74.1598 29.0166L65.9455 36.151C64.1029 34.0295 61.8555 32.297 59.335 31.055C56.8144 29.813 54.0713 29.0865 51.2664 28.918L51.9188 18.0576Z',
  bills:
    'M76.4981 32.0597C79.0567 35.8389 80.7774 40.1216 81.5446 44.6205C82.3118 49.1194 82.1078 53.7303 80.9464 58.1439L70.4246 55.375C71.1912 52.462 71.3258 49.4188 70.8194 46.4495C70.3131 43.4803 69.1774 40.6537 67.4887 38.1594L76.4981 32.0597Z',
  runway:
    'M79.7489 61.79C77.5002 67.4638 73.6759 72.3763 68.727 75.948C63.7781 79.5197 57.911 81.6017 51.8176 81.9483C45.7243 82.295 39.6589 80.8919 34.3368 77.9046C29.0147 74.9172 24.6579 70.4702 21.7803 65.088L31.375 59.9581C33.2742 63.5103 36.1497 66.4454 39.6623 68.417C43.1749 70.3887 47.178 71.3147 51.1996 71.0859C55.2212 70.8571 59.0935 69.483 62.3598 67.1257C65.6261 64.7684 68.1502 61.5261 69.6343 57.7814L79.7489 61.79Z',
  invest:
    'M20.177 61.6013C17.5139 54.7552 17.2872 47.2013 19.535 40.2079L29.8931 43.5372C28.4095 48.1529 28.5592 53.1384 30.3168 57.6568L20.177 61.6013Z',
  free: 'M20.9263 36.6313C23.7351 30.523 28.3963 25.4545 34.2485 22.1452L39.604 31.6158C35.7416 33.8 32.6651 37.1452 30.8114 41.1767L20.9263 36.6313Z',
} as const;

interface MarkProps {
  /** Rendered size in points (minimum 16). */
  size: number;
  /** Today dot is light on dark surfaces and ink on light ones. */
  surface?: 'dark' | 'light';
  /** Decorative when shown next to the wordmark. */
  decorative?: boolean;
}

export function Mark({ size, surface = 'dark', decorative = false }: MarkProps) {
  const px = Math.max(size, sizes.markMin);
  return (
    <Svg
      width={px}
      height={px}
      viewBox="0 0 100 100"
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={decorative ? undefined : 'Annum'}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
    >
      <Path d={ARCS.tax} fill={color.bucket.tax} />
      <Path d={ARCS.bills} fill={color.bucket.bills} />
      <Path d={ARCS.runway} fill={color.bucket.runway} />
      <Path d={ARCS.invest} fill={color.bucket.invest} />
      <Path d={ARCS.free} fill={color.bucket.free} />
      <Circle
        cx={50}
        cy={50}
        r={7}
        fill={surface === 'dark' ? color.textPrimary : color.textOnLight}
      />
    </Svg>
  );
}

/** "annum" — SF Pro Semibold, lowercase, −2% tracking. Never all caps. */
export function Wordmark({ surface = 'dark' }: { surface?: 'dark' | 'light' }) {
  return (
    <Text
      variant="title1"
      tone={surface === 'dark' ? 'primary' : 'onLight'}
      style={{ letterSpacing: typeScale.title1.fontSize * -0.02 }}
      accessibilityRole="header"
    >
      annum
    </Text>
  );
}
