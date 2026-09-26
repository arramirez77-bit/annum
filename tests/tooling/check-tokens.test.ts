// eslint-disable-next-line @typescript-eslint/no-require-imports
const { findViolations } = require('../../scripts/check-tokens.js') as {
  findViolations: (source: string) => { line: number; rule: string }[];
};

const rules = (source: string) => findViolations(source).map((v) => v.rule);

describe('token check', () => {
  test('flags raw colors, sizes, durations and opacity', () => {
    expect(rules("backgroundColor: '#111E19',")).toEqual(['hex color']);
    expect(rules("color: 'rgba(0,0,0,0.5)',")).toEqual(['rgb()/rgba() color']);
    expect(rules("color: 'white',")).toEqual(['named color']);
    expect(rules('paddingHorizontal: 24,')).toEqual(['raw size']);
    expect(rules('borderRadius: 16,')).toEqual(['raw size']);
    expect(rules('withTiming(1, { duration: 250 })')).toEqual(['raw duration']);
    expect(rules('opacity: 0.8,')).toEqual(['raw opacity']);
    expect(rules('<SymbolView size={17} />')).toEqual(['raw size']);
  });

  test('allows tokens, 0/1, transparent, and comments', () => {
    expect(rules('paddingHorizontal: layout.screenMargin,')).toEqual([]);
    expect(rules('borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,')).toEqual([]);
    expect(rules("backgroundColor: 'transparent',")).toEqual([]);
    expect(rules('flex: 1,')).toEqual([]);
    expect(rules('// width: 24 is only in a comment')).toEqual([]);
    expect(rules('gap: space[12],')).toEqual([]);
  });
});
