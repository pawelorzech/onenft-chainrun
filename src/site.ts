/**
 * Page HTML. One rule governs color: the page has no palette of its own.
 * It takes today's colors from the day's image, so it looks different every
 * day. There is no light or dark mode.
 *
 * Copy rules: plain words, active voice, no adverbs, no em dashes, nothing
 * a reader could misunderstand. Facts (numbers, addresses, paths) stay exact.
 */
import { runnerFor, summary, type Palette, type Runner } from "./runners.ts";
import { dayByNumber, secondsLeft, dateOf, type Day } from "./chain.ts";
import type { ChainState, ChainStatus } from "./contract.ts";

export type Names = Map<string, string>;
export const NO_NAMES: Names = new Map();

export const SITE = "chainrun.onenft.click";
export const NAME = "Chain Run";
export const PARENT = "onenft.click";
export const REPO = "https://github.com/pawelorzech/onenft-chainrun";
/** The Ethereum contracts the layers come from: the Chain Runners token and its on-chain renderer. */
export const RUNNERS = "0x97597002980134beA46250Aa0510C9B90d87A587";
export const RUNNERS_RENDERER = "0xfdac77881ff861ff76a83cc43a1be3c317c6a1cc";

export function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
/** The text for an owner: its ENS name when known, else the short address. Escaped; safe in text and attributes. */
export function label(a: string, names: Names): string {
  return esc(names.get(a.toLowerCase()) ?? shortAddr(a));
}
/** The holder page of an owner. Always the full address: the short form is text, not a route. */
export function holderHref(a: string): string {
  return `/${a}`;
}
/** An owner as a link to its holder page. */
export function ownerLink(a: string, names: Names): string {
  return `<a href="${holderHref(a)}">${label(a, names)}</a>`;
}
export function openseaCollection(chain: ChainState): string {
  return chain.chainId === 8453 ? "https://opensea.io/collection/chainrun-onenft-click" : `https://testnets.opensea.io/assets/base_sepolia/${chain.address}`;
}
export function opensea(chain: ChainState, id: number): string {
  return chain.chainId === 8453 ? `https://opensea.io/assets/base/${chain.address}/${id}` : `https://testnets.opensea.io/assets/base_sepolia/${chain.address}/${id}`;
}
export function explorer(chainId: number): string {
  return chainId === 8453 ? "https://basescan.org" : "https://sepolia.basescan.org";
}
export function chainName(chainId: number): string {
  return chainId === 8453 ? "Base" : "Base Sepolia";
}
export const num = (n: number | bigint) => n.toLocaleString("en-US");
export const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

function hex(c: string): [number, number, number] {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}
/** Color between a and b: t=0 gives a, t=1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hex(a), [br, bg, bb] = hex(b);
  const ch = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  return `#${ch(ar, br)}${ch(ag, bg)}${ch(ab, bb)}`;
}

/** WCAG relative luminance of a #rrggbb color. */
function luminance(c: string): number {
  const ch = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = hex(c).map((x) => ch(x / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** WCAG contrast ratio, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
/** WCAG AA for small text. */
export const MUTED_MIN_CONTRAST = 4.5;
/** WCAG AA for the border of a control and for large text. */
export const LINE_MIN_CONTRAST = 3;
/**
 * The muted text color: fg pulled toward bg, as far as the palette allows.
 * Small text needs 4.5:1 against the background, and the palettes differ a lot in
 * how much room they leave, so the pull is chosen per palette, not fixed.
 */
export function mutedFor(fg: string, bg: string): string {
  return pulled(fg, bg, 0.38, MUTED_MIN_CONTRAST);
}
/** The color of a control's border: a hairline is decoration, an input's edge is not, so it keeps 3:1. */
export function edgeFor(fg: string, bg: string): string {
  return pulled(fg, bg, 0.6, LINE_MIN_CONTRAST);
}
function pulled(fg: string, bg: string, from: number, min: number): string {
  for (let t = from; t > 0; t -= 0.01) {
    const c = mix(fg, bg, t);
    if (contrast(c, bg) >= min) return c;
  }
  return fg;
}
/**
 * The text color of the page: the day's cord color, pulled toward black or
 * white only as far as body text needs (4.5:1). The image keeps its own colors;
 * this is the page's ink, and it must stay readable on every day's ground.
 */
export function textFor(fg: string, bg: string): string {
  if (contrast(fg, bg) >= MUTED_MIN_CONTRAST) return fg;
  const ink = contrast("#000000", bg) >= contrast("#ffffff", bg) ? "#000000" : "#ffffff";
  for (let t = 0.05; t <= 1; t += 0.05) {
    const c = mix(fg, ink, t);
    if (contrast(c, bg) >= MUTED_MIN_CONTRAST) return c;
  }
  return ink;
}
/** The variables every page sets. Exported so tests can check every palette. */
export function cssVars(cord: string, bg: string): string {
  const fg = textFor(cord, bg);
  return `--bg:${bg};--fg:${fg};--muted:${mutedFor(fg, bg)};--edge:${edgeFor(fg, bg)};--line:${mix(fg, bg, 0.82)};--soft:${mix(fg, bg, 0.955)}`;
}

function css(p: Palette): string {
  const fg = p.cord, bg = p.bg;
  return `
:root{${cssVars(fg, bg)}}
*{box-sizing:border-box}
[hidden]{display:none!important}
html{background:var(--bg);color:var(--fg);font-family:"Newsreader",Georgia,serif;font-size:17px;line-height:1.5}
body{margin:0;min-height:100vh}
a{color:inherit}
a:focus-visible,button:focus-visible,input:focus-visible,summary:focus-visible{outline:3px solid var(--fg);outline-offset:3px}
.skip{position:absolute;left:-999px;top:8px;background:var(--fg);color:var(--bg);padding:8px 14px;font-weight:700;z-index:9}
.skip:focus{left:8px}
.syne{font-family:"Syne",system-ui,sans-serif}
.page{display:grid;grid-template-columns:360px minmax(0,1fr);min-height:100vh}
aside{border-right:1px solid var(--line);padding:38px 32px}
aside .stick{position:sticky;top:38px;display:flex;flex-direction:column;gap:28px}
.mark{font-weight:800;font-size:20px;letter-spacing:-.01em;text-decoration:none}
h1{font-weight:800;font-size:33px;line-height:.96;letter-spacing:-.045em;margin:0;overflow-wrap:normal;hyphens:manual}
.lead{color:var(--muted);margin:0}
hr{border:0;border-top:1px solid var(--line);margin:0;width:100%}
.big{font-weight:700;font-size:40px;line-height:1}
.small{font-size:15px;color:var(--muted)}
.cta{display:flex;align-items:center;justify-content:center;min-height:58px;padding:0 16px;background:var(--fg);color:var(--bg);text-decoration:none;font-weight:700;font-size:18px;text-align:center}
.cta.ghost{background:transparent;color:var(--fg);border:1px solid var(--fg)}
button.cta{border:0;cursor:pointer;width:100%;font-family:"Syne",system-ui,sans-serif}
button.cta[disabled]{opacity:.55;cursor:default}
.ctas{display:flex;flex-direction:column;gap:12px;max-width:396px}
.msg{font-size:15px;color:var(--muted);min-height:1.5em;margin:0}
.msg a{font-weight:700}
.note{padding:12px 16px;border:1px solid var(--edge);font-size:15px;color:var(--fg);margin:0;display:flex;gap:14px;align-items:center;flex-wrap:wrap}
.note button{font:inherit;font-weight:700;font-family:"Syne",system-ui,sans-serif;background:var(--fg);color:var(--bg);border:0;padding:8px 14px;cursor:pointer;min-height:44px}
.testnet{display:inline-block;padding:3px 8px;border:1px solid var(--line);font-size:13px;color:var(--muted)}
.today{padding:38px 34px 34px;border-bottom:1px solid var(--line);display:grid;grid-template-columns:minmax(0,396px) minmax(240px,1fr);gap:32px;align-items:start}
.today .knot{width:100%;max-width:396px;aspect-ratio:1;box-shadow:0 0 0 1px var(--line)}
.today .meta{display:flex;flex-direction:column;gap:18px;padding-top:6px}
.today .knot svg{display:block;width:100%;height:100%;image-rendering:pixelated}
.row img,.cal a img,.strip img,.strip svg,.single .knot svg,.tok img{image-rendering:pixelated}
.num{font-weight:800;font-size:62px;line-height:.95;letter-spacing:-.03em}
.state{font-size:19px;color:var(--muted);margin-top:8px}
.counts{display:flex;gap:34px;flex-wrap:wrap}
.counts b{display:block;font-weight:700;font-size:26px;line-height:1}
.row{display:flex;align-items:center;gap:22px;padding:0 34px;min-height:128px;border-bottom:1px solid var(--line);text-decoration:none}
.row:hover{background:var(--soft)}
.row.yours .n::after{content:" yours";font-size:14px;font-weight:400;color:var(--muted)}
.row.hole{background:repeating-linear-gradient(90deg,transparent 0 20px,var(--soft) 20px 40px);color:var(--muted)}
.row img,.row .ph{width:92px;height:92px;display:block;flex-shrink:0}
.row .n{font-weight:700;font-size:23px}
.format{padding:30px 34px;border-bottom:1px solid var(--line);background:var(--soft);display:flex;gap:26px;align-items:center}
.tiles{display:flex;gap:8px;flex-shrink:0;flex-wrap:wrap}
.tiles i{display:block;width:48px;height:48px;box-shadow:0 0 0 1px var(--line)}
footer{padding:26px 34px;display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap;color:var(--muted);font-size:16px}
footer nav,.nav{display:flex;gap:6px 20px;flex-wrap:wrap}
footer nav a,.nav a,.top nav a{display:inline-flex;align-items:center;min-height:44px}
.prose{max-width:640px;padding:38px 34px;display:flex;flex-direction:column;gap:22px}
.prose h2{font-weight:800;font-size:34px;line-height:1;letter-spacing:-.03em;margin:22px 0 0}
.prose p{margin:0}
.prose code{font-family:ui-monospace,Menlo,monospace;font-size:.92em}
.prose pre{margin:0;padding:18px;background:var(--soft);overflow-x:auto;font-size:14px;line-height:1.5}
.single{padding:38px 34px;display:flex;flex-direction:column;gap:22px;max-width:760px}
.single .knot{width:100%;max-width:640px;aspect-ratio:1;box-shadow:0 0 0 1px var(--line)}
.single .knot svg{display:block;width:100%;height:100%}
.top{display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap}
.top nav{display:flex;gap:4px 18px;flex-wrap:wrap;font-size:16px;color:var(--muted)}
.wide{padding:38px 34px;display:flex;flex-direction:column;gap:28px;max-width:1180px}
.wide h2{font-weight:800;font-size:34px;line-height:1;letter-spacing:-.03em;margin:0}
.wide h3{font-weight:700;font-size:20px;margin:0}
.wide p{margin:0}
.cal{max-width:900px;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:1px;background:var(--line);border:1px solid var(--line)}
.cal .dow{background:var(--bg);padding:6px 8px;font-size:13px;color:var(--muted)}
.cal a,.cal .blank,.cal .later{background:var(--bg);display:block;aspect-ratio:1;position:relative;text-decoration:none;overflow:hidden}
.cal a img{width:100%;height:100%;display:block}
.cal a span,.cal .later span{position:absolute;left:6px;top:4px;font-size:13px;font-weight:700;padding:0 4px;background:var(--bg)}
.cal a.hole{background:repeating-linear-gradient(135deg,var(--bg) 0 8px,var(--soft) 8px 16px)}
.cal a.hole span{background:transparent;color:var(--muted)}
.cal .later{color:var(--muted)}
.cal a:hover{outline:2px solid var(--fg);outline-offset:-2px;z-index:1}
.strip{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px}
.strip a{text-decoration:none}
.strip img,.strip svg{width:100%;aspect-ratio:1;display:block;box-shadow:0 0 0 1px var(--line)}
.strip .cap{font-size:14px;color:var(--muted);margin-top:6px}
table.tr{border-collapse:collapse;width:100%;max-width:640px;font-size:16px}
table.tr th,table.tr td{text-align:left;padding:8px 10px 8px 0;border-bottom:1px solid var(--line);vertical-align:top}
table.tr th{font-weight:400;color:var(--muted);font-size:14px}
table.tr td.n{text-align:right;font-family:"Syne",system-ui,sans-serif;font-weight:700;white-space:nowrap}
.scroll{overflow-x:auto}
.traits{display:grid;grid-template-columns:auto 1fr;gap:6px 18px;font-size:16px;max-width:420px}
.traits dt{color:var(--muted);margin:0}
.traits dd{margin:0}
.share{display:flex;gap:16px;flex-wrap:wrap;font-size:15px}
pre.snip{margin:0;padding:14px;background:var(--soft);overflow-x:auto;font-size:13px;line-height:1.5;font-family:ui-monospace,Menlo,monospace}
.crumb{margin:0}
.crumb ol{list-style:none;margin:0;padding:0;display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
.crumb li{display:flex;gap:10px;align-items:baseline}
.crumb a,.crumb span[aria-current]{display:inline-flex;align-items:center;min-height:44px}
.crumb .hub{color:var(--muted)}
.crumb .sep{color:var(--line);font-weight:800;font-size:20px}
.crumb span[aria-current]{color:var(--muted);font-size:16px}
@media (min-width:901px){
 aside .crumb ol,aside .crumb li{flex-direction:column;gap:2px;align-items:flex-start}
 aside .crumb .sep{display:none}
 aside .crumb a,aside .crumb span[aria-current]{min-height:0}
 aside .crumb .hub{font-size:15px;font-weight:700}
}
.sitenav{display:flex;gap:4px 22px;flex-wrap:wrap;padding:6px 34px;border-bottom:1px solid var(--line)}
.whobox{display:flex;flex-direction:column;gap:8px}
.wname{overflow-wrap:normal;word-break:keep-all}
.who{display:flex;gap:12px;flex-wrap:wrap;max-width:720px}
.who form{display:flex;flex-direction:column;gap:8px;flex:1;min-width:280px}
.who form .line{display:flex;gap:12px}
.who label{font-size:15px;color:var(--muted)}
.who .cta{min-height:50px;padding:0 22px;font-size:17px;width:auto}
.field{height:50px;padding:0 16px;border:1px solid var(--edge);background:transparent;color:var(--fg);flex:1;min-width:0;font-family:ui-monospace,Menlo,monospace;font-size:15px}
.field::placeholder{color:var(--muted)}
.tok{display:grid;grid-template-columns:256px minmax(0,1fr);gap:32px;padding:30px 0;border-top:1px solid var(--line)}
.tok img{width:256px;height:256px;display:block;box-shadow:0 0 0 1px var(--line)}
.tok .meta{display:flex;flex-direction:column;gap:14px}
.tok .num{font-size:44px}
.tok .since{font-size:14px;font-weight:400;color:var(--muted);letter-spacing:0;margin-left:10px;font-family:"Newsreader",Georgia,serif}
.dl{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:auto;padding-top:14px;border-top:1px solid var(--line)}
.dl .lab{color:var(--muted);font-size:15px;margin-right:6px}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 16px;border:1px solid var(--fg);color:var(--fg);text-decoration:none;font-weight:700;font-size:15px;font-family:"Syne",system-ui,sans-serif;background:transparent;cursor:pointer}
.btn[aria-busy="true"]{opacity:.6;cursor:progress}
.sizes{display:flex;border:1px solid var(--edge)}
.sizes button{padding:0 12px;min-height:44px;display:flex;align-items:center;font-size:14px;color:var(--muted);border:0;border-right:1px solid var(--line);background:transparent;font-family:"Syne",system-ui,sans-serif;cursor:pointer}
.sizes button:last-child{border-right:0}
.sizes button[aria-pressed="true"]{background:var(--soft);color:var(--fg);font-weight:700}
.top nav a,.nav a,.sitenav a,footer nav a,.links a,.cats a{font-family:"Syne",system-ui,sans-serif;font-weight:700;font-size:14px;letter-spacing:.01em;text-decoration:none;color:var(--muted)}
.top nav a:hover,.nav a:hover,.sitenav a:hover,footer nav a:hover,.links a:hover,.cats a:hover{color:var(--fg);text-decoration:underline;text-underline-offset:4px}
.top nav,.sitenav,footer nav,.links{gap:2px 24px}
@media (max-width:1180px){
 .today{grid-template-columns:1fr}
 .today .knot{max-width:460px}
 .today .meta{max-width:520px}
}
@media (max-width:900px){
 .page{grid-template-columns:1fr}
 aside{border-right:0;border-bottom:1px solid var(--line);padding:18px 20px}
 aside .stick{position:static;gap:16px}
 h1{font-size:38px}
 .today{padding:20px;gap:16px}
 .today .knot{max-width:100%}
 .num{font-size:44px}
 .row{min-height:64px;padding:14px 20px;gap:16px}
 .row img,.row .ph{width:56px;height:56px}
 .format{flex-direction:column;align-items:flex-start;padding:20px}
 .sitenav{padding:4px 20px}
 footer,.prose,.single,.wide{padding:20px}
 .cal a span{font-size:11px}
 .tok{grid-template-columns:1fr;gap:16px}
 .tok img{width:100%;height:auto}
 .who form{min-width:0;width:100%}
}
@media (max-width:360px){h1{font-size:29px}.mark{font-size:17px}}
@media (prefers-reduced-motion:no-preference){.row{transition:background .15s}}
`;
}

const UMAMI_URL = process.env.UMAMI_URL ?? "";
const UMAMI_WEBSITE_ID = process.env.UMAMI_WEBSITE_ID ?? "";
// Umami (self-hosted, cookieless) only when both env vars are set, so the test site stays out of the numbers.
const ANALYTICS = UMAMI_URL && UMAMI_WEBSITE_ID
  ? `<script defer src="${esc(UMAMI_URL)}/script.js" data-website-id="${esc(UMAMI_WEBSITE_ID)}"></script>`
  : "";
const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Newsreader:opsz,wght@6..72,400&display=swap">`;
const DESC = "One Chain Runner a day, drawn on chain from the clock of the Base chain with the CC0 Chain Runners layers.";
const OG_DESC = "One Chain Runner a day, drawn on chain from the clock of the Base chain.";

export function layout(title: string, p: Palette, body: string, image = "/today.png", path = "/", description?: string): string {
  const alt = title.replace(/ \| .*$/, "") + " on " + SITE;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description ?? DESC)}">
<meta name="theme-color" content="${p.bg}">
<link rel="icon" href="/today.svg" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="chainrun.onenft.click, one runner a day" href="/feed.xml">
<link rel="canonical" href="https://${SITE}${esc(path)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description ?? OG_DESC)}">
<meta property="og:image" content="https://${SITE}${esc(image)}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:url" content="https://${SITE}${esc(path)}">
<meta name="twitter:card" content="summary_large_image">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE}">
<meta property="og:locale" content="en_US">
<meta property="og:image:type" content="image/png">
<meta property="og:image:alt" content="${esc(alt)}">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description ?? OG_DESC)}">
<meta name="twitter:image" content="https://${SITE}${esc(image)}">
<meta name="twitter:image:alt" content="${esc(alt)}">
${FONTS}
${ANALYTICS}
<style>${css(p)}</style>
</head>
<body><a class="skip" href="#main">Skip to content</a>${body}</body>
</html>`;
}

/** Today's most used colors as swatches. */
export function swatches(k: Runner): string {
  return `<div class="tiles" aria-hidden="true">${k.palette.colors.map((c) => `<i style="background:${c}" title="${c}"></i>`).join("")}</div>`;
}

export function fmtLeft(s: number): string {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h === 0 ? `${m} min` : `${h} h ${m} min`;
}
export function stripSize(svg: string): string {
  return svg.replace(/ width="\d+" height="\d+"/, "");
}

/**
 * The countdown to midnight UTC. It counts from the clock, recomputes when the
 * tab comes back, and when the day turns it says so and offers a refresh. It
 * never reloads the page by itself: a reload would drop a transaction in flight.
 */
export const COUNTDOWN = `<script>
(function(){var el=document.querySelector('[data-left]');if(!el)return;var s=+el.getAttribute('data-left');var t0=Date.now();var told=false;
function f(x){var h=Math.floor(x/3600),m=Math.floor(x%3600/60);return h?h+' h '+m+' min':m+' min'}
function tick(){var r=s-Math.floor((Date.now()-t0)/1000);if(r<0){if(told)return;told=true;el.textContent='0 min';var n=document.getElementById('newday');if(n){n.hidden=false;n.querySelector('button').onclick=function(){location.reload()}}return}el.textContent=f(r)}
setInterval(tick,15000);document.addEventListener('visibilitychange',function(){if(!document.hidden)tick()});
})();
</script>`;
/** The notice the countdown reveals when the day turns. */
export const NEW_DAY = `<p class="note" id="newday" hidden role="status">A new UTC day has started. Refresh to see it. <button type="button">Refresh</button></p>`;

/**
 * Marks rows owned by the wallet already connected to this site. Never prompts.
 * Follows the wallet: when the account changes the marks move with it, and when
 * it disconnects they go.
 */
export const YOURS = `<script>
(function(){var eth=window.ethereum;if(!eth||!eth.request)return;
function mark(accs){var mine={};(accs||[]).forEach(function(a){mine[a.toLowerCase()]=1});var n=0;document.querySelectorAll('[data-owner]').forEach(function(el){var y=!!mine[el.getAttribute('data-owner')];el.classList.toggle('yours',y);if(y)n++});var box=document.getElementById('yours');if(box){box.hidden=!n;var c=box.querySelector('b');if(c)c.textContent=n}}
eth.request({method:'eth_accounts'}).then(mark).catch(function(){});
if(eth.on){eth.on('accountsChanged',mark);eth.on('disconnect',function(){mark([])})}
})();
</script>`;

/** The worn layers as a definition list, the way they sit in the token metadata. */
export function traitList(k: Runner): string {
  const rows: [string, string][] = k.layers.map(({ slot, layer }) => [k.traits.find((t) => t.value === layer.name)!.type.toLowerCase(), `<a href="/traits#s${slot}">${esc(layer.name)}</a>`]);
  return `<dl class="traits">${rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join("")}</dl>`;
}

/**
 * The breadcrumb: the hub, this collection, and on inner pages the page itself.
 * A real nav with a list, so a screen reader announces it as one, and the
 * current page is marked. The separators are decoration.
 */
export function crumb(current?: string): string {
  const here = current ? `<li><span class="sep syne" aria-hidden="true">/</span><span aria-current="page">${esc(current)}</span></li>` : "";
  return `<nav class="crumb" aria-label="Breadcrumb"><ol><li><a class="mark syne hub" href="https://${PARENT}">${PARENT}</a></li><li><span class="sep syne" aria-hidden="true">/</span><a class="mark syne" href="/"${current ? "" : ' aria-current="page"'}>${NAME}</a></li>${here}</ol></nav>`;
}

/** The site menu. One list of labels, used in the top bar, the sidebar and the footer. */
export const MENU: [string, string][] = [["/explore", "Explore"], ["/traits", "Traits"], ["/assets", "Assets"], ["/how", "How it works"], ["/yours", "Your wallet"]];
export function menu(extra: [string, string][] = []): string {
  return [...MENU, ...extra].map(([h, t]) => `<a href="${h}">${t}</a>`).join("");
}

/** Top bar for the inner pages: the breadcrumb and the site nav. */
export function topBar(current?: string): string {
  return `<div class="top">${crumb(current)}<nav aria-label="Site">${menu([[`https://${PARENT}`, "All collections"]])}</nav></div>`;
}

/** Pixel art wants hard edges when the browser rasterizes it. */
export const PIXEL = true;
/** Prefix of every downloaded file name. */
export const FILE_PREFIX = "chainrun";
export const SIZES = [1024, 2048, 4096];

/** "Collection status could not be refreshed. Showing data from 12:04 UTC." when the last good read is old. */
export function staleNote(status: ChainStatus | null | undefined): string {
  if (!status?.configured) return "";
  if (!status.known) return `<p class="note" role="status">Collection status is unavailable. The chain did not answer. Images and past days still show; ownership is unknown until it does.</p>`;
  if (!status.stale) return "";
  const when = new Date(status.readAt!).toISOString().slice(11, 16);
  return `<p class="note" role="status">Collection status could not be refreshed. Showing data from ${when} UTC.</p>`;
}

/**
 * Connect a wallet or type an address. The form works without JavaScript
 * through /go. When no wallet is injected the page says what to do instead of
 * failing on a click.
 */
export function whoBlock(chain: ChainState | null, status?: ChainStatus | null): string {
  const off = !chain && status?.configured;
  return `<div class="whobox"><div class="who">${chain ? `<button class="cta syne" id="connect" type="button">Connect wallet</button>` : ""}<form action="/go" method="get"><label for="who">Wallet address or ENS name</label><div class="line"><input class="field" id="who" name="who" placeholder="0x1234… or name.eth" autocomplete="off" spellcheck="false" required pattern="^\\s*(0x[0-9a-fA-F]{40}|[a-zA-Z0-9-]+(\\.[a-zA-Z0-9-]+)*\\.eth)\\s*$" title="A 42-character address starting with 0x, or an ENS name ending in .eth"><button class="cta ghost syne" type="submit">View wallet</button></div></form></div>
<p class="msg" id="msg" aria-live="polite">${off ? "The chain did not answer. Viewing a wallet needs it. Try again in a minute." : ""}</p>
<p class="small" id="last" hidden>Last time here: <a href="/">…</a>.</p></div>`;
}

/** The size picker for PNG and JPEG. One per page; the choice is kept in the browser. */
export function sizePicker(): string {
  return `<div class="dl" style="border:0;padding:0;margin:0"><span class="lab" id="sizelab">PNG and JPEG size</span><div class="sizes" role="group" aria-labelledby="sizelab">${SIZES.map((s) => `<button type="button" data-size="${s}" aria-pressed="${s === 2048}">${s}</button>`).join("")}</div></div>`;
}

/**
 * The download bar under one token. SVG is the file itself. PNG and JPEG are
 * drawn in the browser; without JavaScript PNG links to a 1024 pixel PNG the
 * server draws, and JPEG stays hidden, since the server cannot make one.
 */
export function downloadBar(n: number, bg: string, unit = "day"): string {
  const d = `data-id="${n}" data-unit="${unit}" data-src="/${unit}/${n}.svg" data-bg="${bg}"`;
  return `<div class="dl"><span class="lab">Download ${unit} ${n}</span><a class="btn" href="/${unit}/${n}.svg" download="${FILE_PREFIX}-${unit}-${n}.svg" aria-label="SVG of ${unit} ${n}">SVG</a><a class="btn" href="/${unit}/${n}-1024.png" download="${FILE_PREFIX}-${unit}-${n}-1024.png" data-dl="png" ${d} aria-label="PNG of ${unit} ${n}">PNG</a><a class="btn" href="/${unit}/${n}-1024.png" data-dl="jpeg" ${d} hidden data-js aria-label="JPEG of ${unit} ${n}">JPEG</a><noscript><span class="small">JPEG needs JavaScript; the PNG link saves a 1024 pixel PNG.</span></noscript></div>`;
}

/**
 * Connect button: asks the wallet for an account and opens that wallet's page.
 * `base` is the path the address is appended to ("/" here, "/wallet/" on the hub).
 * A wallet that already granted this site an account (eth_accounts, no prompt) is
 * recognized on load: the entry page goes straight to it, other pages show the
 * link. The last address is also kept in the browser for the "last time" link.
 * Account and network changes are followed; a disconnect clears the button.
 */
export function connectScript(base = "/", entry = false): string {
  return `<script>
(function(){
var BASE=${JSON.stringify(base)};var ENTRY=${entry ? "true" : "false"};var KEY='onenft_who';var btn=document.getElementById('connect');var out=document.getElementById('msg');var last=document.getElementById('last');
function say(t){if(out)out.textContent=t}
function here(a){return location.pathname.toLowerCase()===(BASE+a).toLowerCase()}
function remember(a){try{localStorage.setItem(KEY,a)}catch(e){}}
function offer(a,label){if(!last||here(a))return;var l=last.querySelector('a');l.href=BASE+a;l.textContent=a.slice(0,6)+'\\u2026'+a.slice(-4);last.firstChild.textContent=label+': ';last.hidden=false}
var who=null;try{who=localStorage.getItem(KEY)}catch(e){}
if(who&&/^0x[0-9a-fA-F]{40}$/.test(who))offer(who,'Last time here');
if(!btn)return;var eth=window.ethereum;
if(!eth||!eth.request){btn.disabled=true;btn.textContent='No wallet detected';say('No wallet detected. Enter a public address to browse, or open this site in your wallet\\u2019s browser to connect.');return}
function known(accs){if(!accs||!accs.length){btn.textContent='Connect wallet';btn.onclick=null;btn.disabled=false;return}var a=accs[0];remember(a);if(here(a)){btn.textContent='This is your wallet';btn.disabled=true;return}if(ENTRY){location.replace(BASE+a);return}btn.textContent='Your wallet';btn.disabled=false;btn.onclick=function(){location.href=BASE+a};offer(a,'Connected')}
eth.request({method:'eth_accounts'}).then(known).catch(function(){});
if(eth.on){eth.on('accountsChanged',known);eth.on('disconnect',function(){known([])})}
btn.addEventListener('click',async function(){if(btn.onclick)return;btn.disabled=true;
  try{var accs=await eth.request({method:'eth_requestAccounts'});if(!accs||!accs.length)throw new Error('the wallet gave no account');var acc=accs[0];remember(acc);location.href=BASE+acc}
  catch(e){say(e&&e.code===4001?'Cancelled in the wallet.':e&&e.code===-32002?'The wallet is already asking. Open it to answer.':'Failed: '+((e&&e.message)||e));btn.disabled=false}});
})();
</script>`;
}

/**
 * Downloads drawn in the browser. Fetches the SVG, sets its size to the pick,
 * draws it on a canvas and saves PNG or JPEG. JPEG has no alpha, so it gets the
 * day's background first. Pixel art turns smoothing off. data-dl="svg" saves the
 * fetched file as is, for pages on another origin than the image.
 * One drawing at a time: a 4096 canvas is 64 MB, and a double click must not
 * open two. Every step has a timeout; nothing is left half done.
 */
export function downloadScript(prefix = FILE_PREFIX, pixel = PIXEL): string {
  return `<script>
(function(){
var PREFIX=${JSON.stringify(prefix)};var PIXEL=${pixel ? "true" : "false"};var KEY='onenft_size';var SIZES=${JSON.stringify(SIZES)};
var size=2048;try{var s=+localStorage.getItem(KEY);if(SIZES.indexOf(s)>=0)size=s}catch(e){}
var out=document.getElementById('msg');function say(t){if(out)out.textContent=t}
var picks=document.querySelectorAll('.sizes button');
function paint(){picks.forEach(function(b){b.setAttribute('aria-pressed',String(+b.getAttribute('data-size')===size))})}
picks.forEach(function(b){b.addEventListener('click',function(){size=+b.getAttribute('data-size');try{localStorage.setItem(KEY,String(size))}catch(e){}paint()})});paint();
document.querySelectorAll('[data-js]').forEach(function(el){el.hidden=false});
function save(blob,name){var a=document.createElement('a');var u=URL.createObjectURL(blob);a.href=u;a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(u);a.remove()},10000)}
function timeout(ms,what){return new Promise(function(_,no){setTimeout(function(){no(new Error(what+' took too long'))},ms)})}
var busy=false;
document.querySelectorAll('[data-dl]').forEach(function(el){el.addEventListener('click',async function(ev){
  ev.preventDefault();if(busy){say('One download at a time. The other one is still drawing.');return}
  var kind=el.getAttribute('data-dl');var n=el.getAttribute('data-id')||el.getAttribute('data-day');var unit=el.getAttribute('data-unit')||'day';var prefix=el.getAttribute('data-prefix')||PREFIX;
  var pixel=el.hasAttribute('data-pixel')?el.getAttribute('data-pixel')==='1':PIXEL;var bg=el.getAttribute('data-bg')||'#000000';
  busy=true;var was=el.textContent;el.textContent='\\u2026';el.setAttribute('aria-busy','true');say('');var u=null;
  try{
    var ctl=new AbortController();var t=setTimeout(function(){ctl.abort()},20000);
    var res;try{res=await fetch(el.getAttribute('data-src'),{signal:ctl.signal})}finally{clearTimeout(t)}
    if(!res.ok)throw new Error('the image answered '+res.status);var text=await res.text();
    if(kind==='svg'){save(new Blob([text],{type:'image/svg+xml'}),prefix+'-'+unit+'-'+n+'.svg');return}
    text=text.replace(/ width="\\d+" height="\\d+"/,' width="'+size+'" height="'+size+'"');
    u=URL.createObjectURL(new Blob([text],{type:'image/svg+xml'}));var img=new Image();
    await Promise.race([new Promise(function(ok,no){img.onload=ok;img.onerror=function(){no(new Error('the browser could not draw the image'))};img.src=u}),timeout(20000,'drawing')]);
    if(img.decode){try{await img.decode()}catch(e){}}
    var c=document.createElement('canvas');c.width=size;c.height=size;var ctx=c.getContext('2d');if(!ctx)throw new Error('the browser gave no canvas');ctx.imageSmoothingEnabled=!pixel;
    if(kind==='jpeg'){ctx.fillStyle=bg;ctx.fillRect(0,0,size,size)}
    ctx.drawImage(img,0,0,size,size);
    var blob=await Promise.race([new Promise(function(ok){c.toBlob(ok,kind==='jpeg'?'image/jpeg':'image/png',0.92)}),timeout(30000,'encoding')]);
    if(!blob)throw new Error('the browser gave no file, try a smaller size');
    save(blob,prefix+'-'+unit+'-'+n+'-'+size+(kind==='jpeg'?'.jpg':'.png'));c.width=c.height=1;
  }catch(e){say('Download failed: '+((e&&e.name==='AbortError')?'the image took too long':((e&&e.message)||e)))}
  finally{if(u)URL.revokeObjectURL(u);el.textContent=was;el.removeAttribute('aria-busy');busy=false}
})});
})();
</script>`;
}

/** "4 min after midnight UTC" for a claim block time. */
export function afterMidnight(at: number, dayStart: bigint): string {
  const s = at - Number(dayStart);
  if (s < 60) return `${s} s after midnight UTC`;
  if (s < 3600) return `${Math.floor(s / 60)} min after midnight UTC`;
  return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min after midnight UTC`;
}

export function isAuthor(chain: ChainState, a?: string): boolean {
  return Boolean(a) && a!.toLowerCase() === chain.author.toLowerCase();
}

/**
 * The claim button. One transaction, and every state it can be in is shown:
 * wallet confirmation, sent (with a link), confirmed, rejected, unknown. A hash
 * is kept in the browser for this chain, contract, day and account, so a
 * refresh or a return to the tab picks the wait back up instead of asking for
 * a second transaction. A timeout is an unknown outcome, never a retry.
 */
function mintScript(chain: ChainState, day: number): string {
  const cfg = JSON.stringify({
    address: chain.address,
    chainHex: "0x" + chain.chainId.toString(16),
    name: chainName(chain.chainId),
    rpc: chain.chainId === 8453 ? "https://mainnet.base.org" : "https://sepolia.base.org",
    explorer: explorer(chain.chainId),
    day,
  });
  return `<script>
(function(){
var CFG=${cfg};var btn=document.getElementById('mint');var out=document.getElementById('msg');var check=document.getElementById('check');
function say(t){out.textContent=t}
function link(h){return ' <a href="'+CFG.explorer+'/tx/'+h+'" target="_blank" rel="noopener">View transaction</a>'}
function show(t,h){out.textContent=t;if(h)out.insertAdjacentHTML('beforeend',link(h))}
function sleep(ms){return new Promise(function(r){setTimeout(r,ms)})}
function key(a){return 'onenft_claim:'+CFG.chainHex+':'+CFG.address.toLowerCase()+':'+CFG.day+':'+a.toLowerCase()}
function keep(a,h){try{localStorage.setItem(key(a),h)}catch(e){}}
function kept(a){try{return localStorage.getItem(key(a))}catch(e){return null}}
function drop(a){try{localStorage.removeItem(key(a))}catch(e){}}
var eth=window.ethereum;
var account=null;
async function wait(hash,from){
  for(var i=0;i<45;i++){
    var r=null;try{r=await eth.request({method:'eth_getTransactionReceipt',params:[hash]})}catch(e){}
    if(r){drop(from);if(r.status==='0x1'){show('The day is yours. Reloading.',hash);await sleep(1500);location.reload()}else{show('The network rejected the transaction. Someone may have been faster, or the day turned.',hash);btn.disabled=false}return true}
    if(document.hidden){await sleep(4000)}else{await sleep(2000)}
  }
  show('We cannot confirm the transaction yet. Check its status before trying again.',hash);check.hidden=false;check.onclick=function(){check.hidden=true;show('Checking.',hash);wait(hash,from)};
  return false;
}
async function resume(){
  if(!eth||!eth.request)return;
  try{var accs=await eth.request({method:'eth_accounts'});if(!accs||!accs.length)return;account=accs[0];var h=kept(account);if(h){btn.disabled=true;show('Transaction sent. Waiting for confirmation.',h);wait(h,account)}}catch(e){}
}
if(eth&&eth.on){eth.on('accountsChanged',function(accs){if(!accs||!accs.length||(account&&accs[0].toLowerCase()!==account.toLowerCase())){account=accs&&accs[0]||null;if(!btn.disabled)return;btn.disabled=false;say('The wallet account changed. The claim above belongs to the previous account.')}});
  eth.on('chainChanged',function(id){if(parseInt(id,16)===parseInt(CFG.chainHex,16))return;say('The wallet switched network. Switch back to '+CFG.name+' to claim.')})}
btn.addEventListener('click',async function(){
  if(!eth||!eth.request){say('No wallet detected. Open this site in your wallet\\u2019s browser, or install one like Rabby, MetaMask or Coinbase Wallet.');return}
  btn.disabled=true;
  try{
    var accs=await eth.request({method:'eth_requestAccounts'});if(!accs||!accs.length)throw new Error('the wallet gave no account');var from=accs[0];account=from;
    var h=kept(from);if(h){show('A claim from this wallet is already waiting.',h);await wait(h,from);return}
    try{await eth.request({method:'wallet_switchEthereumChain',params:[{chainId:CFG.chainHex}]})}
    catch(e){if(e&&e.code===4902){await eth.request({method:'wallet_addEthereumChain',params:[{chainId:CFG.chainHex,chainName:CFG.name,rpcUrls:[CFG.rpc],nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},blockExplorerUrls:[CFG.explorer]}]})}else{throw e}}
    say('Confirm in your wallet. 0 ETH mint fee. You pay network gas.');
    var hash=await eth.request({method:'eth_sendTransaction',params:[{from:from,to:CFG.address,data:'0x4e71d92d'}]});
    keep(from,hash);show('Transaction sent. Waiting for confirmation.',hash);
    await wait(hash,from);
  }catch(e){say(e&&e.code===4001?'Cancelled in the wallet.':e&&e.code===-32002?'The wallet is already asking. Open it to answer.':'Failed: '+((e&&e.message)||e));btn.disabled=false}
});
resume();
})();
</script>`;
}

/** The five states a day can be in, as one word for the page and the API. */
export type DayState = "available" | "claimed" | "author" | "gap" | "unknown";
export function dayState(n: number, today: number, chain: ChainState | null, status?: ChainStatus | null): DayState {
  if (!chain) return status?.configured ? "unknown" : n % 10 === 0 && n <= 1000 ? "author" : "available";
  const o = chain.owners.get(n);
  if (o) return isAuthor(chain, o) ? "author" : "claimed";
  if (n < today) return "gap";
  return n % 10 === 0 && n <= 1000 ? "author" : "available";
}
export const STATE_TEXT: Record<DayState, string> = { available: "Available today", claimed: "Claimed", author: "Reserved for the author", gap: "Unclaimed day", unknown: "Status unavailable" };

/**
 * The home page. The sidebar carries the name, the title and one sentence; the
 * knot of the day comes next in the page, then its state and the claim, then
 * the counts and the days before. On a phone that order is what you see.
 */
export function homePage(today: Day, now: bigint, chain: ChainState | null = null, names: Names = NO_NAMES, status: ChainStatus | null = null): string {
  const k = runnerFor(today.epoch);
  // The clock, never a cached chain read: a stale read would count down to a midnight that has passed.
  const left = secondsLeft(now);

  const rows: string[] = [];
  for (let n = today.n - 1; n >= Math.max(1, today.n - 60); n--) {
    const d = dayByNumber(n)!;
    const st = dayState(n, today.n, chain, status);
    if (st === "gap") {
      rows.push(`<a class="row hole" href="/day/${n}"><span class="ph"></span><span><span class="n syne">${n}</span><br><span class="small">unclaimed day, it can no longer be minted</span></span></a>`);
      continue;
    }
    const kk = runnerFor(d.epoch);
    const owner = chain?.owners.get(n);
    const who = owner ? (isAuthor(chain!, owner) ? "the author's" : `held by ${label(owner, names)}`) : st === "unknown" ? "status unavailable" : esc(summary(kk));
    rows.push(`<a class="row" href="/day/${n}"${owner ? ` data-owner="${owner.toLowerCase()}"` : ""}><img src="/day/${n}.svg" alt="" loading="lazy" width="92" height="92"><span><span class="n syne">${n}</span><br><span class="small">${who}</span></span></a>`);
  }
  const older = today.n - 61 > 0 ? `<a class="row" href="/day/${today.n - 61}"><span class="small">earlier days</span></a>` : "";

  const taken = chain ? chain.owners.size : 0;
  const gaps = chain ? Math.max(0, today.n - 1 - [...chain.owners.keys()].filter((n) => n < today.n).length) : 0;
  const todayOwner = chain?.owners.get(today.n);
  const st = dayState(today.n, today.n, chain, status);
  const badge = chain && chain.chainId !== 8453 ? ` <span class="testnet">${chainName(chain.chainId)} testnet</span>` : "";

  let stateText: string = STATE_TEXT[st];
  let cta = "";
  if (!chain) {
    cta = `<a class="cta syne" href="/day/${today.n}-1024.png" download="${FILE_PREFIX}-day-${today.n}-1024.png">Download today's runner</a>
<a class="cta ghost syne" href="/how">How it works</a>
<p class="small">${status?.configured ? "Claiming needs the chain, and the chain did not answer. Try again in a minute." : "Claiming on-chain opens today."}</p>`;
  } else if (todayOwner) {
    stateText = isAuthor(chain, todayOwner) ? "Reserved for the author" : `Claimed, held by ${label(todayOwner, names)}`;
    cta = `<button class="cta syne" disabled>Day ${today.n} is claimed</button>
<a class="cta ghost syne" href="/how">How it works</a>
<p class="small">The next one runs tomorrow. ${fmtLeft(left)} left.${badge}</p>`;
  } else if (st === "author") {
    cta = `<button class="cta syne" disabled>Every tenth day goes to the author</button>
<a class="cta ghost syne" href="/how">How it works</a>
<p class="small">Written into the contract from day one, up to day 1000. Tomorrow is open again.${badge}</p>`;
  } else {
    cta = `<button class="cta syne" id="mint">Claim today's runner</button>
<p class="msg" id="msg" aria-live="polite"></p>
<button class="cta ghost syne" id="check" type="button" hidden>Check status</button>
<a class="cta ghost syne" href="/how">How it works</a>
<p class="small">0 ETH mint fee. You pay network gas. ${fmtLeft(left)} left today.${badge}</p>`;
  }

  const counts = `<div class="counts syne"><div><b>${today.n}</b><span class="small">${plural(today.n, "day run", "days run")}</span></div>${chain
    ? `<div><b>${taken}</b><span class="small">${plural(taken, "day claimed", "days claimed")}</span></div><div><b>${gaps}</b><span class="small">${plural(gaps, "gap", "gaps")}</span></div><div id="yours" hidden><b>0</b><span class="small">yours</span></div>`
    : ""}</div>`;

  const body = `<div class="page">
<aside><div class="stick">
${crumb()}
<h1 class="syne">One<br>runner<br>a day</h1>
<p class="lead">One Chain Runner a day, drawn from the day number by a contract on Base with the 338 CC0 layers and the weight tables of the 2021 original.</p>
</div></aside>
<main id="main">
${staleNote(status)}
${NEW_DAY}
<section class="today" aria-labelledby="today-h">
<div class="knot">${stripSize(k.svg)}</div>
<div class="meta">
<div${todayOwner ? ` data-owner="${todayOwner.toLowerCase()}"` : ""}><h2 class="num syne" id="today-h" style="margin:0">${today.n}</h2><div class="state">${stateText}</div></div>
<p class="lead" style="max-width:330px">Day ${today.n}, ${dateOf(today.epoch)} UTC. The day number alone determines this runner. The next day starts in <span data-left="${left}">${fmtLeft(left)}</span>.</p>
<div class="ctas">
${cta}
</div>
${counts}
<hr>
${traitList(k)}
<p class="small" style="line-height:1.7">The image and its rules live in the contract. This site only shows them.${chain ? `<br>Contract <a href="${explorer(chain.chainId)}/address/${chain.address}">${shortAddr(chain.address)}</a> on ${chainName(chain.chainId)}. A claimed day keeps its image forever${chain.rendererLocked ? ", and the drawing rules are locked for good" : "; the drawing rules can still change for days not yet claimed"}. <a href="${openseaCollection(chain)}">Collection on OpenSea</a>.` : ""}</p>
${today.n === 1 ? `<p class="small">This is day one. Tomorrow a second row appears under it, and so on, with no end.</p>` : ""}
</div>
</section>
<nav class="sitenav small" aria-label="Site">${menu([["/feed.xml", "RSS"]])}</nav>
<section class="format">${swatches(k)}<p style="max-width:520px;margin:0">Every runner is 32 by 32 pixels, up to 13 layers composited with alpha. Today: a <strong>${esc(k.race)}</strong> on <strong>${esc(k.traitMap["Background"])}</strong>, ${k.layers.length} layers. <a href="/how">See how the machine works</a></p></section>
${rows.join("\n")}
${older}
<footer><span>This is not an investment and never will be. Images are CC0, like the layers they come from. One of the collections at <a href="https://${PARENT}">${PARENT}</a>.</span><nav aria-label="Footer">${menu([[`https://${PARENT}`, "All collections"]])}${chain ? `<a href="${openseaCollection(chain)}">OpenSea</a><a href="${explorer(chain.chainId)}/address/${chain.address}">Basescan</a>` : ""}<a href="/feed.xml">RSS</a><a href="/calendar.ics">Calendar</a><a href="${REPO}">Code</a></nav></footer>
</main>
</div>
${chain && st === "available" ? mintScript(chain, today.n) : ""}
${chain ? YOURS : ""}
${COUNTDOWN}`;
  return layout(`Day ${today.n} | ${SITE}`, k.palette, body, `/day/${today.n}.png`, "/");
}

export function dayPage(d: Day, today: Day, chain: ChainState | null = null, names: Names = NO_NAMES, status: ChainStatus | null = null): string {
  const k = runnerFor(d.epoch);
  const prev = d.n > 1 ? `<a href="/day/${d.n - 1}">previous</a>` : "";
  const next = d.n < today.n ? `<a href="/day/${d.n + 1}">next</a>` : "";
  const st = dayState(d.n, today.n, chain, status);
  let state = d.n === today.n ? "today" : `day ${d.n} of ${today.n}`;
  let came = "";
  if (chain) {
    const o = chain.owners.get(d.n);
    if (o) state += isAuthor(chain, o) ? ", the author's" : `, held by ${ownerLink(o, names)}`;
    else state += st === "gap" ? ", unclaimed" : ", available";
    const c = chain.claims.get(d.n);
    if (c) came = `<p class="small">Claimed ${afterMidnight(c.at, d.startsAt)}${o && c.to.toLowerCase() !== o.toLowerCase() ? ` by ${ownerLink(c.to, names)}` : ""}, <a href="${explorer(chain.chainId)}/tx/${c.tx}">transaction</a>.</p>`;
  } else if (status?.configured) {
    state += ", status unavailable";
  }
  if (st === "gap") came += `<p class="small">This day ended without a claim. It can no longer be minted.</p>`;
  const url = `https://${SITE}/day/${d.n}`;
  const text = encodeURIComponent(`Day ${d.n} of ${SITE}`);
  const share = `<nav class="share" aria-label="Share"><a href="https://warpcast.com/~/compose?text=${text}&embeds[]=${encodeURIComponent(url)}">Share on Farcaster</a><a href="https://x.com/intent/post?text=${text}&url=${encodeURIComponent(url)}">Share on X</a><a href="/api/day/${d.n}">JSON</a></nav>`;
  const snippet = esc(`<a href="${url}"><img src="https://${SITE}/day/${d.n}.svg" width="256" height="256" alt="Day ${d.n} of ${SITE}"></a>`);
  const body = `<main class="single" id="main">
${topBar(`Day ${d.n}`)}
${staleNote(status)}
<div class="knot">${stripSize(k.svg)}</div>
<div><h2 class="num syne" style="margin:0">${d.n}</h2><p class="lead">${state}</p></div>
${came}
${traitList(k)}
<p class="small" style="line-height:1.7">${dateOf(d.epoch)}, UTC${chain ? `<br>Token ${d.n} of <a href="${explorer(chain.chainId)}/address/${chain.address}">${shortAddr(chain.address)}</a> on ${chainName(chain.chainId)}. The image lives in the contract.` : ""}</p>
<nav class="nav" aria-label="Days">${prev}${next}<a href="/">all days</a><a href="/explore">calendar</a></nav>
<nav class="nav small" aria-label="Links">${chain && chain.owners.has(d.n) ? `<a href="${opensea(chain, d.n)}">OpenSea</a><a href="${explorer(chain.chainId)}/nft/${chain.address}/${d.n}">Basescan</a>` : ""}<a href="/day/${d.n}.svg" download="${FILE_PREFIX}-day-${d.n}.svg">SVG</a><a href="/day/${d.n}-1024.png" download="${FILE_PREFIX}-day-${d.n}-1024.png">PNG</a><a href="/day/${d.n}.png">Link card</a></nav>
${share}
<details><summary class="small">Put this runner on your page</summary><pre class="snip">${snippet}</pre><p class="small">CC0. No credit needed.</p></details>
</main>`;
  return layout(`Day ${d.n} | ${SITE}`, k.palette, body, `/day/${d.n}.png`, `/day/${d.n}`, `Day ${d.n} of ${SITE}, ${dateOf(d.epoch)} UTC: ${summary(k)}. ${STATE_TEXT[st]}.`);
}

export function esc(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function howPage(today: Day): string {
  const k = runnerFor(today.epoch);
  const body = `<main class="prose" id="main">
${topBar("How it works")}
<h2 class="syne">From one number to one runner</h2>
<p>The only input is the clock of the Base chain: the timestamp of the current block. Nobody sets it and nobody can roll it back.</p>
<p><strong>A day</strong> is that timestamp divided by 86,400, rounded down. That gives one calendar day in UTC, with the boundary at midnight UTC. The number itself counts days since 1 January 1970; day one of this project is day number 20701.</p>
<p><strong>The layers</strong> are the 338 pieces Chain Runners drew on Ethereum in 2021 and released as CC0: 44 backgrounds, 15 races, faces, mouths, noses, eyes and seven kinds of accessory, 13 slots in all. Each is 32 by 32 pixels in eight colors with alpha, 416 bytes. The contract on Base holds all 338 byte for byte as they sit in the Ethereum renderer, along with its weight tables. The original picked each runner's DNA off chain; here the day number is the DNA.</p>
<p><strong>The draw</strong> is thirteen numbers from 0 to 9,999, one per slot, out of splitmix64 seeded with the day. The race number decides which of three weight tables applies: human and alien, skull, or bot. Each slot's number walks its table; the item whose range holds it is worn, and a range past the last item means the slot stays empty. The original's rules apply unchanged: a mask hides the face, eye and mouth accessories; a face accessory hides the face and mouth accessory; a hat above the hair shows only on odd first draws.</p>
<p><strong>The image</strong> composites the worn layers bottom to top with the original's blend: a semi-transparent pixel mixes once with the first opaque pixel below it. The result is one SVG, one rect per horizontal run of one color, a few kilobytes. The contract returns it as a <code>data:</code> URI, with no server in between. This page takes its colors from today's runner. Today: a ${esc(k.race)} on ${esc(k.traitMap["Background"])}. <a href="/traits">See every layer and how often it has come up.</a></p>
${swatches(k)}
<p><strong>The traits</strong> in the token are the worn layers, one attribute per slot, named as the Ethereum renderer names them.</p>
<h2 class="syne">Claiming a day</h2>
<p>Each UTC day one token can be minted, with the day number as its id. The first wallet to call <code>claim()</code> that day gets it. There is no mint fee; you pay the network gas of one transaction. Every tenth day up to day 1000 mints to the author instead, whoever calls. A day nobody claims stays empty forever; it can no longer be minted once the day has ended. Nothing mints by itself at midnight: the runner exists as a rule, and a claim is what turns it into a token.</p>
<h2 class="syne">Build it yourself</h2>
<p>The same day number gives the same runner every time, ten years from now and with this page switched off. The generator is in <a href="${REPO}">the repository</a>, in TypeScript and in Solidity, with a test that keeps the two byte for byte equal, and a second test that renders six Ethereum Chain Runners from their DNA and matches the original pixel for pixel. The draw is below; the layers, names and weight tables are in <a href="/spec.json">spec.json</a>.</p>
<pre><code>u64 mix(u64 x):
  x += 0x9e3779b97f4a7c15
  x = (x ^ (x >> 30)) * 0xbf58476d1ce4e5b9
  x = (x ^ (x >> 27)) * 0x94d049bb133111eb
  return x ^ (x >> 31)

seed = mix(day)
for i in 0..12: dna[i] = mix(seed + i) mod 10000

race = table(WEIGHTS[0][1], dna[1])      # item 1 bot, items 12.. skull, else human or alien
for slot in 0..12:
  item = walk(WEIGHTS[race][slot], dna[slot])
  wear layers[slot][item] if it exists and the mask, face accessory and hat rules allow
pixel = blend(worn layers, top down)</code></pre>
<p>Everything here is CC0, like the layers. If you build it, write to me. That is the one thing I am waiting for here.</p>
<p class="small"><a href="/">Back to today</a>. Every collection: <a href="https://${PARENT}">${PARENT}</a>.</p>
</main>`;
  return layout(`How it works | ${SITE}`, k.palette, body, "/today.png", "/how");
}

export function beforeStart(seconds: number, dayOne: Day): string {
  const k = runnerFor(dayOne.epoch);
  const body = `<main class="single" id="main">
${crumb()}
<h2 class="syne" style="font-size:52px;line-height:.9;letter-spacing:-.035em;margin:0">The first day<br>runs in <span data-left="${seconds}">${fmtLeft(seconds)}</span></h2>
<p class="lead" style="max-width:520px">At midnight UTC on ${dateOf(dayOne.epoch)} the first runner appears. This page already wears its colors, because you can compute the draw ahead of time.</p>
<p class="small">From that day on, one runner a day, with no end. <a href="/how">How it works</a></p>
${NEW_DAY}
</main>
${COUNTDOWN}`;
  return layout(`Before day one | ${SITE}`, k.palette, body);
}

export function notFound(today: Day, why?: string): string {
  const k = runnerFor(today.epoch);
  return layout(`Not found | ${SITE}`, k.palette, `<main class="single" id="main">${topBar("Not found")}<h2 class="syne" style="font-size:34px;margin:0">Not found</h2><p class="lead">${why ? esc(why) : `Today is day ${today.n}. Earlier days run from 1 to ${today.n}. Later ones do not exist yet.`}</p><a href="/">Back to today</a></main>`, "/today.png", "/");
}

/** Pages that need the chain (holder pages) when the chain did not answer. */
export function chainDown(today: Day, why = "This page lists a wallet's days, and that needs the chain. Try again in a minute."): string {
  const k = runnerFor(today.epoch);
  return layout(`The chain did not answer | ${SITE}`, k.palette, `<main class="single" id="main">${topBar("Unavailable")}<h2 class="syne" style="font-size:34px;margin:0">The chain did not answer</h2><p class="lead">${esc(why)}</p><a href="/">Back to today</a></main>`, "/today.png", "/");
}

export function feedXml(today: Day, chain: ChainState | null): string {
  const items: string[] = [];
  for (let n = today.n; n >= Math.max(1, today.n - 30); n--) {
    const d = dayByNumber(n)!;
    const k = runnerFor(d.epoch);
    const owner = chain?.owners.get(n);
    const state = !chain ? "" : owner ? (isAuthor(chain, owner) ? " The author's." : ` Held by ${shortAddr(owner)}.`) : (n < today.n ? " Unclaimed; it can no longer be minted." : " Available today.");
    const date = new Date(Number(d.startsAt) * 1000).toUTCString();
    items.push(`<item><title>Day ${n}</title><link>https://${SITE}/day/${n}</link><guid isPermaLink="true">https://${SITE}/day/${n}</guid><pubDate>${date}</pubDate><description>&lt;img src="https://${SITE}/day/${n}.png" alt=""&gt;&lt;p&gt;Day ${n}, ${dateOf(d.epoch)} UTC: ${esc(summary(k))}.${esc(state)}&lt;/p&gt;</description><enclosure url="https://${SITE}/day/${n}.png" type="image/png" length="0"/></item>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>${SITE}</title><link>https://${SITE}/</link><description>One Chain Runner a day, drawn on chain from the clock of the Base chain.</description><language>en</language>
${items.join("\n")}
</channel></rss>`;
}

/** A wallet name or address in a heading: smaller when long, and it may break only before a dot. */
export function nameHeading(name: string): string {
  const size = name.length <= 11 ? "" : name.length <= 16 ? ' style="font-size:26px"' : ' style="font-size:20px;letter-spacing:-.02em"';
  return `<span class="wname"${size}>${esc(name).replace(/\./g, "<wbr>.")}</span>`;
}

/** Where /go?who=... sends a typed address or ENS name. Anything else goes back to the form with a reason. */
export function goTarget(who: string | null, base = "/", back = "/yours"): string {
  const w = (who ?? "").trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(w) || /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.eth$/i.test(w)) return base + w;
  return `${back}?bad=${encodeURIComponent(w.slice(0, 80))}`;
}
