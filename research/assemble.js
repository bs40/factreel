// Assembles the new "Music (5 min max)" FactReel playlist.
// Reuses facts from the existing playlist.music-by-bill.json (by video id),
// merges in newfacts.json (the 15 new tracks), and emits in the current playlist order.
const fs = require('fs');
const path = require('path');

const POPSTAR = 'C:/Users/Janet/.claude/PopStar';
const SCRATCH = __dirname;

const idFromUrl = u => (u.split('v=')[1] || '').split('&')[0];

// existing 45-track playlist -> id -> facts
const existing = JSON.parse(fs.readFileSync(path.join(POPSTAR, 'playlist.music-by-bill.json'), 'utf8'));
const existingById = {};
existing.videos.forEach(v => { existingById[idFromUrl(v.url)] = v.facts; });

// new tracks facts -> { id: [facts] }
const newById = JSON.parse(fs.readFileSync(path.join(SCRATCH, 'newfacts.json'), 'utf8'));

// current playlist order (55 playable tracks)
const order = [
  "PUdyuKaGQd4","PEnJbjBuxnw","Qc7_zRjH808","Wgw6tJ8yz9M","u4HQevc9JE0","TLiGA_wrNp0","T8GpG8C0YzA","T8BI2fKzdys","k3DBmAlUh1A","pAwR6w2TgxY","qYAONSDnMrc","NIdWvUuEBB0","qs1bG6BIYlo","uPL2R-3O0fE","yupEwQ6qCd0","iZAqaykiS70","JwtEOp7pC1A","emOKaGi8u5U","mraLsg-G4wA","zDul1dkWxFk","RlMg8FbcP7g","XE2051n3O-I","E3eGwKuSPC8","5qFhSWA9Cz4","kFeZdHBKFhI","2OJsuW3SBfw","8Nkbic1B4jE","2y1VLfcHCbY","RGk29D9oOt4","ZbGX7IeMmiw","V7QaGc2fmmE","U8GtqShFWB8","bnLg6DPiZb8","CAXIOJSp_2g","oT0fNP0r1lI","-YJYcgl-yq0","DEsKgbYs9Mc","LomY6nWI0ek","gTVT7gzZ48M","iu5rnQkfO6M","Q_igolfkQU0","rECyz9LLiy8","qK9p2akzAxU","0lXkLbD4xMU","aLnzrkVbHgs","340FUuMghIU","Z78lyvdqlMQ","wloHzZYvc-k","7TgNkts5aDo","v_bDR1r3Hmw","4xoho5p-kYQ","JVAfyfX9cRw","IHjR7nyXoh4","xKOzFnhW5Og","TT7Ui-b9k78"
];

const videos = [];
const missing = [];
for (const id of order) {
  const facts = existingById[id] || newById[id];
  if (!facts || !facts.length) { missing.push(id); continue; }
  videos.push({ url: `https://www.youtube.com/watch?v=${id}`, facts });
}

const out = {
  title: "Music (5 min max) — the stories behind the tracks",
  theme: "tv",
  factDuration: 10,
  videos
};

fs.writeFileSync(path.join(POPSTAR, 'playlist.music-5min.json'), JSON.stringify(out, null, 2) + '\n');
const total = videos.reduce((a, v) => a + v.facts.length, 0);
console.log('videos:', videos.length, '/ order:', order.length);
console.log('total facts:', total);
console.log('missing (no facts yet):', missing.join(', ') || 'none');
console.log('tracks with <5 facts:', videos.filter(v => v.facts.length < 5).map(v => idFromUrl(v.url) + '(' + v.facts.length + ')').join(', ') || 'none');
