"use client";

import { useMemo } from "react";
import * as THREE from "three";

import Globe, { SPHERE, type Marker } from "@/components/Globe";
import { Emotion } from "@/lib/emotion";
import { emotion_color, type Swatch } from "@/lib/color";


/** Config */
const BASE = 1;      // White base weight
const SOFT = 0.05;   // Blend px
const SHARP = 2.5;   // Blend px


/** EmotionGlobe properties. */
interface Props {
  emotions: Emotion[][];
  palette: () => Swatch[][];
  u?: number;
  lock?: Emotion;
  spin?: boolean;
  label?: boolean;
}


/** Globe of emotions... hence the name... */
export default function EmotionGlobe({ emotions, palette, u = 0, lock, spin = false, label = true }: Props) {
  const { shades, markers } = useMemo(() => {
    const spots = SPHERE.attributes.position;

    const shades = () => palette().map((group) => {
      const shade = new Float32Array(spots.count * 3);
      const layer = group.map((s) => ({ ...s, rgb: new THREE.Color(s.color) }));

      for (let k = 0; k < spots.count; k++) {
        let [r, g, b, sum] = [BASE, BASE, BASE, BASE];

        for (const node of layer) {
          const gap = (
            (spots.getX(k) - node.x) ** 2 +
            (spots.getY(k) - node.y) ** 2 +
            (spots.getZ(k) - node.z) ** 2
          );

          const weight = (gap + SOFT) ** -SHARP;

          r += node.rgb.r * weight;
          g += node.rgb.g * weight;
          b += node.rgb.b * weight;

          sum += weight;
        }
        shade.set([r / sum, g / sum, b / sum], k * 3);
      }
      return shade;
    });

    const markers = (): Marker[][] => emotions.map((layer) =>
      [...new Set(layer)].map((emotion) => ({
        key: emotion.id,
        x: emotion.x,
        y: emotion.y,
        z: emotion.z,
        size: emotion.parents ? 0.013 : 0.018,
        color: "white",
        chip: (
          <>
            <div className="text-center" style={{ color: emotion_color(emotion) }}>
              {emotion.name}
            </div>

            {emotion.parents && (
              <ul className="mt-0.5 space-y-0.5 text-[9px] font-normal text-slate-300">
                {emotion.parents.map((id) => (
                  <li key={id} className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: emotion_color(Emotion.from_id(id)) }}
                    />
                    {Emotion.from_id(id).name}
                  </li>
                ))}
              </ul>
            )}
          </>
        )
      }))
    );

    return { shades, markers };
  }, [emotions, palette]);

  return <Globe shades={shades} markers={markers} u={u} lock={lock} spin={spin} label={label} />;
}
