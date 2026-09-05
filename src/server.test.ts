/**
 * The server as a process, against an RPC that is dead, one that hangs, and
 * none at all. What must hold: the process starts, liveness and images answer
 * at once, ownership reads as unknown (never as gaps or zeros), holder pages
 * say 503, and a hung RPC costs a page at most the deadline.
 */
import { expect, test, afterAll } from "bun:test";

const CONTRACT = "0x1111111111111111111111111111111111111111";
let port = 34000 + Math.floor(Math.random() * 1000);
const procs: ReturnType<typeof Bun.spawn>[] = [];

async function boot(env: Record<string, string>): Promise<string> {
  const p = String(port++);
  const proc = Bun.spawn(["bun", "run", "src/server.ts"], { env: { ...process.env, PORT: p, START_EPOCH: "20701", CHAIN_DEADLINE_MS: "400", ...env }, stdout: "pipe", stderr: "pipe" });
  procs.push(proc);
  const base = `http://127.0.0.1:${p}`;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`${base}/health`);
      if (r.ok) return base;
    } catch {}
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("server did not start");
}
afterAll(() => { for (const p of procs) p.kill(); });

/** An RPC that accepts the connection and never answers. */
function hungRpc(): { url: string; stop: () => void; hits: () => number } {
  let n = 0;
  const srv = Bun.serve({ port: 0, fetch: () => { n++; return new Promise<Response>(() => {}); } });
  return { url: `http://127.0.0.1:${srv.port}`, stop: () => srv.stop(true), hits: () => n };
}

test("dead RPC: the process boots, liveness and images answer, ownership is unknown, holder pages say 503", async () => {
  const base = await boot({ CONTRACT_ADDRESS: CONTRACT, CHAIN_ID: "84532", BASE_RPC_URL: "http://127.0.0.1:9" });
  const t0 = Date.now();
  const health = await fetch(`${base}/health`);
  expect(health.status).toBe(200);
  expect(await health.text()).toStartWith("ok, day");
  expect((await fetch(`${base}/today.svg`)).status).toBe(200);
  expect((await fetch(`${base}/day/1.svg`)).headers.get("content-type")).toContain("image/svg+xml");
  expect((await fetch(`${base}/day/1-1024.png`)).headers.get("content-type")).toBe("image/png");
  expect((await fetch(`${base}/spec.json`)).status).toBe(200);
  expect(Date.now() - t0).toBeLessThan(1500);

  const ready = await fetch(`${base}/ready`);
  expect(ready.status).toBe(503);
  const rj = await ready.json();
  expect(rj.ok).toBe(false);
  expect(rj.chain.configured).toBe(true);
  expect(rj.chain.known).toBe(false);
  expect(JSON.stringify(rj)).not.toContain("127.0.0.1:9");

  const home = await (await fetch(`${base}/`)).text();
  expect(home).toContain("Status unavailable");
  expect(home).toContain("Collection status is unavailable");
  expect(home).not.toContain('class="row hole"');
  expect(home).not.toContain("unclaimed day");
  expect(home).not.toContain('id="mint"');

  const today = await (await fetch(`${base}/api/today`)).json();
  expect(today.state).toBe("unknown");
  expect(today.chain.known).toBe(false);
  expect(today.owner).toBeNull();
  const summary = await (await fetch(`${base}/api/summary`)).json();
  expect(summary.tally).toBeNull();
  expect(summary.today.state).toBe("unknown");
  const days = await (await fetch(`${base}/api/days`)).json();
  expect(days.days.every((d: any) => d.state === "unknown")).toBe(true);

  const holder = await fetch(`${base}/0x2222222222222222222222222222222222222222`);
  expect(holder.status).toBe(503);
  expect(await holder.text()).toContain("The chain did not answer");
  const hj = await fetch(`${base}/api/holder/0x2222222222222222222222222222222222222222`);
  expect(hj.status).toBe(503);
  expect(hj.headers.get("content-type")).toContain("application/json");
  expect((await hj.json()).error).toBe("the chain did not answer");

  expect((await fetch(`${base}/nope`)).status).toBe(404);
  const apiNope = await fetch(`${base}/api/nope`);
  expect(apiNope.status).toBe(404);
  expect(apiNope.headers.get("content-type")).toContain("application/json");
  expect((await fetch(`${base}/api/day/999999`)).status).toBe(404);
  const go = await fetch(`${base}/go?who=junk`, { redirect: "manual" });
  expect(go.status).toBe(302);
  expect(go.headers.get("location")).toBe("/yours?bad=junk");
});

test("hung RPC: a page costs at most the deadline, twenty concurrent requests share one read, static paths do not wait at all", async () => {
  const rpc = hungRpc();
  try {
    const base = await boot({ CONTRACT_ADDRESS: CONTRACT, CHAIN_ID: "84532", BASE_RPC_URL: rpc.url, CHAIN_DEADLINE_MS: "300", RPC_TIMEOUT_MS: "60000" });
    let t0 = Date.now();
    expect((await fetch(`${base}/day/1.svg`)).status).toBe(200);
    expect((await fetch(`${base}/health`)).status).toBe(200);
    expect(Date.now() - t0).toBeLessThan(200);
    t0 = Date.now();
    const pages = await Promise.all(Array.from({ length: 20 }, () => fetch(`${base}/`)));
    const took = Date.now() - t0;
    expect(pages.every((r) => r.status === 200)).toBe(true);
    expect(took).toBeLessThan(1500);
    // One read in flight for the whole burst: the boot read plus at most one more, never twenty.
    expect(rpc.hits()).toBeLessThanOrEqual(2);
    expect(await pages[0].text()).toContain("Status unavailable");
  } finally {
    rpc.stop();
  }
});

test("no contract: a plain renderer, ready, claiming 'opens today'", async () => {
  const base = await boot({});
  expect((await fetch(`${base}/ready`)).status).toBe(200);
  const home = await (await fetch(`${base}/`)).text();
  expect(home).toContain("opens today");
  expect(home).not.toContain("Status unavailable");
  expect((await fetch(`${base}/0x2222222222222222222222222222222222222222`)).status).toBe(404);
  const r = await fetch(`${base}/`);
  expect(r.headers.get("x-frame-options")).toBe("SAMEORIGIN");
  expect(r.headers.get("x-content-type-options")).toBe("nosniff");
});
