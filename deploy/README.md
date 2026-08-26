# Hosting FactReel on Bunny.net

FactReel is a static site: HTML, CSS, JS and JSON, with **no server-side code and no upload
path**. Bunny only ever serves bytes you published yourself. All video bandwidth is
YouTube's, not yours.

Total deployable: **~140 KB** across five files.

---

## 1. Build

```bash
node deploy/build.js
```

Writes `dist/` — `index.html` plus the four published playlists. `server.js` and `research/`
are local-only and never leave your machine.

The build also computes SHA-256 hashes of the inline `<style>` and `<script>` and injects a
matching `Content-Security-Policy` meta tag, so the page needs no `unsafe-inline`. The full
header value lands in `deploy/csp-header.txt`.

**Rerun the build after any edit to `index.html`.** The hashes change with the content, and a
stale hash blocks the script — the page will render unstyled and do nothing.

---

## 2. Storage Zone

Storage → **Add Storage Zone**.

| Setting | Value |
| --- | --- |
| Name | `factreel` (this becomes `BUNNY_STORAGE_ZONE`) |
| Main region | whichever is closest to most of your audience |
| Replication | none needed — see *Cost* below |

Open **FTP & API Access** and note the **Password** (that is `BUNNY_STORAGE_KEY`) and the
**Hostname** (`BUNNY_STORAGE_HOST` — `storage.bunnycdn.com` for Falkenstein, otherwise
region-prefixed such as `uk.storage.bunnycdn.com`). Use the hostname the panel shows you
rather than guessing it.

## 3. Pull Zone

CDN → **Add Pull Zone**.

| Setting | Value |
| --- | --- |
| Origin Type | **Storage Zone** |
| Storage Zone | the one above |
| Pricing tier | Standard is fine; see *Cost* |

Note the numeric **Pull Zone ID** from the URL — that is `BUNNY_PULLZONE_ID`.

Then upload and check `https://<zone>.b-cdn.net/`. If that returns a 404 instead of the app,
set **Storage Zone → Error Handling → 404 File Path** to `/index.html`.

## 4. Security headers (Edge Rules)

Pull Zone → **Edge Rules** → Add Edge Rule. For each row: Action **Set Response Header**,
Condition **Request URL → Match Any → `*`**.

| Header | Value |
| --- | --- |
| `Content-Security-Policy` | the contents of `deploy/csp-header.txt` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `no-referrer` |
| `X-Frame-Options` | `DENY` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` — **custom domain only**, and only once you are sure every subdomain can serve HTTPS |

Also enable **Force SSL** on the pull zone.

### Roll the CSP out in report-only mode first

The CSP is tight: `default-src 'none'`, hashed inline script and style, and only three
allowed origins (`self`, `www.youtube.com`, `i.ytimg.com`) — the three the page is actually
observed to contact.

The page has been confirmed to boot, apply its styles and build its playlist picker under
this exact policy. A **full playback run** under the policy has not been confirmed, and the
residual risk is that YouTube's widget API injects a `<style>` element into the parent
document, which `style-src` would block.

So for the first deploy, name the header `Content-Security-Policy-Report-Only` instead.
Play a couple of tracks, open DevTools → Console, and look for violation reports. If it is
clean, rename the rule to `Content-Security-Policy`. If `style-src` is reported, append
`'unsafe-inline'` to the `style-src` directive in `deploy/build.js` and rebuild — everything
else in the policy still holds.

## 5. Bunny Shield

Pull Zone → **Shield**. The **free** tier is $0/month per pull zone and gives you
preconfigured WAF rules, **2 rate limits**, and L3/L4/L7 DDoS mitigation including JS
Challenge. That is appropriate here: there is no login, no form, no database and no write
path, so the only meaningful abuse is volumetric.

Suggested free-tier rate limit: **100 requests / 10 seconds per IP**, action *Block*, applied
to `*`. A real visitor loads at most six files.

Premium ($9.50/month per pull zone) adds 10 custom WAF rules and 10 rate limits. You do not
need it unless traffic becomes genuinely hostile.

## 6. Custom domain

Pull Zone → **Hostnames** → Add Hostname, then point a CNAME at `<zone>.b-cdn.net`. Bunny
provisions a free Let's Encrypt certificate automatically. Enable **Force SSL** once it is
issued.

## 7. Deploy

Credentials come from the environment and are never logged or written to disk. Set them
yourself — do not paste them into a file in this repo.

```bash
node deploy/build.js
node deploy/deploy.js --dry-run
node deploy/deploy.js
```

PowerShell:

```bash
$env:BUNNY_STORAGE_ZONE = "factreel"; $env:BUNNY_STORAGE_KEY = "<zone password>"; $env:BUNNY_PULLZONE_ID = "<id>"; $env:BUNNY_API_KEY = "<account api key>"; node deploy/build.js; node deploy/deploy.js
```

`BUNNY_PULLZONE_ID` + `BUNNY_API_KEY` are optional; without them the upload still happens but
the edge cache is not purged, so visitors may keep getting the previous build until it
expires.

---

## Cost

Bunny charges **$0.01/GB** in Europe and North America, has **no per-request fees**, and a
**$1/month minimum**. Storage is $0.01/GB/month — for 140 KB that rounds to nothing.

Gzipped transfer per visit: **12.4 KB** for the app shell alone, **13.9 KB** with the
pop-hits playlist, **34.4 KB** worst case (shell + the largest playlist).

| Visits / month | Bandwidth (worst case) | Bandwidth cost | Actually billed |
| ---: | ---: | ---: | ---: |
| 10,000 | 0.32 GB | $0.003 | $1.00 |
| 100,000 | 3.2 GB | $0.03 | $1.00 |
| 1,000,000 | 32 GB | $0.32 | $1.00 |
| 10,000,000 | 320 GB | $3.20 | $3.20 |

**About 3.1 million visits per month fit inside the $1 minimum**, worst case. Bandwidth is
not a risk for this project; the $1 minimum is your real bill until you are very popular.

Two things that would change this: replicating the storage zone to extra regions (+$0.01/GB
for the first extra, +$0.005/GB beyond) and Bunny Optimizer ($9.50/month per zone) — neither
of which this site needs.

Note that **thumbnails come from `i.ytimg.com` and video from YouTube**, so neither appears
on your bill at all.
