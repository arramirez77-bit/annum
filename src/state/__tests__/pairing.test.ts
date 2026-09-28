import { redirectSystemPath } from '../../../app/+native-intent';
import { takeKeyFromLink, takeWaitingKey } from '../pairing';

const KEY = 'test-key-'.padEnd(43, 'x');

describe('links from outside', () => {
  it('takes the key out of a pairing link, once', () => {
    expect(redirectSystemPath({ path: `annum://pair?key=${KEY}`, initial: false })).toBe('/pair');
    expect(takeWaitingKey()).toBe(KEY);
    expect(takeWaitingKey()).toBeNull();
  });

  it('keeps the key out of the route', () => {
    const route = redirectSystemPath({ path: `annum://pair?key=${KEY}`, initial: true });
    expect(route).not.toContain(KEY);
    takeWaitingKey();
  });

  it('ignores links that are not pairing links', () => {
    expect(takeKeyFromLink('annum://review/1')).toBe(false);
    expect(takeKeyFromLink('annum://pairing?key=x')).toBe(false);
    expect(redirectSystemPath({ path: 'annum://review/1', initial: false })).toBe(
      'annum://review/1',
    );
  });

  it("stays put when Plaid's OAuth return opens the app", () => {
    const oauth = 'https://annum.highdesert.workers.dev/plaid/oauth?oauth_state_id=abc';
    expect(redirectSystemPath({ path: oauth, initial: false })).toBeNull();
    expect(redirectSystemPath({ path: oauth, initial: true })).toBe('/');
  });

  it('still sends bank files to Import', () => {
    expect(redirectSystemPath({ path: 'file:///a/b.csv', initial: false })).toBe(
      '/import?file=file%3A%2F%2F%2Fa%2Fb.csv',
    );
  });
});
