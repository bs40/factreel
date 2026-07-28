# FactReel

Play a playlist of YouTube videos fullscreen, with **fact overlays** that appear on top of
the video, spread evenly across each video's duration.

Everything lives in one file: **`index.html`**. No build step, no server. Double-click it,
or host the folder anywhere static.

## Use it

1. Open `index.html` in a browser.
2. Add videos (paste a YouTube URL or an 11-character video ID) and type facts — one per line.
3. Pick a **theme** for the fact box and set how long each fact stays on screen.
4. Click **▶ Play playlist**. It goes fullscreen; facts fade in over the video.
   - `←` / `→` or the on-screen buttons skip between videos.
   - `Esc` (or the ✕ button) exits.

Your playlist is saved automatically in the browser (localStorage). Use **Export JSON** to
save a copy, **Import JSON** to load one, and **Load example** to see the format.

### Load a playlist by URL

Add `?playlist=<path-or-url>` to load a JSON playlist directly:

```
http://localhost:5199/?playlist=playlist.pop-hits.json
http://localhost:5199/?playlist=https://example.com/mylist.json
```

The value can be a file served alongside `index.html` or any full URL. This overrides the
saved localStorage playlist, so it's the reliable way to share a specific playlist link.

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

- **Closed captions are always forced off.** YouTube's caption track is cleared on every
  video and re-checked continuously during playback, so CC can't reappear (even if a video
  defaults it on or the viewer's account has "always show captions" enabled).

## Notes

- Overlays render via a **custom fullscreen container** (the whole stage goes fullscreen, not
  the bare iframe) — that's what lets the fact boxes sit on top of the video.
- Playback needs an internet connection (it loads the YouTube IFrame API). Autoplay with sound
  is allowed because playback starts from your click.
- Some videos disable embedding; those won't play inside any site's iframe.
