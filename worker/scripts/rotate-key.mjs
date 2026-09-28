#!/usr/bin/env node
/**
 * npm run worker:rotate-key — replace the Worker access key and pair phones with it.
 * npm run worker:rotate-dev-key — the same for the development key (--dev).
 *
 * Makes a new random key, gives it to the Worker as a secret (the old key is refused within
 * seconds), and shows it as a QR code (annum://pair?key=…) until Enter is pressed, then clears
 * the screen. The key is never written to a file or printed as text. See PROGRESS.md "If a
 * phone is lost".
 *
 * Two keys: ANNUM_WORKER_KEY for the phones' TestFlight builds (real banks), and ANNUM_DEV_KEY
 * (--dev) for development builds and the Simulator, which the Worker lets reach Sandbox only.
 * Only the development key is ever sent to a Simulator, so the real one stays off this Mac.
 *
 * Options:
 *   --dev                      the development key (Sandbox only) instead of the phones' key
 *   --simulator <udid|booted>  also send the pairing link to an iOS Simulator (with --dev only)
 *   --no-qr                    don't show the QR code (only with --simulator)
 */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

import QRCode from 'qrcode';

const workerDir = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const dev = args.includes('--dev');
const secretName = dev ? 'ANNUM_DEV_KEY' : 'ANNUM_WORKER_KEY';
const simIndex = args.indexOf('--simulator');
const simulator = simIndex >= 0 ? args[simIndex + 1] : null;
const showQr = !args.includes('--no-qr');
if (simIndex >= 0 && !simulator) {
  console.error('Usage: npm run worker:rotate-dev-key -- --simulator <udid|booted>');
  process.exit(1);
}
if (simulator && !dev) {
  console.error(
    'The Simulator takes the development key only, so the one that reaches real banks stays\n' +
      'off this Mac. Use: npm run worker:rotate-dev-key -- --simulator ' +
      simulator,
  );
  process.exit(1);
}
if (!showQr && !simulator) {
  console.error('--no-qr only makes sense with --simulator.');
  process.exit(1);
}

/** Run a command without a shell; `input` goes to its stdin. Resolves with the exit code. */
function run(command, commandArgs, { input, cwd, quiet } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, commandArgs, {
      cwd,
      stdio: [input === undefined ? 'inherit' : 'pipe', quiet ? 'ignore' : 'inherit', 'inherit'],
    });
    if (input !== undefined) child.stdin.end(input);
    child.on('close', resolve);
  });
}

const key = randomBytes(32).toString('base64url');
const link = `annum://pair?key=${key}`;

console.log(
  dev
    ? 'Making a new development key (test banks only) and giving it to the Worker…'
    : 'Making a new access key and giving it to the Worker…',
);
const code = await run('npx', ['wrangler', 'secret', 'put', secretName], {
  input: key,
  cwd: workerDir,
  quiet: true,
});
if (code !== 0) {
  console.error(
    '\nThe Worker didn’t take the new key, so nothing changed: the old key still works.\n' +
      'Check that you’re logged in (npx wrangler whoami, in the worker folder) and try again.',
  );
  process.exit(1);
}
/** The Worker's address, from app.json (the only place it's written). */
const appJson = JSON.parse(readFileSync(join(workerDir, '..', 'app.json'), 'utf8'));
const workerUrl = appJson.expo.extra.workerUrl;

/**
 * Cloudflare takes a few seconds to switch to the new key everywhere: wait until the Worker
 * accepts it, so a phone that scans right away isn't turned down.
 */
async function acceptedByWorker() {
  for (let i = 0; i < 45; i++) {
    try {
      const res = await fetch(`${workerUrl}/v1/status`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-annum-key': key },
        body: '{}',
      });
      if (res.ok) return true;
    } catch {
      // offline for a moment: try again
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return false;
}

process.stdout.write('Waiting for the Worker to switch to it…');
if (!(await acceptedByWorker())) {
  console.error(
    '\nThe Worker has the new key but isn’t answering with it yet. Wait a minute and run this again.',
  );
  process.exit(1);
}
console.log(' done. The old key no longer works.\n');

if (simulator) {
  const sent = await run('xcrun', ['simctl', 'openurl', simulator, link], { quiet: true });
  console.log(
    sent === 0
      ? 'Sent to the Simulator. Tap “Open” there if it asks.\n'
      : 'The Simulator didn’t take the link (is it booted, with Annum installed?).\n',
  );
}

if (showQr) {
  const qr = await QRCode.toString(link, { type: 'terminal', small: true });
  console.log(qr);
  console.log(
    dev
      ? 'On each iPhone running a development build: point the Camera at this code and tap “Open in Annum”.'
      : 'On each iPhone: point the Camera at this code and tap “Open in Annum”.',
  );
  console.log('This code is the key: never screenshot, photograph or send it.\n');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  await new Promise((resolve) =>
    rl.question('Press Enter when every phone has scanned it… ', resolve),
  );
  rl.close();
  // Clear the screen and the scrollback so the code doesn't stay behind.
  process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
  console.log('Screen cleared. Each phone you scanned is paired.');
}
