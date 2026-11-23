import fs from "node:fs";

import type { Row } from "@/lib/emotion";


/** Config */
const FILE = "src/data/emotion.json";
const SQRT = 0.70710678;
const TILT = 0.15;
const MIDL = {
  v: 0.35355339,
  a: 0.35355339,
  d: 0.50000000
};


/** Emotion position with its ID. */
type Pos = Row["pos"] & { id: number };


/** Radius of the first family seen. */
const seen = new Map<string, number>();


/** Returns a number in fixed-width form. */
function fix(n: number): string {
  return n.toFixed(8).padStart(11);
}


/** Returns a list of IDs in fixed-width form. */
function ids(list: number[]): string {
  return `[${list.map((id) => String(id).padStart(2)).join(", ")}]`;
}


/** Returns whether an emotion-pos sits at (v, a, d). */
function at(pos: Pos, v: number, a: number, d: number): boolean {
  return Math.hypot(pos.v - v, pos.a - a, pos.d - d) < 1e-6;
}


/** Returns the intensities column: the tier below and above (or itself). */
function intensities(pos: Pos, all: Pos[]): string {
  const tiers = all.filter((p) => at(p, pos.v, pos.a, pos.d)).sort((p, q) => p.i - q.i);
  const k = tiers.indexOf(pos);
  
  return ids([tiers[Math.max(k - 1, 0)].id, tiers[Math.min(k + 1, tiers.length - 1)].id]);
}


/** Returns the reactions column, indexed by 2 * accept + expect. */
function reactions(pos: Pos, all: Pos[]): string {
  const { v, a, d } = pos;
  const spots = [
    [SQRT - v, SQRT - a, d],
    [a, v, 1 - d],
    [SQRT - a, SQRT - v, 1 - d],
    [v, a, d]
  ];

  return ids(spots.map(([x, y, z]) => {
    const hit = all.find((p) => p.i === pos.i && at(p, x, y, z));
    if (hit) return hit.id;

    throw new Error(`No reaction for emotion id: ${pos.id}`);
  }));
}


/** Returns the globe column of an emotion-pos. */
function globe(pos: Pos): string {
  let [x, y, z] = [pos.v - MIDL.v, pos.a - MIDL.a, pos.d - MIDL.d];
  const r = Math.hypot(x, y, z);
  const key = [x / r, y / r, z / r].map((n) => n.toFixed(6)).join();

  if (!seen.has(key)) seen.set(key, r);
  if (seen.get(key) !== r) [y, z] = [y - TILT * z, z + TILT * y];

  const n = Math.hypot(x, y, z);
  return `{"x": ${fix(x / n)}, "y": ${fix(y / n)}, "z": ${fix(z / n)}}`;
}


/** Rewrites the file if modified. */
function update(): void {
  const text = fs.readFileSync(FILE, "utf8");
  const data = JSON.parse(text);

  if (Math.floor(fs.statSync(FILE).mtimeMs) > (data.stamp ?? 0)) {
    const eol = text.includes("\r\n") ? "\r\n" : "\n";
    const now = Date.now();

    const all: Pos[] = Object.keys(data)
      .filter((key) => key !== "stamp")
      .map((key) => ({ id: Number(key), ...data[key].pos }));

    const rows = text.split(eol).filter((line) => /^\s*"\d+":/.test(line)).map((line) => {
      const id = Number(line.match(/"(\d+)"/)![1]);
      const pos = all.find((p) => p.id === id)!;
      const head = line
        .replace(/"(intensities|reactions|globe)": (\[[^\]]*\]|\{[^}]*\}),? */g, "")
        .replace(/[,\s]*\},?\s*$/, "");

      return `${head}, "intensities": ${intensities(pos, all)}, "reactions": ${reactions(pos, all)}, "globe": ${globe(pos)}},`;
    });

    fs.writeFileSync(FILE, ["{", ...rows, ` "stamp": ${now}`, "}", ""].join(eol));
    fs.utimesSync(FILE, new Date(now), new Date(now));
    console.log(`Recomputed ${rows.length} emotions.`);
  }
}


update();
