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
  const hit = cache.get(day.n);
  if (hit) return hit;
  const png = new Resvg(cardSvg(day), { fitTo: { mode: "width", value: 1200 }, font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: "Newsreader" } }).render().asPng();
  if (immutable) cache.set(day.n, png);
  return png;
}
