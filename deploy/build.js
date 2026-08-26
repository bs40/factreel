/* Build the deployable copy of FactReel into dist/.
 *
 * FactReel is a single self-contained HTML file, so "building" means two things:
 *   1. copy only the files that belong on a public CDN (no server.js, no research/)
 *   2. compute the CSP hashes for the inline <style> and <script> and inject a
 *      <meta http-equiv="Content-Security-Policy"> carrying them
 *
 * The hashes change whenever index.html changes, which is exactly why this is a
 * script and not a value pasted into the HTML by hand.
 *
 *   node deploy/build.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

// Everything that gets published. Anything not listed here never reaches the CDN.
const ASSETS = [
  'playlist.music-5min.json',
  'playlist.music-by-bill.json',
  'playlist.pop-hits.json',
  'playlist.example.json',
];

const sha256 = (s) =>
  "'sha256-" + crypto.createHash('sha256').update(s, 'utf8').digest('base64') + "'";

// [^] matches any character including newlines, and needs no escaping.
function inlineContent(html, tag) {
  const m = html.match(new RegExp('<' + tag + '>([^]*?)</' + tag + '>'));
  if (!m) throw new Error('no inline <' + tag + '> block found in index.html');
  return m[1];
}

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// Only the markup matters: a style="" mentioned inside a CSS or JS comment is not an
// attribute, so strip those blocks before checking. A real style attribute would force
// style-src 'unsafe-inline', which is exactly what this build is trying to avoid.
const markupOnly = html
  .replace(new RegExp('<style>[^]*?</style>', 'g'), '')
  .replace(new RegExp('<script>[^]*?</script>', 'g'), '');
if (markupOnly.includes(' style="')) {
  throw new Error(
    'index.html contains a style="" attribute; that would require ' +
    "style-src 'unsafe-inline'. Move it to a class instead."
  );
}

const styleHash = sha256(inlineContent(html, 'style'));
const scriptHash = sha256(inlineContent(html, 'script'));

/* The origins below are the ones the page is actually observed to contact:
   self (the page plus its playlist JSON), www.youtube.com (IFrame API, oEmbed and
   the player frame) and i.ytimg.com (video thumbnails). Nothing else. */
const CSP = [
  "default-src 'none'",
  'script-src ' + scriptHash + ' https://www.youtube.com',
  'style-src ' + styleHash,
  "img-src 'self' https://i.ytimg.com",
  "connect-src 'self' https://www.youtube.com",
  'frame-src https://www.youtube.com https://www.youtube-nocookie.com',
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

// frame-ancestors and upgrade-insecure-requests are ignored in a <meta> CSP; they only
// bite when sent as a real header, which is what the Bunny Edge Rule is for. The meta
// tag is defence in depth for the case where the header is missing or misconfigured.
const META_CSP = CSP.split('; ')
  .filter((d) => !/^(frame-ancestors|upgrade-insecure-requests)/.test(d))
  .join('; ');

const out = html.replace(
  '<meta name="viewport"',
  '<meta http-equiv="Content-Security-Policy" content="' + META_CSP + '" />\n<meta name="viewport"'
);
if (out === html) {
  throw new Error('could not find the viewport meta tag to anchor the CSP meta');
}

// Clear stale files without removing the directory itself. On Windows the directory can
// be held open by a shell, an editor or a local server, and removing it would fail there.
fs.mkdirSync(DIST, { recursive: true });
for (const f of fs.readdirSync(DIST)) {
  const p = path.join(DIST, f);
  if (fs.statSync(p).isFile()) fs.rmSync(p, { force: true });
}
fs.writeFileSync(path.join(DIST, 'index.html'), out);
for (const a of ASSETS) fs.copyFileSync(path.join(ROOT, a), path.join(DIST, a));

let total = 0;
console.log('dist/');
for (const f of fs.readdirSync(DIST).sort()) {
  const size = fs.statSync(path.join(DIST, f)).size;
  total += size;
  console.log('  ' + f.padEnd(30) + String(size).padStart(7) + ' bytes');
}
console.log('  ' + 'TOTAL'.padEnd(30) + String(total).padStart(7) + ' bytes (' + (total / 1024).toFixed(1) + ' KB)');

fs.writeFileSync(path.join(__dirname, 'csp-header.txt'), CSP + '\n');
console.log('\nContent-Security-Policy header value (also written to deploy/csp-header.txt):\n');
console.log(CSP);
