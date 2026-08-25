# research/ — how the playlists were built

These files regenerate the FactReel playlist JSONs from researched facts. They're
build-time helpers, not part of the app.

- **`collected_facts.json`** — accumulator of verified facts keyed by YouTube video id
  (the 45-track "Music by Bill" set), with a `titles` map and an `order` list.
- **`newfacts.json`** — facts for the tracks that were added when the source playlist was
  re-edited (keyed by video id).
- **`assemble.js`** — merges facts (existing playlist + `newfacts.json`) into a playlist in
  a fixed order and writes it out. Edit the `order` array + title/factDuration in the script.

## Regenerate

```bash
cd research
node assemble.js        # writes ../playlist.music-5min.json
```

`assemble.js` uses an absolute path to the project folder — update `POPSTAR` in the script if
the repo moves.

## Adding tracks

1. Get the current tracklist (ids + titles). Prefer YouTube's oEmbed endpoint over scraping:
   `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<id>&format=json`
   (works from Node and from the browser — it sends permissive CORS headers).
2. Research 5 facts per new track (one per group A–E: Creation, Career/Charts, Recording,
   Visual/Cultural, Wildcard). **Verify every fact against a real source; never fabricate.**
   Return fewer than 5 for genuinely obscure tracks rather than padding.
3. Add them to `newfacts.json` (id -> array of caption strings), add the ids to the `order`
   array in `assemble.js`, and re-run it.

## Note on the Claude Desktop crash

Doing this work has repeatedly corrupted the Claude Desktop app (persists across reboots;
needs a reinstall). Keep browser interactions short, never load a whole playlist in the
in-app browser (cap ~10 tracks), and do bulk lookups via Node/oEmbed instead of scraping the
YouTube playlist page.
