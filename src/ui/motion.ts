/**
 * Motion (docs/04): numbers count to their new value over 400ms, ease-out (expo); the Today
 * field cross-fades over 600ms. Reduce Motion: no count-ups, crossfade 150ms.
 */
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

import { motion } from '@/theme';

/** CSS-style cubic-bezier(x1, y1, x2, y2) as a function of progress t ∈ [0, 1]. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const coord = (a: number, b: number, t: number) =>
    3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3;
  const slope = (a: number, b: number, t: number) =>
    3 * a * (1 - t) ** 2 + 6 * (b - a) * t * (1 - t) + 3 * (1 - b) * t ** 2;
  return (x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const dx = coord(x1, x2, t) - x;
      const d = slope(x1, x2, t);
      if (Math.abs(dx) < 1e-6 || d === 0) break;
      t -= dx / d;
    }
    return coord(y1, y2, Math.min(Math.max(t, 0), 1));
  };
}

export const easeOutExpo = cubicBezier(...motion.easeOutExpo);

/**
 * The value to display while counting from the previous value to `target` (integer cents).
 * Jumps straight to the target when Reduce Motion is on.
 */
export function useCountUp(target: number, duration: number = motion.count): number {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(target);
  const from = useRef(target);

  useEffect(() => {
    if (reduceMotion || from.current === target) {
      from.current = target;
      setShown(target);
      return;
    }
    const start = from.current;
    const began = Date.now();
    let frame = 0;
    const tick = () => {
      const p = Math.min((Date.now() - began) / duration, 1);
      const value = Math.round(start + (target - start) * easeOutExpo(p));
      setShown(value);
      if (p < 1) frame = requestAnimationFrame(tick);
      else from.current = target;
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      from.current = target;
    };
  }, [target, duration, reduceMotion]);

  return shown;
}
