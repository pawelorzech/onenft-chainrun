import { test, expect } from "bun:test";
import { COLUMN, fitLine, fitSize, textWidth } from "./cardtext.ts";
import { cardSvg } from "./image.ts";
import { SAMPLE } from "./cardtext.sample.ts";

test("the wordmark shrinks to the column and never grows", () => {
  for (const w of ["knot.onenft.click", "blit.onenft.click", "chainrun.onenft.click", "faces.onenft.click"]) {
    const s = fitSize(w, "Syne", 44, 800);
    expect(s).toBeLessThanOrEqual(44);
    expect(textWidth(w, "Syne", s, 800)).toBeLessThanOrEqual(COLUMN);
  }
  expect(fitSize("Day", "Newsreader", 40, 400)).toBe(40);
});

test("a long trait line shrinks a little, then loses items from the end, and always fits", () => {
  const line = "Human: Thick Curled Mustache Black, Lipstick Red, Glasses Round Black, Earrings Cyan";
  const f = fitLine(line, "Newsreader", 30, 400);
  expect(f.size).toBeGreaterThanOrEqual(24);
  expect(line.startsWith(f.text)).toBe(true);
  expect(textWidth(f.text, "Newsreader", f.size)).toBeLessThanOrEqual(COLUMN);
  const short = fitLine("tar, 8 by 8, passes, no symmetry", "Newsreader", 30, 400);
  expect(short).toEqual({ text: "tar, 8 by 8, passes, no symmetry", size: 30 });
  const one = fitLine("x".repeat(200), "Newsreader", 30, 400);
  expect(one.text.endsWith("…")).toBe(true);
  expect(textWidth(one.text, "Newsreader", one.size)).toBeLessThanOrEqual(COLUMN);
});

test("every text on a real card stays inside the right column", () => {
  const svg = cardSvg(...SAMPLE);
  const texts = [...svg.matchAll(/<text x="(\d+)" [^>]*font-family="([^"]+)"(?: font-weight="(\d+)")? font-size="([\d.]+)"[^>]*>([^<]*)<\/text>/g)];
  expect(texts.length).toBeGreaterThanOrEqual(5);
  for (const [, x, family, weight, size, text] of texts) {
    const w = textWidth(text!.replace(/&amp;/g, "&").replace(/&lt;/g, "<"), family!, Number(size), Number(weight ?? 400));
    expect(Number(x) + w).toBeLessThanOrEqual(1200 - 30 + 1);
  }
});
