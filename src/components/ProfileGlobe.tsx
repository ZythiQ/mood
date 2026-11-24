"use client";

import { useMemo } from "react";
import * as THREE from "three";

import Globe, { SPHERE, type Marker } from "@/components/Globe";
import { Emotion } from "@/lib/emotion";
import { profile_color } from "@/lib/color";
import { Profile, type GraphName, type Kind } from "@/lib/profile";


/** Config */
const GRAPHS: GraphName[] = ["expect", "accept"];
const LEVELS = Math.max(...Emotion.all().map((e) => e.u)) + 1;
const GLASS = new THREE.Color("#1e293b");
const RANK: Record<Kind, number> = { outlier: 0, border: 1, core: 2 };
const GAIN: Record<Kind, number> = { outlier: 0.45, border: 0.85, core: 1.35 };


/** Aggregated DBSCAN node at a globe spot. */
interface Node {
  key: number;
  emotion: Emotion;
  count: number;
  color: string;
  kinds: Partial<Record<GraphName, Kind>>;
}


/** ProfileGlobe properties. */
interface Props {
  profile: Profile;
  u?: number;
  lock?: Emotion;
  spin?: boolean;
  label?: boolean;
}


/** Returns the blended CSS colour of a node's kinds. */
function blend(kinds: Partial<Record<GraphName, Kind>>): string {
  const { expect, accept } = kinds;
  if (expect && accept) {
    const a = new THREE.Color(profile_color("expect", expect));
    const b = new THREE.Color(profile_color("accept", accept));
    return `#${a.add(b).multiplyScalar(0.65).getHexString()}`;
  }
  return expect ? profile_color("expect", expect) : profile_color("accept", accept!);
}


/** DBSCAN cluster globe of a relationship profile. */
export default function ProfileGlobe({ profile, u = 0, lock, spin = false, label = true }: Props) {
  const { shades, markers } = useMemo(() => {
    const spots = SPHERE.attributes.position;
    const radius = profile.get_radius();
    const density = profile.get_density();
    const spread = Math.max(0.02, (radius * 0.55) ** 2);
    const all: Node[] = [];

    for (const graph of GRAPHS) {
      for (const { emotion, kind } of profile.get_graph(graph)) {
        let node = all.find((n) => n.emotion.delta(emotion) === 0);
        if (!node) {
          node = { key: all.length, emotion, count: 0, color: "", kinds: {} };
          all.push(node);
        }
        node.count += 1;
        const prev = node.kinds[graph];
        if (!prev || RANK[kind] > RANK[prev]) node.kinds[graph] = kind;
      }
    }

    const layers = Array.from({ length: LEVELS }, (_, k) => all.filter((n) => n.emotion.u === k));

    const shades = () => layers.map((layer) => {
      const shade = new Float32Array(spots.count * 4);
      const pts = layer.map(({ emotion, count, kinds }) => {
        const scale = 0.7 + 0.3 * Math.min(2, count / density);
        return {
          x: emotion.x,
          y: emotion.y,
          z: emotion.z,
          reach: spread * (0.65 + 0.35 * Math.min(2.5, count / density)),
          channels: GRAPHS.map((g) => kinds[g] && {
            rgb: new THREE.Color(profile_color(g, kinds[g]!)),
            amp: GAIN[kinds[g]!] * scale
          })
        };
      });

      for (let k = 0; k < spots.count; k++) {
        const [vx, vy, vz] = [spots.getX(k), spots.getY(k), spots.getZ(k)];
        const sums = [[0, 0, 0, 0], [0, 0, 0, 0]];

        for (const p of pts) {
          const d2 = (vx - p.x) ** 2 + (vy - p.y) ** 2 + (vz - p.z) ** 2;
          if (d2 > p.reach * 4.5) continue;

          const falloff = Math.exp(-d2 / p.reach);

          p.channels.forEach((ch, i) => {
            if (!ch) return;
            const w = falloff * ch.amp;
            sums[i][0] += ch.rgb.r * w;
            sums[i][1] += ch.rgb.g * w;
            sums[i][2] += ch.rgb.b * w;
            sums[i][3] += w;
          });
        }

        let [cr, cg, cb, fog] = [0, 0, 0, 0];

        for (const [r, g, b, w] of sums) {
          if (!w) continue;
          const f = 1 - Math.exp(-w);
          cr += (r / w) * f;
          cg += (g / w) * f;
          cb += (b / w) * f;
          fog = Math.max(fog, f);
        }

        const peak = Math.max(1, cr, cg, cb);

        shade.set([
          GLASS.r * (1 - fog) + (cr / peak) * fog,
          GLASS.g * (1 - fog) + (cg / peak) * fog,
          GLASS.b * (1 - fog) + (cb / peak) * fog,
          0.14 + 0.72 * fog
        ], k * 4);
      }
      return shade;
    });

    const markers = (): Marker[][] => layers.map((layer) =>
      layer.map(({ key, emotion, count, kinds }) => {
        const color = blend(kinds);
        const same = kinds.expect && kinds.expect === kinds.accept;

        return {
          key,
          x: emotion.x,
          y: emotion.y,
          z: emotion.z,
          size: 0.015 + Math.min(0.012, (count - 1) * 0.004),
          color,
          chip: (
            <>
              <div className="flex items-center justify-center gap-1" style={{ color }}>
                <span>{emotion.name}</span>
                {count > 1 && <span className="text-[9px] opacity-85">({count})</span>}
              </div>

              <div className="mt-0.5 flex items-center justify-center gap-1.5 text-[9px] font-normal text-slate-300">
                {same ? (
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                    {kinds.expect}
                  </span>
                ) : (
                  GRAPHS.map((g) => kinds[g] && (
                    <span key={g} className="flex items-center gap-1">
                      <span
                        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: profile_color(g, kinds[g]!) }}
                      />
                      {kinds[g]}
                    </span>
                  ))
                )}
              </div>
            </>
          )
        };
      })
    );

    return { shades, markers };
  }, [profile]);

  return <Globe shades={shades} markers={markers} alpha u={u} lock={lock} spin={spin} label={label} />;
}
