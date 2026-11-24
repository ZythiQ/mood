import { Color, SRGBColorSpace } from "three";

import { Emotion, type Row } from "./emotion";
import type { GraphName, Kind } from "./profile";


/** Hue, saturation, and lightness (all 0 to 1). */
interface HSL {
  h: number;
  s: number;
  l: number;
}


/** Globe-positioned colour. */
export type Swatch = Row["globe"] & {
  color: string;
};


/** Kind intensity offsets and computed colours. */
const KIND_T: Record<Kind, number> = { outlier: -1, border: 0, core: 1 };
const cache = new Map<string, string>();


/** Returns the shifted HSL of a CSS variable (browser only). */
function hsl(name: string, t = 0): HSL {
  const css = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  const { h, s, l } = new Color(css).getHSL({ h: 0, s: 0, l: 0 }, SRGBColorSpace);

  return { h, s: s + 0.2 * t, l: l - 0.12 * t };
}


/** Returns the CSS hex string of an HSL colour, cached by key. */
function hex(key: string, fn: () => HSL): string {
  const cached = cache.get(key);
  if (cached) return cached;

  const { h, s, l } = fn();
  const css = `#${new Color().setHSL(h, s, l, SRGBColorSpace).getHexString()}`;

  cache.set(key, css);
  return css;
}


/** Returns the swatch of an emotion. */
export function swatch(emotion: Emotion, color = emotion_color(emotion)): Swatch {
  return { x: emotion.x, y: emotion.y, z: emotion.z, color };
}


/** Returns the HSL of an emotion. */
function emotion_hsl(emotion: Emotion): HSL {
  if (emotion.parents) {
    const [a, b] = emotion.parents.map((id) => emotion_hsl(Emotion.from_id(id)));
    const wrap = Math.abs(a.h - b.h) > 0.5 ? 0.5 : 0;

    return { h: (a.h + b.h) / 2 + wrap, s: Math.max(a.s, b.s), l: (a.l + b.l) / 2 };
  }

  const mid = emotion.lo.lo.hi;
  return hsl(mid.name, (emotion.i - mid.i) / mid.i);
}


/** Returns the CSS colour of an emotion. */
export function emotion_color(emotion: Emotion): string {
  return hex(emotion.name, () => emotion_hsl(emotion));
}


/** Returns the CSS colour of a profile graph kind. */
export function profile_color(graph: GraphName, kind: Kind): string {
  return hex(`${graph}:${kind}`, () => hsl(graph, KIND_T[kind]));
}
