# FactReel

Play a playlist of YouTube videos fullscreen, with **fact overlays** that appear on top of
the video, spread evenly across each video's duration.

Everything lives in one file: **`index.html`**. No build step, no server for local use —
double-click it. To publish it, see [Hosting](#hosting).

## Use it

1. Open `index.html` in a browser.
2. Add videos (paste a YouTube URL or an 11-character video ID) and type facts — one per line.
3. Pick a **theme** for the fact box and set how long each fact stays on screen.
4. Click **▶ Play playlist**. It goes fullscreen; facts fade in over the video.
   - `←` / `→` or the on-screen buttons skip between videos.
   - `Esc` (or the ✕ button) exits.

Your playlist is saved automatically in the browser (localStorage). Use **Export JSON** to
save a copy, **Import JSON** to load one, and **Load example** to see the format.

### Built-in playlists

The **load** dropdown in the bottom toolbar lists the playlists shipped alongside
`index.html`. Picking one fetches it from the same origin and replaces the editor
contents.

That list is a hardcoded allowlist in `index.html` (`const CURATED`). To publish a new
playlist, drop the JSON next to `index.html`, add an entry to `CURATED`, and add the
filename to `ASSETS` in `deploy/build.js`.

There is deliberately **no way to point the app at an arbitrary URL**. Nothing a visitor
types in the address bar reaches `fetch()`, so the page cannot be used to pull JSON from
a host someone else controls. Playlists you have not published arrive by **Import JSON**
(read in the browser via `FileReader`) or by pasting into the editor — neither ever
touches the server.

## How the timing works

The first caption appears early (within the first few seconds) and the rest are spread evenly
through to near the end of the video: fact _k_ appears at `first + (k / (N-1)) · (last - first)`,
where `first ≈ 3s` and `last = D - factDuration`. Each caption stays visible for `factDuration`
seconds. Durations are read from the YouTube player, so timing is correct per video and updates
if you skip around.

Tip: make the first caption a title card that names the artist and song — it shows up front
while the rest of the facts follow.

## Playlist format (`playlist.example.json`)

```json
{
  "title": "My playlist",
  "theme": "tv",              // tv | lower-third | neon | minimal | typewriter
  "factDuration": 8,           // seconds each fact stays on screen
  "videos": [
    {
      "url": "https://www.youtube.com/watch?v=VIDEO_ID",
      "facts": ["First fact...", "Second fact..."]
    }
  ]
}
```

`url` accepts a full watch URL, a `youtu.be/…` link, an `/embed/…` or `/shorts/…` URL, or a
bare 11-character video ID.

## Themes

Five presets are built in. To change colors, border, radius, font, or padding, edit the
`--fb-*` CSS variables under the `/* THEMES */` section of `index.html`. Each theme is just a
block of variable overrides, so adding a new one is a copy-paste.

## Playback behaviour

- **Adverts are handled.** While an advert is on screen the player reports the *ad’s*
  duration and position, not the video’s. Facts are hidden for the duration of an ad, and
  the schedule is rebuilt as soon as the real duration appears — so a pre-roll cannot
  collapse every fact into the first few seconds. See `adShowing()` and the duration check
  in `tick()`.
- **Closed captions are always forced off.** YouTube's caption track is cleared on every
  video and re-checked continuously during playback, so CC can't reappear (even if a video
  defaults it on or the viewer's account has "always show captions" enabled).
- **Start anywhere.** The bottom toolbar has a **Play ▸ from** picker listing every track by
  name (names are read from the playlist JSON, or fetched from YouTube if omitted). It
  defaults to the first track; pick another to start playback from there.
- **Caption timing.** The first caption appears within a few seconds; the last appears
  22 seconds before the end and clears 10 seconds later. The rest are spread evenly between.
- **Progress clock.** A single-hand clock in the bottom-right sweeps clockwise once over the
  whole song (12 o'clock empty → 12 o'clock full), with always-visible tick markers at each
  caption's position. It matches the active theme's colours and a single-line banner's height.

## Hosting

The site is static: HTML, CSS, JS and JSON, with no server-side code and no upload path.
All video bandwidth is YouTube’s, not the host’s.

```bash
node deploy/build.js
```

That writes `dist/` — `index.html` plus the published playlists, and nothing else
(`server.js` and `research/` stay local). It also computes SHA-256 hashes for the inline
`<style>` and `<script>` and injects a matching Content-Security-Policy meta tag, so the
page needs neither `unsafe-inline` nor an external script file. The full header value,
including the directives a meta tag cannot carry, is written to `deploy/csp-header.txt`.

Rerun the build after **any** edit to `index.html` — the hashes change with the content,
and a stale hash blocks the script.

To publish to Bunny.net, see [deploy/README.md](deploy/README.md).

## Notes

- Overlays render via a **custom fullscreen container** (the whole stage goes fullscreen, not
  the bare iframe) — that's what lets the fact boxes sit on top of the video.
- Playback needs an internet connection (it loads the YouTube IFrame API). Autoplay with sound
  is allowed because playback starts from your click.
- Some videos disable embedding; those won't play inside any site's iframe.
