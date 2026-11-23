import { Color, SRGBColorSpace } from "three";

import { Emotion, type Row } from "./emotion";


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


/** Computed colours by emotion. */
const cache = new Map<Emotion, string>();


/** Returns the HSL of an emotion (browser only). */
function hsl(emotion: Emotion): HSL {
  if (emotion.parents) {
    const [a, b] = emotion.parents.map((id) => hsl(Emotion.from_id(id)));
    const wrap = Math.abs(a.h - b.h) > 0.5 ? 0.5 : 0;

    return { h: (a.h + b.h) / 2 + wrap, s: Math.max(a.s, b.s), l: (a.l + b.l) / 2 };
  }

  const mid = emotion.lo.lo.hi;
  const css = getComputedStyle(document.documentElement).getPropertyValue(`--${mid.name}`).trim();
  
  const { h, s, l } = new Color(css).getHSL({ h: 0, s: 0, l: 0 }, SRGBColorSpace);
  const t = (emotion.i - mid.i) / mid.i;
  
  return { h, s: s + 0.2 * t, l: l - 0.12 * t };
}


/** Returns the CSS colour of an emotion. */
export function color(emotion: Emotion): string {
  const cached = cache.get(emotion);
  if (cached) return cached;

  const { h, s, l } = hsl(emotion);
  const css = `#${new Color().setHSL(h, s, l, SRGBColorSpace).getHexString()}`;
  
  cache.set(emotion, css);
  return css;
}


/** Returns the swatch of an emotion. */
export function swatch(emotion: Emotion): Swatch {
  return { x: emotion.x, y: emotion.y, z: emotion.z, color: color(emotion) };
}
