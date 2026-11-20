import { Emotion } from "./emotion";


/** DBSCAN and Profile graphs. */
export type Kind = "core" | "border" | "outlier";
export type GraphName = "expect" | "accept";

export interface ProfileOptions {
  radius?: number;
  density?: number;
  saturation?: number;
  expect?: Emotion[];
  accept?: Emotion[];
}


/** Relationship profiling graph. */
const GRAPHS: GraphName[] = ["expect", "accept"];

export class Profile {

  /** Graphs and Attributes. */
  private readonly graphs: Record<GraphName, Emotion[]>;
  private readonly kinds: Record<GraphName, Kind[]>;

  private radius = 0;
  private density = 0;
  private saturation = 0;

  /** Instantiates a Profile. */
  constructor(options: ProfileOptions) {
    this.kinds = {
      expect: [],
      accept: []
    };
    this.graphs = {
      expect: [...(options.expect ?? [])],
      accept: [...(options.accept ?? [])]
    };

    this.set_radius(options.radius ?? 1);
    this.set_density(options.density ?? 3);
    this.set_saturation(options.saturation ?? 24);
  }

  /** Updates the kinds of a graph. */
  private update_graph(graph: GraphName): void {
    const points = this.graphs[graph];
    const near = points.map((p) => points.flatMap((q, j) => (q.delta(p) <= this.radius ? [j] : [])));
    const core = near.map((n) => n.length >= this.density);
    
    this.kinds[graph] = near.map((n, i) => core[i] ? "core" : n.some((j) => core[j]) ? "border" : "outlier");
  }

  /** Removes a random outlier, else border from a graph. */
  private sweep_graph(graph: GraphName): void {
    const kinds = this.kinds[graph];
    
    for (const target of ["outlier", "border"] as const) {
      const pool = kinds.flatMap((kind, i) => (kind === target ? [i] : []));
      if (pool.length === 0) continue;

      const index = pool[Math.floor(Math.random() * pool.length)];
      this.graphs[graph].splice(index, 1);
      this.update_graph(graph);
      return;
    }
  }

  /** Adds an emotion to a graph. */
  private add_to_graph(graph: GraphName, emotion: Emotion): void {
    while (this.graphs[graph].length >= this.saturation) this.sweep_graph(graph);
    this.graphs[graph].push(emotion);
    this.update_graph(graph);
  }

  /** Returns the would-be assigned kind of an incoming emotion. */
  get_kind(graph: GraphName, incoming: Emotion): Kind {
    const points = this.graphs[graph];
    const near = points.filter((p) => p.delta(incoming) <= this.radius);

    if (near.length + 1 >= this.density) {
      return "core";
    }
    for (const p of near) {
      const count = points.filter((q) => q.delta(p) <= this.radius).length;
      if (count + 1 >= this.density) {
        return "border";
      }
    }
    return "outlier";
  }

  /** Returns the reaction, optionally storing it. */
  get_reaction(current: Emotion, incoming: Emotion, do_update = true): Emotion {
    const expect = this.get_kind("expect", incoming) !== "outlier";
    const accept = this.get_kind("accept", incoming) !== "outlier";

    if (do_update && expect) this.add_to_graph("expect", incoming);
    if (do_update && accept) this.add_to_graph("accept", incoming);

    return current.react(accept, expect);
  }

  /** Returns the emotions + kinds of a graph. */
  get_graph(graph: GraphName): { emotion: Emotion; kind: Kind }[] {
    const kinds = this.kinds[graph];
    return this.graphs[graph].map((emotion, i) => ({ emotion, kind: kinds[i] }));
  }

  /** Sets the neighbour radius. */
  set_radius(radius: number): void {
    if (!(radius > 0))
      throw new RangeError(`Invalid radius: ${radius}`);

    this.radius = radius;
    for (const graph of GRAPHS) this.update_graph(graph);
  }

  /** Sets the minimum core density (self included). */
  set_density(density: number): void {
    if (!Number.isInteger(density) || density < 1)
      throw new RangeError(`Invalid density: ${density}`);

    this.density = density;
    for (const graph of GRAPHS) this.update_graph(graph);
  }

  /** Sets the max emotions per graph. */
  set_saturation(max: number): void {
    if (!Number.isInteger(max) || max < 1)
      throw new RangeError(`Invalid saturation: ${max}`);

    this.saturation = max;
    for (const graph of GRAPHS) while (this.graphs[graph].length > max) this.sweep_graph(graph);
  }
}
