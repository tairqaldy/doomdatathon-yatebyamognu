// Generates the ORIGINAL landing imagery with OpenAI Images (no third-party photos → no IP risk).
//   node scripts/gen-images.mjs [--only name1,name2] [--model gpt-image-2.6-sunburst]
// Output: landing-tair/assets/<name>.webp. Prompts are the source of truth; log cost/time in docs/TOOLING.md.
import { writeFile, mkdir } from 'node:fs/promises';
import { loadEnv } from './env.mjs';
loadEnv();
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const MODEL = arg('model', 'gpt-image-2.6-sunburst');
const STYLE = 'Shot on expired 35mm film, soft analog grain, gentle halation and light leaks, dreamy surreal calm, natural colours with deep cerulean sky, quiet and minimal composition with generous negative space, no text, no logos, no watermark, photographic, cinematic.';
const SCENES = [
  ['hero-meadow', '1536x1024', 'Low angle from inside a meadow of blue cornflowers and white daisies swaying in wind, a tiny distant human silhouette walking on the crest of the hill into a huge bright sky with a soft sun flare and luminous clouds.'],
  ['bird', '1024x1536', 'Looking straight up through a ring of sunlit green leaves at a deep blue sky, a single white dove gliding in the middle of the opening, wings fully spread.'],
  ['horse', '1536x1024', 'A dark horse galloping freely across a high golden plateau, motion blur, a snow-capped volcano far behind with a faint circular halo of light around its peak.'],
  ['rest', '1536x1024', 'A person in a white jacket lying on their back with arms spread on a steep mountain meadow full of tiny yellow flowers, seen from above at an angle, snowy peaks and white clouds beyond, peaceful.'],
  ['shore', '1536x1024', 'An empty calm shoreline at golden hour, gentle foam, endless ocean horizon, a single white wooden chair standing in the shallow water, soft pastel sky.'],
  ['door', '1024x1536', 'A lone open white door frame standing in perfectly still shallow sea water that mirrors the sky, warm light coming through the open door, surreal and serene, minimalist.'],
  ['bluehour', '1536x1024', 'A wide open field at blue hour, the sky fading from deep indigo to soft violet, a single warm glowing lamp on a thin pole in the middle of the field, quiet and safe.'],
  ['clouds', '1536x1024', 'Close-up of soft billowing white clouds against a gradient sky from pale blue to warm peach, abstract, airy, weightless.'],
];
const only = arg('only') ? new Set(arg('only').split(',')) : null;
await mkdir('landing-tair/assets', { recursive: true });
const queue = SCENES.filter(([n]) => !only || only.has(n));
let done = 0;
async function worker() {
  while (queue.length) {
    const [name, size, prompt] = queue.shift();
    const t0 = Date.now();
    try {
      const r = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODEL, prompt: `${prompt} ${STYLE}`, size, quality: 'medium', output_format: 'webp', output_compression: 82, n: 1 }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message || r.status);
      await writeFile(`landing-tair/assets/${name}.webp`, Buffer.from(j.data[0].b64_json, 'base64'));
      console.log(`✓ ${name} ${size} ${((Date.now() - t0) / 1000).toFixed(1)}s ${JSON.stringify(j.usage || {})}`);
    } catch (e) { console.log(`✗ ${name} ${e.message}`); }
    done++;
  }
}
await Promise.all([worker(), worker(), worker()]);
console.log(`done ${done}`);
