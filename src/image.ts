/**
 * PNG cards for link previews and feeds. 1200×630: the runner on the left,
 * the day and site on the right, colors from the day's palette.
 * Past days never change, so they are rasterized once and kept in memory.
 */
import { Resvg } from "@resvg/resvg-js";
import { runnerFor } from "./runners.ts";
import { dateOf, type Day } from "./chain.ts";

const fontDir = new URL("../assets/fonts/", import.meta.url).pathname;
const FONTS = [fontDir + "Syne-ExtraBold.ttf", fontDir + "Newsreader.ttf"];
const cache = new Map<number, Uint8Array>();
/**
 * Today's images are not immutable (the renderer can still change for an
 * unclaimed day), but they are the same for everyone: they are kept for a few
 * minutes so a burst of requests never rasterizes the same file twenty times.
 */
const TODAY_TTL_MS = 5 * 60_000;
const recent = new Map<string, { at: number; png: Uint8Array }>();
function remembered(key: string, immutable: boolean, store: Map<number, Uint8Array>, n: number, draw: () => Uint8Array): Uint8Array {
  const hit = store.get(n);
  if (hit) return hit;
  const r = recent.get(key);
  if (r && Date.now() - r.at < TODAY_TTL_MS) return r.png;
  const png = draw();
  if (immutable) store.set(n, png);
  else {
    if (recent.size > 64) recent.clear();
    recent.set(key, { at: Date.now(), png });
  }
  return png;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

export function cardSvg(day: Day): string {
  const k = runnerFor(day.epoch);
  const viewBox = k.svg.match(/viewBox="([^"]+)"/)![1];
  const inner = k.svg.replace(/^<svg [^>]*>/, "").replace(/<\/svg>$/, "");
  const fg = k.palette.cord, bg = k.palette.bg, muted = k.palette.shade;
  const t = k.traits;
  const line = `${k.race}: ${k.traits.filter((x) => x.type !== "Race" && x.type !== "Background").map((x) => x.value).slice(0, 4).join(", ")}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="${bg}"/>
<svg x="30" y="30" width="570" height="570" viewBox="${viewBox}" shape-rendering="crispEdges">${inner}</svg>
<rect x="30" y="30" width="570" height="570" fill="none" stroke="${muted}" stroke-width="2"/>
<text x="662" y="150" font-family="Newsreader" font-size="40" fill="${muted}">Day</text>
<text x="654" y="290" font-family="Syne" font-weight="800" font-size="150" fill="${fg}">${day.n}</text>
<text x="662" y="360" font-family="Newsreader" font-size="38" fill="${fg}">${esc(dateOf(day.epoch))}, UTC</text>
<text x="662" y="412" font-family="Newsreader" font-size="30" fill="${muted}">${esc(line)}</text>
<text x="662" y="560" font-family="Syne" font-weight="800" font-size="44" fill="${fg}">chainrun.onenft.click</text>
</svg>`;
}

export function dayPng(day: Day, immutable: boolean): Uint8Array {
  return remembered(`card${day.n}`, immutable, cache, day.n, () => new Resvg(cardSvg(day), { fitTo: { mode: "width", value: 1200 }, font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: "Newsreader" } }).render().asPng());
}

/** The runner itself as a square PNG, for the download links that work without JavaScript. Pixel art, so no smoothing. */
export const SQUARE_PX = 1024;
const squares = new Map<number, Uint8Array>();
export function squarePng(day: Day, immutable: boolean): Uint8Array {
  return remembered(`square${day.n}`, immutable, squares, day.n, () => new Resvg(runnerFor(day.epoch).svg, { fitTo: { mode: "width", value: SQUARE_PX }, imageRendering: 1 }).render().asPng());
}
