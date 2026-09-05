import { renderDay, toDataUri } from "./runners.ts";

const from = Number(process.argv[2] ?? "1");
const count = Number(process.argv[3] ?? 1);

for (let i = 0; i < count; i++) {
  const r = renderDay(from + i, 0n);
  const file = `out/day-${from + i}.svg`;
  await Bun.write(file, r.svg);
  console.log(`${file}  ${r.traits.map((t) => t.value).join(", ")}  ${r.svg.length} B  dataURI ${toDataUri(r.svg).length} B`);
}
