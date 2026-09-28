#!/usr/bin/env node
/**
 * npm run worker:set-plaid-keys — give the Worker the Plaid client ID and Sandbox secret.
 *
 * Asks for both keys without showing them, checks them with Plaid Sandbox first, and only
 * then stores those exact values as the Worker's PLAID_CLIENT_ID and PLAID_SECRET_SANDBOX
 * secrets. If Plaid turns them down, nothing changes on the Worker. The keys are never
 * written to a file or printed; only their length and kind of characters are shown.
 *
 * The Production secret is not set here: that happens only on Andy's go-ahead for real banks.
 */
import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const workerDir = dirname(dirname(fileURLToPath(import.meta.url)));

/** Run a command without a shell; `input` goes to its stdin. Resolves with the exit code. */
function run(command, commandArgs, { input, cwd }) {
  return new Promise((resolve) => {
    const child = spawn(command, commandArgs, { cwd, stdio: ['pipe', 'ignore', 'inherit'] });
    child.stdin.end(input);
    child.on('close', resolve);
  });
}

/** Ask without echoing what's typed or pasted. Enter ends it; Ctrl-C stops everything. */
function askHidden(question) {
  process.stdout.write(question);
  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');
  return new Promise((resolve) => {
    let value = '';
    const done = (answer) => {
      stdin.removeListener('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write('\n');
      resolve(answer);
    };
    const onData = (chunk) => {
      // Some terminals wrap a paste in bracketed-paste markers.
      for (const ch of chunk.replace(/\x1b\[20[01]~/g, '')) {
        if (ch === '\r' || ch === '\n') return done(value);
        if (ch === '\x03') {
          stdin.setRawMode(false);
          process.stdout.write('\nStopped. Nothing changed on the Worker.\n');
          process.exit(130);
        }
        if (ch === '\x7f' || ch === '\b') value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on('data', onData);
  });
}

/** Without a terminal (tests), read the two keys as two lines from stdin. */
async function readPiped() {
  let text = '';
  for await (const chunk of process.stdin) text += chunk;
  return text.split('\n');
}

/** "24 · hex": a key's shape, never its value (same idea as shapeOf in src/handler.ts). */
function shapeOf(value) {
  if (!value) return 'empty';
  const kinds = [
    /^[0-9a-f]+$/.test(value) ? 'hex' : /^[A-Za-z0-9]+$/.test(value) ? 'letters and digits' : null,
    /[^\x21-\x7e]/.test(value) ? 'hidden or non-ASCII characters' : null,
    /["'`]/.test(value) ? 'quotes' : null,
    /[•*]/.test(value) ? 'mask dots' : null,
  ].filter(Boolean);
  return `${value.length} characters · ${kinds.join(', ') || 'mixed characters'}`;
}

console.log('Plaid Dashboard → Developers → Keys has both. Nothing you type or paste is shown.\n');
let clientIdInput;
let secretInput;
if (process.stdin.isTTY) {
  clientIdInput = await askHidden('Paste the client ID, then press Enter: ');
  secretInput = await askHidden('Paste the Sandbox secret, then press Enter: ');
} else {
  [clientIdInput = '', secretInput = ''] = await readPiped();
}
// The Worker trims its secrets the same way, so what's checked here is what it will use.
const clientId = clientIdInput.trim();
const secret = secretInput.trim();
console.log(`\nClient ID: ${shapeOf(clientId)}`);
console.log(`Sandbox secret: ${shapeOf(secret)}`);
if (!clientId || !secret) {
  console.error('\nOne of them is empty, so nothing changed on the Worker. Run this again.');
  process.exit(1);
}

process.stdout.write('\nChecking them with Plaid Sandbox…');
let answer;
try {
  const res = await fetch('https://sandbox.plaid.com/institutions/get', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      secret,
      count: 1,
      offset: 0,
      country_codes: ['US'],
    }),
  });
  answer = { ok: res.ok, body: await res.json().catch(() => ({})) };
} catch {
  console.error('\nCouldn’t reach Plaid (offline?). Nothing changed on the Worker.');
  process.exit(1);
}
if (!answer.ok) {
  const { error_code: code = 'no code', error_message: message = '' } = answer.body;
  console.error(`\nPlaid didn’t accept them: ${code}${message ? ` (${message})` : ''}`);
  console.error(
    'Nothing changed on the Worker. Copy both again from Developers → Keys (the Sandbox\n' +
      'secret, not Production) and run this again.',
  );
  process.exit(1);
}
console.log(' Plaid accepts them.');

for (const [name, value] of [
  ['PLAID_CLIENT_ID', clientId],
  ['PLAID_SECRET_SANDBOX', secret],
]) {
  process.stdout.write(`Giving the Worker ${name}…`);
  const code = await run('npx', ['wrangler', 'secret', 'put', name], {
    input: value,
    cwd: workerDir,
  });
  if (code !== 0) {
    console.error(
      `\nThe Worker didn’t take ${name} (wrangler stopped with code ${code}).\n` +
        'Check that you’re logged in (npx wrangler whoami, in the worker folder) and run this again.',
    );
    process.exit(1);
  }
  console.log(' done.');
}
console.log('\nDone. The Worker uses the new keys within a few seconds. Tell Claude it’s done.');
