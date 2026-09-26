import appJson from '../../app.json';

import { color, symbols } from '@/theme';

describe('theme', () => {
  test('bucket colors cover exactly the five buckets, in order', () => {
    expect(Object.keys(color.bucket)).toEqual(['tax', 'bills', 'runway', 'invest', 'free']);
  });

  test('app.json background and splash use color.bgBase (JSON cannot import the theme)', () => {
    const splash = appJson.expo.plugins.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
    ) as [string, { backgroundColor: string }];
    expect(appJson.expo.backgroundColor).toBe(color.bgBase);
    expect(splash[1].backgroundColor).toBe(color.bgBase);
  });

  test('tab bar symbols', () => {
    expect([
      symbols.tabToday,
      symbols.tabTodaySelected,
      symbols.tabReview,
      symbols.tabMoney,
      symbols.tabMoneySelected,
    ]).toEqual(['sun.max', 'sun.max.fill', 'list.bullet', 'tray.2', 'tray.2.fill']);
  });
});
