/* Upload dist/ to a Bunny Storage Zone, then optionally purge the Pull Zone cache.
 *
 *   node deploy/build.js          # always build first
 *   node deploy/deploy.js --dry-run
 *   node deploy/deploy.js
 *
 * Credentials come from the environment and are never written to disk or logged:
 *
 *   BUNNY_STORAGE_ZONE   required   storage zone name, e.g. factreel
 *   BUNNY_STORAGE_KEY    required   the zone's Password / FTP & API Access key
 *   BUNNY_STORAGE_HOST   optional   defaults to storage.bunnycdn.com (Falkenstein).
 *                                   Use the hostname shown on the zone's
 *                                   "FTP & API Access" tab, e.g. uk.storage.bunnycdn.com
 *   BUNNY_PULLZONE_ID    optional   numeric pull zone id; enables a cache purge
 *   BUNNY_API_KEY        optional   account API key, required for the purge
 *
 * Set them for one command rather than leaving them in your shell history, e.g.
 * in PowerShell:  $env:BUNNY_STORAGE_KEY = (Read-Host -AsSecureString | ...)
 */
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const DRY = process.argv.includes('--dry-run');

const ZONE = process.env.BUNNY_STORAGE_ZONE;
const KEY = process.env.BUNNY_STORAGE_KEY;
const HOST = process.env.BUNNY_STORAGE_HOST || 'storage.bunnycdn.com';
const PULLZONE = process.env.BUNNY_PULLZONE_ID;
const API_KEY = process.env.BUNNY_API_KEY;

function die(msg) {
  console.error('error: ' + msg);
  process.exit(1);
}

if (!fs.existsSync(DIST)) die('dist/ not found — run `node deploy/build.js` first.');
if (!ZONE) die('BUNNY_STORAGE_ZONE is not set.');
if (!DRY && !KEY) die('BUNNY_STORAGE_KEY is not set.');

const files = fs.readdirSync(DIST).filter((f) => fs.statSync(path.join(DIST, f)).isFile()).sort();
if (files.length === 0) die('dist/ is empty.');

async function upload(name) {
  const body = fs.readFileSync(path.join(DIST, name));
  const url = 'https://' + HOST + '/' + ZONE + '/' + name;
  if (DRY) {
    console.log('  would PUT  ' + name.padEnd(30) + String(body.length).padStart(7) + ' bytes  -> ' + url);
    return;
  }
  const res = await fetch(url, {
    method: 'PUT',
    headers: { AccessKey: KEY, 'Content-Type': 'application/octet-stream' },
    body,
  });
  if (!res.ok) throw new Error('PUT ' + name + ' failed: HTTP ' + res.status + ' ' + (await res.text()));
  console.log('  uploaded   ' + name.padEnd(30) + String(body.length).padStart(7) + ' bytes');
}

async function purge() {
  if (!PULLZONE) {
    console.log('\nBUNNY_PULLZONE_ID not set — skipping cache purge.');
    console.log('Until the edge cache expires, visitors may still get the previous build.');
    return;
  }
  if (!API_KEY) die('BUNNY_PULLZONE_ID is set but BUNNY_API_KEY is not.');
  const url = 'https://api.bunny.net/pullzone/' + PULLZONE + '/purgeCache';
  if (DRY) {
    console.log('\n  would POST ' + url);
    return;
  }
  const res = await fetch(url, { method: 'POST', headers: { AccessKey: API_KEY } });
  if (!res.ok) throw new Error('purge failed: HTTP ' + res.status + ' ' + (await res.text()));
  console.log('\ncache purged for pull zone ' + PULLZONE);
}

(async () => {
  console.log((DRY ? 'DRY RUN — ' : '') + 'deploying ' + files.length + ' file(s) to ' + HOST + '/' + ZONE + '\n');
  for (const f of files) await upload(f);
  await purge();
  console.log('\ndone.');
})().catch((e) => die(e.message));
