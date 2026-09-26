#!/usr/bin/env node
/**
 * Token check (CLAUDE.md rule 2): no raw colors, sizes, radii, or durations outside src/theme.
 * Runs as part of `npm run lint`. Allowed literals: 0, 1 (flex/border toggles), 'transparent'.
 */
const fs = require('fs');
const path = require('path');

const RULES = [
  { name: 'hex color', re: /#[0-9a-fA-F]{3,8}\b/ },
  { name: 'rgb()/rgba() color', re: /\brgba?\(/ },
  {
    name: 'named color',
    re: /\b(?:color|backgroundColor|borderColor|borderBottomColor|borderTopColor|tintColor|shadowColor|thumbColor)\s*:\s*['"](?!transparent['"])[a-zA-Z]+['"]/,
  },
  {
    name: 'raw size',
    re: /\b(?:width|height|minWidth|minHeight|maxWidth|maxHeight|padding\w*|margin\w*|gap|rowGap|columnGap|top|right|bottom|left|inset|borderRadius|border\w*Radius|borderWidth|border\w*Width|fontSize|lineHeight|letterSpacing|size)\s*[:=]\s*\{?\s*-?(?:[2-9]|\d{2,}|\d*\.\d+)\b/,
  },
  { name: 'raw duration', re: /\b(?:duration|delay)\s*:\s*\d{2,}\b/ },
  { name: 'raw opacity', re: /\bopacity\s*:\s*0?\.\d+/ },
];

/** Violations in one file's source: [{ line, rule, text }]. */
function findViolations(source) {
  const out = [];
  source.split('\n').forEach((text, i) => {
    const code = text.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '');
    for (const rule of RULES) {
      if (rule.re.test(code)) out.push({ line: i + 1, rule: rule.name, text: text.trim() });
    }
  });
  return out;
}

const SKIP = [
  /\/src\/theme\//,
  /__tests__\//,
  /\.test\.tsx?$/,
  /\/src\/ui\/components\/Mark\.tsx$/, // brand geometry from Figma (SVG path data)
  /\/src\/data\/export-html\.ts$/, // print stylesheet for the accountant PDF, not app UI
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
  }
  return files;
}

function main() {
  const root = path.resolve(__dirname, '..');
  const files = ['app', 'src']
    .flatMap((d) => walk(path.join(root, d)))
    .filter((f) => !SKIP.some((re) => re.test(f)));
  let count = 0;
  for (const file of files) {
    for (const v of findViolations(fs.readFileSync(file, 'utf8'))) {
      count++;
      console.error(`${path.relative(root, file)}:${v.line}  ${v.rule}  ${v.text}`);
    }
  }
  if (count) {
    console.error(
      `\n${count} raw value(s) found. Use tokens from @/theme (or propose a new token).`,
    );
    process.exit(1);
  }
  console.log(
    `Token check: ${files.length} files, no raw colors, sizes or durations outside src/theme.`,
  );
}

module.exports = { findViolations };
if (require.main === module) main();
