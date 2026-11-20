"use client";

import { useState } from "react";

import EmotionGlobe from "@/components/EmotionGlobe";
import { Emotion } from "@/lib/emotion";
import { swatch } from "@/lib/emotion_color";


const EMOTIONS = Emotion.all();
const PALETTE = () => EMOTIONS.map(swatch);


export default function Home() {
  const [spin, setSpin] = useState(false);
  const [query, setQuery] = useState("");

  const name = query.trim().toLowerCase();
  const lock = EMOTIONS.find((emotion) => emotion.name === name);
  const options = name && !lock ? EMOTIONS.filter((emotion) => emotion.name.startsWith(name)).slice(0, 6) : [];

  return (
    <main className="relative h-dvh">
      <EmotionGlobe emotions={EMOTIONS} palette={PALETTE} i={0} lock={lock} spin={spin} />

      <div className="absolute left-4 top-4 flex w-[calc(100%-2rem)] max-w-120 flex-row gap-3 text-sm text-slate-200">
        <div className="min-w-0 flex-1">
          <input
            type="text"
            value={query}
            placeholder="Find emotion..."
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Tab" || !options.length) return;
              event.preventDefault();
              setQuery(options[0].name);
            }}
            className="w-full rounded border border-slate-700 bg-slate-950/80 px-2 py-1 outline-none focus:border-slate-500"
          />

          {options.map((emotion) => (
            <button
              key={emotion.id}
              onClick={() => setQuery(emotion.name)}
              className="block w-full px-2 py-0.5 text-left text-slate-400 hover:text-slate-100"
            >
              {emotion.name}
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={spin}
            onChange={(event) => setSpin(event.target.checked)}
          />
          <span className="relative h-5 w-9 rounded-full bg-slate-700 transition-colors peer-checked:bg-slate-500 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
          Spin
        </label>
      </div>
    </main>
  );
}
