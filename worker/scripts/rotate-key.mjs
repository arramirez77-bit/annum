#!/usr/bin/env node
/**
 * npm run worker:rotate-key — replace the Worker access key and pair phones with it.
 *
 * Makes a new random key, gives it to the Worker as the ANNUM_WORKER_KEY secret (the old key is
 * refused within seconds), and shows it as a QR code (annum://pair?key=…) until Enter is
 * pressed, then clears the screen. The key is never written to a file or printed as text.
 * See PROGRESS.md "If a phone is lost".
 *
 * Options:
 *   --simulator <udid|booted>  also send the pairing link to an iOS Simulator (development)
 *   --no-qr                    don't show the QR code (only with --simulator)
 */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { dirname } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

import QRCode from 'qrcode';

const workerDir = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const simIndex = args.indexOf('--simulator');
const simulator = simIndex >= 0 ? args[simIndex + 1] : null;
const showQr = !args.includes('--no-qr');
if (simIndex >= 0 && !simulator) {
  console.error('Usage: npm run worker:rotate-key -- --simulator <udid|booted>');
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

console.log('Making a new access key and giving it to the Worker…');
const code = await run('npx', ['wrangler', 'secret', 'put', 'ANNUM_WORKER_KEY'], {
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
console.log('Done. The old key no longer works.\n');

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
  console.log('On each iPhone: point the Camera at this code and tap “Open in Annum”.');
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
