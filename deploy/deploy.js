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

/* The Content-Security-Policy edge rule carries SHA-256 hashes of the inline script and
 * style, so ANY edit to index.html changes it. The page is served with both a meta CSP
 * and this header, and both are enforced — a header left on the previous build's hashes
 * blocks the script outright and the page renders dead. So the rule is synced here,
 * every deploy, rather than being left to memory.
 *
 * The rule is updated BEFORE upload and the cache is purged after, so the new header and
 * the new HTML become visible together on the purge. */
async function syncCsp() {
  const cspFile = path.join(__dirname, 'csp-header.txt');
  if (!fs.existsSync(cspFile)) die('deploy/csp-header.txt not found — run `node deploy/build.js` first.');
  const csp = fs.readFileSync(cspFile, 'utf8').trim();

  if (!PULLZONE || !API_KEY) {
    if (process.argv.includes('--no-csp-sync')) {
      console.log('CSP sync skipped (--no-csp-sync). Update the edge rule by hand or the page will break.\n');
      return;
    }
    die(
      'cannot sync the Content-Security-Policy edge rule: BUNNY_PULLZONE_ID and ' +
      'BUNNY_API_KEY must both be set.\n' +
      '       The header carries hashes of the inline script and style, so deploying ' +
      'without updating it\n       would block the script and leave a dead page. Set both, ' +
      'or pass --no-csp-sync if you\n       have already updated the rule yourself.'
    );
  }

  const headers = { AccessKey: API_KEY, Accept: 'application/json' };
  const res = await fetch('https://api.bunny.net/pullzone/' + PULLZONE, { headers });
  if (!res.ok) throw new Error('could not read pull zone: HTTP ' + res.status);
  const pz = await res.json();
  const rule = (pz.EdgeRules || []).find(
    (e) => e.ActionType === 5 && (e.ActionParameter1 || '').toLowerCase() === 'content-security-policy'
  );
  if (!rule) die('no Content-Security-Policy edge rule found on pull zone ' + PULLZONE + '.');

  if (rule.ActionParameter2.trim() === csp) {
    console.log('CSP edge rule already matches this build.\n');
    return;
  }
  if (DRY) {
    console.log('  would update the CSP edge rule to the hashes in deploy/csp-header.txt\n');
    return;
  }
  // Reuse the Guid so this updates the rule in place rather than adding a second one.
  const put = await fetch('https://api.bunny.net/pullzone/' + PULLZONE + '/edgerules/addOrUpdate', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      Guid: rule.Guid,
      ActionType: 5,
      ActionParameter1: 'Content-Security-Policy',
      ActionParameter2: csp,
      Triggers: [{ Type: 0, PatternMatches: ['*'], PatternMatchingType: 0 }],
      TriggerMatchingType: 0,
      Description: 'Security header: Content-Security-Policy (hashes — synced by deploy/deploy.js)',
      Enabled: true,
    }),
  });
  if (!put.ok) throw new Error('CSP edge rule update failed: HTTP ' + put.status + ' ' + (await put.text()));
  console.log('CSP edge rule updated to this build\'s hashes.\n');
}

(async () => {
  console.log((DRY ? 'DRY RUN — ' : '') + 'deploying ' + files.length + ' file(s) to ' + HOST + '/' + ZONE + '\n');
  await syncCsp();
  for (const f of files) await upload(f);
  await purge();
  console.log('\ndone.');
})().catch((e) => die(e.message));
