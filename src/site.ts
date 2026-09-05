/**
 * Page HTML. One rule governs color: the page has no palette of its own.
 * It takes today's runner's colors, so it looks different every day. There
 * is no light or dark mode.
 *
 * Copy rules: plain words, active voice, no adverbs, no em dashes, nothing
 * a reader could misunderstand. Facts (numbers, addresses, paths) stay exact.
 */
import { runnerFor, summary, type Palette, type Runner } from "./runners.ts";
import { dayByNumber, secondsLeft, dateOf, type Day } from "./chain.ts";
import type { ChainState } from "./contract.ts";

export type Names = Map<string, string>;
export const NO_NAMES: Names = new Map();

export const SITE = "chainrun.onenft.click";
export const REPO = "https://github.com/pawelorzech/onenft-chainrun";
export const PARENT = "onenft.click";
/** The Ethereum contracts the layers come from: the Chain Runners token and its on-chain renderer. */
export const RUNNERS = "0x97597002980134beA46250Aa0510C9B90d87A587";
export const RUNNERS_RENDERER = "0xfdac77881ff861ff76a83cc43a1be3c317c6a1cc";

export function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
export function label(a: string, names: Names): string {
  return names.get(a.toLowerCase()) ?? shortAddr(a);
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

function css(p: Palette): string {
  const fg = p.cord, bg = p.bg;
  return `
:root{--bg:${bg};--fg:${fg};--muted:${mix(fg, bg, 0.38)};--line:${mix(fg, bg, 0.82)};--soft:${mix(fg, bg, 0.955)}}
*{box-sizing:border-box}
html{background:var(--bg);color:var(--fg);font-family:"Newsreader",Georgia,serif;font-size:17px;line-height:1.5}
body{margin:0;min-height:100vh}
a{color:inherit}
a:focus-visible,button:focus-visible{outline:3px solid var(--fg);outline-offset:3px}
.syne{font-family:"Syne",system-ui,sans-serif}
.page{display:grid;grid-template-columns:360px minmax(0,1fr);min-height:100vh}
aside{border-right:1px solid var(--line);padding:38px 32px}
aside .stick{position:sticky;top:38px;display:flex;flex-direction:column;gap:28px}
.mark{font-weight:800;font-size:20px;letter-spacing:-.01em;text-decoration:none}
h1{font-weight:800;font-size:33px;line-height:.96;letter-spacing:-.045em;margin:0;overflow-wrap:anywhere}
.lead{color:var(--muted);margin:0}
hr{border:0;border-top:1px solid var(--line);margin:0;width:100%}
.big{font-weight:700;font-size:40px;line-height:1}
.small{font-size:15px;color:var(--muted)}
.cta{display:flex;align-items:center;justify-content:center;height:58px;background:var(--fg);color:var(--bg);text-decoration:none;font-weight:700;font-size:18px}
.cta.ghost{background:transparent;color:var(--fg);border:1px solid var(--fg)}
button.cta{border:0;cursor:pointer;width:100%;font-family:"Syne",system-ui,sans-serif}
button.cta[disabled]{opacity:.55;cursor:default}
.msg{font-size:15px;color:var(--muted);min-height:1.5em;margin:0}
.testnet{display:inline-block;padding:3px 8px;border:1px solid var(--line);font-size:13px;color:var(--muted)}
.today{padding:38px 34px 34px;border-bottom:1px solid var(--line);display:grid;grid-template-columns:minmax(0,396px) minmax(240px,1fr);gap:32px;align-items:start}
.today .knot{width:100%;max-width:396px;aspect-ratio:1;box-shadow:0 0 0 1px var(--line)}
.today .meta{display:flex;flex-direction:column;gap:18px;padding-top:6px}
.today .knot svg{display:block;width:100%;height:100%;image-rendering:pixelated}
.row img,.cal a img,.strip img,.strip svg,.single .knot svg{image-rendering:pixelated}
.num{font-weight:800;font-size:62px;line-height:.95;letter-spacing:-.03em}
.row{display:flex;align-items:center;gap:22px;padding:0 34px;height:128px;border-bottom:1px solid var(--line);text-decoration:none}
.row:hover{background:var(--soft)}
.row.yours .n::after{content:" yours";font-size:14px;font-weight:400;color:var(--muted)}
.row.hole{background:repeating-linear-gradient(90deg,transparent 0 20px,var(--soft) 20px 40px);color:var(--muted)}
.row img,.row .ph{width:92px;height:92px;display:block;flex-shrink:0}
.row .n{font-weight:700;font-size:23px}
.format{padding:30px 34px;border-bottom:1px solid var(--line);background:var(--soft);display:flex;gap:26px;align-items:center}
.tiles{display:flex;gap:8px;flex-shrink:0}
.tiles{flex-wrap:wrap}
.tiles i{display:block;width:48px;height:48px;box-shadow:0 0 0 1px var(--line)}
footer{padding:26px 34px;display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap;color:var(--muted);font-size:16px}
footer nav{display:flex;gap:20px;flex-wrap:wrap}
.prose{max-width:640px;padding:38px 34px;display:flex;flex-direction:column;gap:22px}
.prose h2{font-weight:800;font-size:34px;line-height:1;letter-spacing:-.03em;margin:22px 0 0}
.prose p{margin:0}
.prose code{font-family:ui-monospace,Menlo,monospace;font-size:.92em}
.prose pre{margin:0;padding:18px;background:var(--soft);overflow-x:auto;font-size:14px;line-height:1.5}
.single{padding:38px 34px;display:flex;flex-direction:column;gap:22px;max-width:760px}
.single .knot{width:100%;max-width:640px;aspect-ratio:1;box-shadow:0 0 0 1px var(--line)}
.single .knot svg{display:block;width:100%;height:100%}
.nav{display:flex;gap:22px;flex-wrap:wrap}
.top{display:flex;justify-content:space-between;align-items:baseline;gap:20px;flex-wrap:wrap}
.top nav{display:flex;gap:18px;flex-wrap:wrap;font-size:16px;color:var(--muted)}
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
.traits{display:grid;grid-template-columns:auto 1fr;gap:6px 18px;font-size:16px;max-width:420px}
.traits dt{color:var(--muted);margin:0}
.traits dd{margin:0}
.share{display:flex;gap:16px;flex-wrap:wrap;font-size:15px}
pre.snip{margin:0;padding:14px;background:var(--soft);overflow-x:auto;font-size:13px;line-height:1.5;font-family:ui-monospace,Menlo,monospace}
@media (max-width:1180px){
 .today{grid-template-columns:1fr}
 .today .knot{max-width:460px}
 .today .meta{max-width:520px}
}
@media (max-width:900px){
 .page{grid-template-columns:1fr}
 aside{border-right:0;border-bottom:1px solid var(--line);padding:18px 20px}
 aside .stick{position:static;gap:18px}
 h1{font-size:40px}
 .today{padding:20px;gap:16px}
 .today .knot{max-width:100%}
 .num{font-size:44px}
 .row{height:auto;min-height:64px;padding:14px 20px;gap:16px}
 .row img,.row .ph{width:56px;height:56px}
 .format{flex-direction:column;align-items:flex-start;padding:20px}
 footer,.prose,.single,.wide{padding:20px}
 .cal a span{font-size:11px}
}
@media (prefers-reduced-motion:no-preference){.row{transition:background .15s}}
`;
}

const UMAMI_URL = process.env.UMAMI_URL ?? "";
const UMAMI_WEBSITE_ID = process.env.UMAMI_WEBSITE_ID ?? "";
// Umami (self-hosted, cookieless) only when both env vars are set, so the test site stays out of the numbers.
const ANALYTICS = UMAMI_URL && UMAMI_WEBSITE_ID
  ? `<script defer src="${UMAMI_URL}/script.js" data-website-id="${UMAMI_WEBSITE_ID}"></script>`
  : "";
const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Newsreader:opsz,wght@6..72,400&display=swap">`;

export function layout(title: string, p: Palette, body: string, image = "/today.png", path = "/"): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="One Chain Runner a day, drawn on chain from the clock of the Base chain with the CC0 Chain Runners layers.">
<meta name="theme-color" content="${p.bg}">
<link rel="icon" href="/today.svg" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="chainrun.onenft.click, one runner a day" href="/feed.xml">
<link rel="canonical" href="https://${SITE}${path}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="One Chain Runner a day, drawn on chain from the clock of the Base chain.">
<meta property="og:image" content="https://${SITE}${image}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:url" content="https://${SITE}${path}">
<meta name="twitter:card" content="summary_large_image">
${FONTS}
${ANALYTICS}
<style>${css(p)}</style>
</head>
<body>${body}</body>
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
const COUNTDOWN = `<script>
(function(){var el=document.querySelector('[data-left]');if(!el)return;var s=+el.getAttribute('data-left');var t0=Date.now();function f(x){var h=Math.floor(x/3600),m=Math.floor(x%3600/60);return h?h+' h '+m+' min':m+' min'}setInterval(function(){var r=s-Math.floor((Date.now()-t0)/1000);if(r<0){location.reload();return}el.textContent=f(r)},15000)})();
</script>`;

/** Marks rows owned by the wallet already connected to this site. Never prompts. */
const YOURS = `<script>
(function(){var eth=window.ethereum;if(!eth||!eth.request)return;eth.request({method:'eth_accounts'}).then(function(accs){if(!accs||!accs.length)return;var mine={};accs.forEach(function(a){mine[a.toLowerCase()]=1});var n=0;document.querySelectorAll('[data-owner]').forEach(function(el){if(mine[el.getAttribute('data-owner')]){el.classList.add('yours');n++}});var box=document.getElementById('yours');if(box&&n){box.hidden=false;box.querySelector('.syne').textContent=n}}).catch(function(){})})();
</script>`;

/** The worn layers as a definition list, the way they sit in the token metadata. */
export function traitList(k: Runner): string {
  const rows: [string, string][] = k.layers.map(({ slot, layer }) => [k.traits.find((t) => t.value === layer.name)!.type.toLowerCase(), `<a href="/traits#s${slot}">${esc(layer.name)}</a>`]);
  return `<dl class="traits">${rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join("")}</dl>`;
}

/** Top bar for the inner pages: the mark and the site nav. */
export function topBar(): string {
  return `<div class="top"><a class="mark syne" href="/">${SITE}</a><nav><a href="/explore">Explore</a><a href="/traits">Traits</a><a href="/assets">Assets</a><a href="/how">How it works</a></nav></div>`;
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

function mintScript(chain: ChainState): string {
  const cfg = JSON.stringify({
    address: chain.address,
    chainHex: "0x" + chain.chainId.toString(16),
    name: chainName(chain.chainId),
    rpc: chain.chainId === 8453 ? "https://mainnet.base.org" : "https://sepolia.base.org",
    explorer: explorer(chain.chainId),
  });
  return `<script>
(function(){
var CFG=${cfg};var btn=document.getElementById('mint');var out=document.getElementById('msg');
function say(t){out.textContent=t}
function sleep(ms){return new Promise(function(r){setTimeout(r,ms)})}
btn.addEventListener('click',async function(){
  var eth=window.ethereum;
  if(!eth){say('You need a wallet in your browser, like Rabby, MetaMask or Coinbase Wallet.');return}
  btn.disabled=true;
  try{
    var accs=await eth.request({method:'eth_requestAccounts'});var from=accs[0];
    try{await eth.request({method:'wallet_switchEthereumChain',params:[{chainId:CFG.chainHex}]})}
    catch(e){if(e&&e.code===4902){await eth.request({method:'wallet_addEthereumChain',params:[{chainId:CFG.chainHex,chainName:CFG.name,rpcUrls:[CFG.rpc],nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},blockExplorerUrls:[CFG.explorer]}]})}else{throw e}}
    say('Confirm in your wallet. You pay gas, nothing else.');
    var hash=await eth.request({method:'eth_sendTransaction',params:[{from:from,to:CFG.address,data:'0x4e71d92d'}]});
    say('Sent. Waiting for the network.');
    for(var i=0;i<90;i++){await sleep(2000);var r=await eth.request({method:'eth_getTransactionReceipt',params:[hash]});
      if(r){if(r.status==='0x1'){say('The day is yours.');await sleep(1200);location.reload()}else{say('The network rejected it. Someone may have been faster.');btn.disabled=false}return}}
    say('Still waiting. Refresh the page in a moment.');
  }catch(e){say(e&&e.code===4001?'Cancelled in the wallet.':'Failed: '+((e&&e.message)||e));btn.disabled=false}
});
})();
</script>`;
}

export function homePage(today: Day, now: bigint, chain: ChainState | null = null, names: Names = NO_NAMES): string {
  const k = runnerFor(today.epoch);
  const left = chain ? chain.secondsLeft : secondsLeft(now);

  const rows: string[] = [];
  for (let n = today.n - 1; n >= Math.max(1, today.n - 60); n--) {
    const d = dayByNumber(n)!;
    if (chain && !chain.owners.has(n)) {
      rows.push(`<a class="row hole" href="/day/${n}"><span class="ph"></span><span><span class="n syne">${n}</span><br><span class="small">nobody came, the gap stays</span></span></a>`);
      continue;
    }
    const owner = chain?.owners.get(n);
    const kk = runnerFor(d.epoch);
    const who = owner ? (isAuthor(chain!, owner) ? "the author's" : `taken by ${label(owner, names)}`) : esc(summary(kk));
    rows.push(`<a class="row" href="/day/${n}"${owner ? ` data-owner="${owner.toLowerCase()}"` : ""}><img src="/day/${n}.svg" alt="" loading="lazy" width="92" height="92"><span><span class="n syne">${n}</span><br><span class="small">${who}</span></span></a>`);
  }
  const older = today.n - 61 > 0 ? `<a class="row" href="/day/${today.n - 61}"><span class="small">earlier days</span></a>` : "";

  const taken = chain ? chain.owners.size : 0;
  const gaps = chain ? Math.max(0, today.n - 1 - [...chain.owners.keys()].filter((n) => n < today.n).length) : 0;
  const todayOwner = chain?.owners.get(today.n);
  const authorDay = today.n % 10 === 0 && today.n <= 1000;

  let todayState = "today";
  let cta = `<a class="cta syne" href="/day/${today.n}.svg" download="chainrun-day-${today.n}.svg">Download today's runner</a>
<a class="cta ghost syne" href="/how">How it works</a>
<p class="small">Claiming on-chain opens today.</p>`;
  if (chain) {
    const badge = chain.chainId === 8453 ? "" : ` <span class="testnet">${chainName(chain.chainId)} testnet</span>`;
    if (todayOwner) {
      todayState = isAuthor(chain, todayOwner) ? "today, the author's" : `today, taken by ${label(todayOwner, names)}`;
      cta = `<button class="cta syne" disabled>Day ${today.n} is taken</button>
<a class="cta ghost syne" href="/how">How it works</a>
<a class="small" href="${openseaCollection(chain)}">Collection on OpenSea</a>
<p class="small">The next one runs tomorrow. ${fmtLeft(left)} left.${badge}</p>`;
    } else if (authorDay) {
      todayState = "today, the author's day";
      cta = `<button class="cta syne" disabled>Every tenth day goes to the author</button>
<a class="cta ghost syne" href="/how">How it works</a>
<p class="small">Written into the contract from day one, up to day 1000. Tomorrow is yours again.${badge}</p>`;
    } else {
      todayState = "today, still nobody's";
      cta = `<button class="cta syne" id="mint">Claim today's runner</button>
<p class="msg" id="msg" aria-live="polite"></p>
<a class="cta ghost syne" href="/how">How it works</a>
<a class="small" href="${openseaCollection(chain)}">Collection on OpenSea</a>
<p class="small">Free. You pay gas, nothing else. ${fmtLeft(left)} left.${badge}</p>`;
    }
  }

  const body = `<div class="page">
<aside><div class="stick">
<a class="mark syne" href="/">${SITE}</a>
<h1 class="syne">One<br>runner<br>a day</h1>
<p class="lead">Every day at midnight UTC the contract draws one Chain Runner from the day number: 338 layers in 13 slots, the weight tables and rules of the 2021 Ethereum original, released CC0. Nobody picks the traits. The clock does.</p>
<hr>
<div><div class="big syne">${today.n}</div><div class="small">${plural(today.n, "day run", "days run")}</div></div>
${chain ? `<div style="display:flex;gap:34px"><div><div class="syne" style="font-weight:700;font-size:26px;line-height:1">${taken}</div><div class="small">taken</div></div><div><div class="syne" style="font-weight:700;font-size:26px;line-height:1">${gaps}</div><div class="small">${plural(gaps, "gap", "gaps")}</div></div><div id="yours" hidden><div class="syne" style="font-weight:700;font-size:26px;line-height:1">0</div><div class="small">yours</div></div></div>` : ""}
<div style="display:flex;flex-direction:column;gap:12px">
${cta}
</div>
<nav class="nav small"><a href="/explore">Explore</a><a href="/traits">Traits</a><a href="/assets">Assets</a><a href="/feed.xml">RSS</a></nav>
</div></aside>
<main>
<section class="today">
<div class="knot">${stripSize(k.svg)}</div>
<div class="meta">
<div${todayOwner ? ` data-owner="${todayOwner.toLowerCase()}"` : ""}><div class="num syne">${today.n}</div><div class="lead" style="margin-top:8px;font-size:19px">${todayState}</div></div>
<p class="lead" style="max-width:330px">The contract drew this runner at midnight UTC, ${dateOf(today.epoch)}. It draws the next one in <span data-left="${left}">${fmtLeft(left)}</span>.</p>
<hr>
${traitList(k)}
<p class="small" style="line-height:1.7">The image lives in the contract, not on a server.${chain ? `<br>Contract <a href="${explorer(chain.chainId)}/address/${chain.address}">${shortAddr(chain.address)}</a> on ${chainName(chain.chainId)}. A claimed day keeps its image forever${chain.rendererLocked ? ", and the drawing rules are locked for good" : "; the drawing rules can still change for days not yet claimed"}.` : ""}</p>
${today.n === 1 ? `<p class="small">This is day one. Tomorrow a second row appears under it, and so on, with no end.</p>` : ""}
</div>
</section>
<section class="format">${swatches(k)}<p style="max-width:520px;margin:0">Every runner is 32 by 32 pixels, up to 13 layers composited with alpha. Today: a <strong>${esc(k.race)}</strong> on <strong>${esc(k.traitMap["Background"])}</strong>, ${k.layers.length} layers. <a href="/how">See how the machine works</a></p></section>
${rows.join("\n")}
${older}
<footer><span>This is not an investment and never will be. Images are CC0, like the layers they come from. One of the daily collections at <a href="https://${PARENT}">${PARENT}</a>.</span><nav><a href="/explore">Explore</a><a href="/traits">Traits</a><a href="/assets">Assets</a>${chain ? `<a href="${openseaCollection(chain)}">OpenSea</a><a href="${explorer(chain.chainId)}/address/${chain.address}">Basescan</a>` : ""}<a href="/feed.xml">RSS</a><a href="/calendar.ics">Calendar</a><a href="${REPO}">Code</a></nav></footer>
</main>
</div>
${chain && !todayOwner && !authorDay ? mintScript(chain) : ""}
${chain ? YOURS : ""}
${COUNTDOWN}`;
  return layout(`Day ${today.n} | ${SITE}`, k.palette, body, `/day/${today.n}.png`, "/");
}

export function dayPage(d: Day, today: Day, chain: ChainState | null = null, names: Names = NO_NAMES): string {
  const k = runnerFor(d.epoch);
  const prev = d.n > 1 ? `<a href="/day/${d.n - 1}">previous</a>` : "";
  const next = d.n < today.n ? `<a href="/day/${d.n + 1}">next</a>` : "";
  let state = d.n === today.n ? "today" : `day ${d.n} of ${today.n}`;
  let came = "";
  if (chain) {
    const o = chain.owners.get(d.n);
    if (o) state += isAuthor(chain, o) ? ", the author's" : `, taken by <a href="/${label(o, names)}">${label(o, names)}</a>`;
    else state += d.n < today.n ? ", nobody came" : ", still nobody's";
    const c = chain.claims.get(d.n);
    if (c) came = `<p class="small">Claimed ${afterMidnight(c.at, d.startsAt)}, <a href="${explorer(chain.chainId)}/tx/${c.tx}">transaction</a>.</p>`;
  }
  const url = `https://${SITE}/day/${d.n}`;
  const text = encodeURIComponent(`Day ${d.n} of ${SITE}`);
  const share = `<nav class="share"><a href="https://warpcast.com/~/compose?text=${text}&embeds[]=${encodeURIComponent(url)}">Share on Farcaster</a><a href="https://x.com/intent/post?text=${text}&url=${encodeURIComponent(url)}">Share on X</a><a href="/api/day/${d.n}">JSON</a></nav>`;
  const snippet = esc(`<a href="${url}"><img src="https://${SITE}/day/${d.n}.svg" width="256" height="256" alt="Day ${d.n} of chainrun.onenft.click"></a>`);
  const body = `<main class="single">
${topBar()}
<div class="knot">${stripSize(k.svg)}</div>
<div><div class="num syne">${d.n}</div><p class="lead">${state}</p></div>
${came}
${traitList(k)}
<p class="small" style="line-height:1.7">${dateOf(d.epoch)}, UTC${chain ? `<br>Token ${d.n} of <a href="${explorer(chain.chainId)}/address/${chain.address}">${shortAddr(chain.address)}</a> on ${chainName(chain.chainId)}. The image lives in the contract.` : ""}</p>
<nav class="nav">${prev}${next}<a href="/">today</a><a href="/explore">calendar</a></nav>
<nav class="nav small">${chain && chain.owners.has(d.n) ? `<a href="${opensea(chain, d.n)}">OpenSea</a><a href="${explorer(chain.chainId)}/nft/${chain.address}/${d.n}">Basescan</a>` : ""}<a href="/day/${d.n}.svg" download="chainrun-day-${d.n}.svg">SVG</a><a href="/day/${d.n}.png">PNG</a></nav>
${share}
<details><summary class="small">Put this runner on your page</summary><pre class="snip">${snippet}</pre><p class="small">CC0. No credit needed.</p></details>
</main>`;
  return layout(`Day ${d.n} | ${SITE}`, k.palette, body, `/day/${d.n}.png`, `/day/${d.n}`);
}

export function esc(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function howPage(today: Day): string {
  const k = runnerFor(today.epoch);
  const body = `<main class="prose">
${topBar()}
<h2 class="syne">From one number to one runner</h2>
<p>The only input is the clock of the Base chain: the timestamp of the current block. Nobody sets it and nobody can roll it back.</p>
<p><strong>A day</strong> is that timestamp divided by 86,400, rounded down. That gives one calendar day in UTC, with the boundary at midnight UTC. The number itself counts days since 1 January 1970; day one of this project is day number 20701.</p>
<p><strong>The layers</strong> are the 338 pieces Chain Runners drew on Ethereum in 2021 and released as CC0: 44 backgrounds, 15 races, faces, mouths, noses, eyes and seven kinds of accessory, 13 slots in all. Each is 32 by 32 pixels in eight colors with alpha, 416 bytes. The contract on Base holds all 338 byte for byte as they sit in the Ethereum renderer, along with its weight tables. The original picked each runner's DNA off chain; here the day number is the DNA.</p>
<p><strong>The draw</strong> is thirteen numbers from 0 to 9,999, one per slot, out of splitmix64 seeded with the day. The race number decides which of three weight tables applies: human and alien, skull, or bot. Each slot's number walks its table; the item whose range holds it is worn, and a range past the last item means the slot stays empty. The original's rules apply unchanged: a mask hides the face, eye and mouth accessories; a face accessory hides the face and mouth accessory; a hat above the hair shows only on odd first draws.</p>
<p><strong>The image</strong> composites the worn layers bottom to top with the original's blend: a semi-transparent pixel mixes once with the first opaque pixel below it. The result is one SVG, one rect per horizontal run of one color, a few kilobytes. The contract returns it as a <code>data:</code> URI, with no server in between. This page takes its colors from today's runner. Today: a ${esc(k.race)} on ${esc(k.traitMap["Background"])}. <a href="/traits">See every layer and how often it has come up.</a></p>
${swatches(k)}
<p><strong>The traits</strong> in the token are the worn layers, one attribute per slot, named as the Ethereum renderer names them.</p>
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
<p class="small"><a href="/">Back to today</a>. Every daily collection, including the knot: <a href="https://${PARENT}">${PARENT}</a>.</p>
</main>`;
  return layout(`How it works | ${SITE}`, k.palette, body, "/today.png", "/how");
}

export function beforeStart(seconds: number, dayOne: Day): string {
  const k = runnerFor(dayOne.epoch);
  const body = `<main class="single">
<a class="mark syne" href="/">${SITE}</a>
<h2 class="syne" style="font-size:52px;line-height:.9;letter-spacing:-.035em;margin:0">The first day<br>runs in <span data-left="${seconds}">${fmtLeft(seconds)}</span></h2>
<p class="lead" style="max-width:520px">At midnight UTC on ${dateOf(dayOne.epoch)} the first runner appears. This page already wears its colors, because you can compute the draw ahead of time.</p>
<p class="small">From that day on, one runner a day, with no end. <a href="/how">How it works</a></p>
</main>
${COUNTDOWN}`;
  return layout(`Before day one | ${SITE}`, k.palette, body);
}

export function notFound(today: Day): string {
  const k = runnerFor(today.epoch);
  return layout(`No such day | ${SITE}`, k.palette, `<main class="single">${topBar()}<h2 class="syne" style="font-size:34px;margin:0">No such day</h2><p class="lead">Today is day ${today.n}. Earlier days run from 1 to ${today.n}. Later ones do not exist yet.</p><a href="/">Back to today</a></main>`);
}

export function feedXml(today: Day, chain: ChainState | null): string {
  const items: string[] = [];
  for (let n = today.n; n >= Math.max(1, today.n - 30); n--) {
    const d = dayByNumber(n)!;
    const k = runnerFor(d.epoch);
    const owner = chain?.owners.get(n);
    const state = !chain ? "" : owner ? (isAuthor(chain, owner) ? " The author's." : ` Taken by ${shortAddr(owner)}.`) : (n < today.n ? " Nobody came; the gap stays." : " Still nobody's.");
    const date = new Date(Number(d.startsAt) * 1000).toUTCString();
    items.push(`<item><title>Day ${n}</title><link>https://${SITE}/day/${n}</link><guid isPermaLink="true">https://${SITE}/day/${n}</guid><pubDate>${date}</pubDate><description>&lt;img src="https://${SITE}/day/${n}.png" alt=""&gt;&lt;p&gt;Day ${n}, ${dateOf(d.epoch)} UTC: ${esc(summary(k))}.${state}&lt;/p&gt;</description><enclosure url="https://${SITE}/day/${n}.png" type="image/png" length="0"/></item>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>chainrun.onenft.click</title><link>https://${SITE}/</link><description>One Chain Runner a day, drawn on chain from the clock of the Base chain.</description><language>en</language>
${items.join("\n")}
</channel></rss>`;
}
