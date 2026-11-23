import raw from "@/data/emotion.json";


/** Emotion row structure. */
export interface Row {
  name: string;
  parents: null | number[];
  intensities: number[];
  reactions: number[];
  pos: {
    v: number;
    a: number;
    d: number;
    i: number;
    u: number;
  };
  globe: {
    x: number;
    y: number;
    z: number;
  };
}


/** 4D Plutchik Emotion dataclass. */
export class Emotion {

  /** Registry and Attributes. */
  private static readonly table = new Map<number, Emotion>();
  readonly name: string;
  readonly id: number;
  
  readonly v: number;
  readonly a: number;
  readonly d: number;
  readonly i: number;
  readonly u: number;

  readonly x: number;
  readonly y: number;
  readonly z: number;

  readonly parents: readonly number[] | null;
  private readonly reactions: readonly number[];
  private readonly intensities: readonly number[];

  static { for (const [key, row] of Object.entries(raw)) {
    if (typeof row === "number") continue;
    Emotion.table.set(Number(key), new Emotion(Number(key), row));
  }}

  /** Instantiates an Emotion given an ID and row content. */
  private constructor(id: number, row: Row) {
    this.name = row.name;
    this.id = id;
    
    this.v = row.pos.v;
    this.a = row.pos.a;
    this.d = row.pos.d;
    this.i = row.pos.i;
    this.u = row.pos.u;

    this.x = row.globe.x;
    this.y = row.globe.y;
    this.z = row.globe.z;

    this.parents = row.parents;
    this.reactions = row.reactions;
    this.intensities = row.intensities;
  }

  /** Returns every Emotion. */
  static all(): Emotion[] {
    return [...Emotion.table.values()];
  }

  /** Returns the Emotion associated with the ID. */
  static from_id(id: number): Emotion {
    const emotion = Emotion.table.get(id);
    if (emotion) return emotion;
    throw new RangeError(`Unknown emotion id: ${id}`);
  }

  /** Returns the Emotion associated with the name. */
  static from_name(name: string): Emotion {
    for (const emotion of Emotion.table.values())
      if (emotion.name === name) return emotion;
    throw new RangeError(`Unknown emotion name: ${name}`);
  }

  /** Returns the nearest emotion to the position. */
  static from_pos(v: number, a: number, d: number, i: number): Emotion {
    let top = Emotion.from_id(0);
    let min = Infinity;

    for (const emotion of Emotion.table.values()) {
      const delta = (
        (emotion.v - v) ** 2 +
        (emotion.a - a) ** 2 +
        (emotion.d - d) ** 2
      );

      if (delta < min) {
        top = emotion;
        min = delta;
      }
    }

    while (Math.abs(top.hi.i - i) < Math.abs(top.i - i)) top = top.hi;
    return top;
  }

  /** Returns the composite of two emotions given a ratio (a:b). */
  static from_composite(a: Emotion, b: Emotion, ratio: number): Emotion {
    ratio = Math.min(1, Math.max(0, ratio));
    
    const mix = (x: number, y: number) => (1 - ratio) * x + ratio * y;
    return Emotion.from_pos(mix(a.v, b.v), mix(a.a, b.a), mix(a.d, b.d), mix(a.i, b.i));
  }

  /** Returns an intensity tier down (or itself). */
  get lo(): Emotion {
    return Emotion.from_id(this.intensities[0]);
  }

  /** Returns an intensity tier up (or itself). */
  get hi(): Emotion {
    return Emotion.from_id(this.intensities[1]);
  }

  /** Returns distance in (v, a, d, !i). */
  delta(other: Emotion): number {
    return Math.hypot(this.v - other.v, this.a - other.a, this.d - other.d);
  }

  /** Returns the reaction from accept/expect deflections. */
  react(accept: boolean, expect: boolean): Emotion {
    return Emotion.from_id(this.reactions[2 * Number(accept) + Number(expect)]);
  }
}
