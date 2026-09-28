#!/usr/bin/env node
/**
 * Builds assets/Annum.icon (Icon Composer format, layered for iOS 26+: default, dark, tinted,
 * clear) from the mark's arc geometry in src/ui/components/Mark.tsx and the colors in
 * src/theme/index.ts, so the icon never drifts from the brand tokens. Open the result in Icon
 * Composer (Xcode → Open Developer Tool) to fine-tune; rerun this to reset it.
 * Usage: node scripts/make-app-icon.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const mark = fs.readFileSync(path.join(root, 'src/ui/components/Mark.tsx'), 'utf8');
const theme = fs.readFileSync(path.join(root, 'src/theme/index.ts'), 'utf8');

const arcs = {};
for (const key of ['tax', 'bills', 'runway', 'invest', 'free']) {
  const m = new RegExp(`${key}:\\s*'([^']+)'`).exec(mark.slice(mark.indexOf('const ARCS')));
  if (!m) throw new Error(`No arc for ${key} in Mark.tsx`);
  arcs[key] = m[1];
}
const bucketBlock = theme.slice(
  theme.indexOf('bucket: {'),
  theme.indexOf('}', theme.indexOf('bucket: {')),
);
const hex = (block, key) => {
  const m = new RegExp(`${key}:\\s*'(#[0-9A-Fa-f]{6})'`).exec(block);
  if (!m) throw new Error(`No color for ${key}`);
  return m[1];
};
const bucket = Object.fromEntries(Object.keys(arcs).map((k) => [k, hex(bucketBlock, k)]));
const bgBase = hex(theme, 'bgBase');
const textPrimary = hex(theme, 'textPrimary');

/** "#111E19" → "srgb:0.06667,0.11765,0.09804,1.00000" */
const srgb = (h) =>
  `srgb:${[1, 3, 5].map((i) => (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(5)).join(',')},1.00000`;

// The mark sits on a 100 × 100 grid; the icon canvas is 1024 × 1024 points.
const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 100 100">${body}</svg>\n`;

const out = path.join(root, 'assets/Annum.icon');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'Assets'), { recursive: true });
for (const [key, d] of Object.entries(arcs)) {
  fs.writeFileSync(
    path.join(out, 'Assets', `${key}.svg`),
    svg(`<path d="${d}" fill="${bucket[key]}"/>`),
  );
}
fs.writeFileSync(
  path.join(out, 'Assets', 'today.svg'),
  svg(`<circle cx="50" cy="50" r="7" fill="${textPrimary}"/>`),
);

const layer = (name) => ({
  'image-name': `${name}.svg`,
  name,
  glass: true,
  position: { scale: 1.1, 'translation-in-points': [0, 0] },
});
const icon = {
  'fill-specializations': [
    { value: { solid: srgb(bgBase) } },
    { appearance: 'dark', value: { solid: srgb(bgBase) } },
  ],
  groups: [
    {
      name: 'Today',
      layers: [layer('today')],
      shadow: { kind: 'neutral', opacity: 0.5 },
      translucency: { enabled: true, value: 0.4 },
      specular: true,
    },
    {
      name: 'Buckets',
      // Clockwise from 12 in fixed order: each arc keeps its bucket's color.
      layers: ['tax', 'bills', 'runway', 'invest', 'free'].map(layer),
      shadow: { kind: 'layer-color', opacity: 0.5 },
      translucency: { enabled: true, value: 0.3 },
      specular: true,
    },
  ],
  'supported-platforms': { squares: 'shared' },
};
fs.writeFileSync(path.join(out, 'icon.json'), `${JSON.stringify(icon, null, 2)}\n`);
console.log(`Wrote ${path.relative(root, out)}`);
