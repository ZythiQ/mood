"use client";

import { useMemo, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { TrackballControls } from "@react-three/drei";
import * as THREE from "three";

import { Emotion } from "@/lib/emotion";
import { color, type Swatch } from "@/lib/emotion_color";


/** Config */
const FIT = 1.1;     // Screen fit

const LEVELS = 7;    // Intensities
const SPIN = 0.3;    // rad/s
const CAM_DX = 3.1;  // Camera distance px

const SOFT = 0.05;   // Blend px
const SHARP = 2.5;   // Blend px
const DROP = 12;     // Label dropoff px

const STEP = 50;     // Scroll/level px
const GAP = 100;     // Scroll pause ms
const PINCH = 40;    // Mobile zoom px


/** Marker normal, spin axis, and scratch vectors. */
const NORMAL = new THREE.Vector3(0, 0, 1);
const AXIS = new THREE.Vector3(0, 1, 0);
const SPOT = new THREE.Vector3();
const VIEW = new THREE.Vector3();


/** Fiber 9 clock warning... */
THREE.setConsoleFunction((type, message, ...params) => {
  if (!message.includes("Clock: This module has been deprecated")) console[type](message, ...params);
});


/** Label elements by emotion ID. */
type Labels = RefObject<Map<number, HTMLDivElement>>;


/** Globe spot at an intensity level. */
interface Spot {
  x: number;
  y: number;
  z: number;
  i: number;
}


/** EmotionGlobe properties. */
interface Props {
  emotions: Emotion[];
  palette: () => Swatch[];
  i?: number;
  lock?: Spot;
  spin?: boolean;
}


/** Browser detection. */
const idle = () => () => {};


/** Mobile pinch helper. */
const span = (touches: React.TouchList) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);


/** Zooms out on mobile screens. */
function Fit() {
  const { camera, size } = useThree();

  useFrame(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const zoom = Math.min(1, FIT * size.width / size.height);

    if (cam.zoom === zoom) return;
    cam.zoom = zoom;
    cam.updateProjectionMatrix();
  });

  return null;
}


/** Sphere painted with the palette of the current level. */
function Surface({ palette, level }: { palette: () => Swatch[]; level: number }) {
  const painted = useRef(-1);

  const { geometry, shades } = useMemo(() => {
    const geometry = new THREE.SphereGeometry(1, 128, 64);
    const spots = geometry.attributes.position;
    const nodes = palette().map((s) => ({ ...s, rgb: new THREE.Color(s.color) }));

    const shades = Array.from({ length: LEVELS }, (_, i) => {
      const shade = new Float32Array(spots.count * 3);
      const layer = nodes.filter((node) => node.i === i);

      for (let k = 0; k < spots.count; k++) {
        let [r, g, b, sum] = [0, 0, 0, 0];
        
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
        shade.set([r / (sum || 1), g / (sum || 1), b / (sum || 1)], k * 3);
      }
      return shade;
    });

    geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(spots.count * 3), 3));
    return { geometry, shades };
    
  }, [palette]);

  useFrame((_, delta) => {
    if (painted.current === level) return;
    const color = geometry.attributes.color;
    const step = Math.min(1, delta * 8);

    let far = 0;

    for (let k = 0; k < color.array.length; k++) {
      const gap = shades[level][k] - color.array[k];
      far = Math.max(far, Math.abs(gap));
      color.array[k] += gap * step;
    }

    if (far < 0.002) painted.current = level;
    color.needsUpdate = true;
  });

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial vertexColors />
    </mesh>
  );
}


/** Surface rings/labels of emotions. */
function Markers({ emotions, labels }: { emotions: Emotion[]; labels: Labels }) {
  useFrame(({ camera, size }) => {
    camera.updateMatrixWorld();

    for (const emotion of emotions) {
      const label = labels.current.get(emotion.id);
      if (!label) continue;

      SPOT.set(emotion.x, emotion.y, emotion.z);
      const facing = SPOT.dot(VIEW.subVectors(camera.position, SPOT).normalize());

      SPOT.project(camera);
      const x = (SPOT.x + 1) / 2 * size.width;
      const y = (1 - SPOT.y) / 2 * size.height + DROP;

      label.style.opacity = String(THREE.MathUtils.smoothstep(facing, 0, 0.65));
      label.style.zIndex = String(Math.round(Math.max(0, facing) * 100));
      label.style.transform = `translate(${x}px, ${y}px) translateX(-50%)`;
    }
  });

  return emotions.map((emotion) => {
    const spot = new THREE.Vector3(emotion.x, emotion.y, emotion.z);
    const size = emotion.parents ? 0.013 : 0.018;

    return (
      <mesh
        key={emotion.id}
        position={spot.clone().multiplyScalar(1.005)}
        quaternion={new THREE.Quaternion().setFromUnitVectors(NORMAL, spot)}
      >
        <ringGeometry args={[size * 0.65, size, 32]} />
        <meshBasicMaterial color="white" transparent opacity={0.8} />
      </mesh>
    );
  });
}


/** Name chip of an emotion, listing its parents. */
function Label({ emotion, labels }: { emotion: Emotion; labels: Labels }) {
  return (
    <div
      ref={(node) => {
        if (node) labels.current.set(emotion.id, node);
        return () => { labels.current.delete(emotion.id); };
      }}
      className="absolute left-0 top-0 rounded border border-slate-800/60 bg-slate-950/75 px-2 py-1 whitespace-nowrap text-[10px] font-medium capitalize opacity-0"
    >
      <div className="text-center" style={{ color: color(emotion) }}>
        {emotion.name}
      </div>

      {emotion.parents && (
        <ul className="mt-0.5 space-y-0.5 text-[9px] font-normal text-slate-300">
          {emotion.parents.map((id) => (
            <li key={id} className="flex items-center gap-1.5">
              <span
                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: color(Emotion.from_id(id)) }}
              />
              {Emotion.from_id(id).name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


/** Camera controls. */
function View({ lock, spin }: { lock?: Spot; spin: boolean }) {
  useFrame(({ camera }, delta) => {
    if (lock) {
      camera.position.set(lock.x, lock.y, lock.z).setLength(CAM_DX);
      camera.up.copy(AXIS);
      camera.lookAt(0, 0, 0);
    } else if (spin) {
      camera.position.applyAxisAngle(AXIS, delta * SPIN);
      camera.up.applyAxisAngle(AXIS, delta * SPIN);
      camera.lookAt(0, 0, 0);
    }
  });

  if (lock || spin) return null;
  return <TrackballControls noPan noZoom rotateSpeed={1.5} dynamicDampingFactor={0.05} />;
}


/** Globe of emotions... hence the name... */
export default function EmotionGlobe({ emotions, palette, i = 3, lock, spin = false }: Props) {
  const [free, setFree] = useState(i);
  const pinch = useRef({ value: i, dist: 0 });
  const scroll = useRef({ value: i, time: 0 });
  const labels = useRef(new Map<number, HTMLDivElement>());
  const browser = useSyncExternalStore(idle, () => true, () => false);

  if (lock && lock.i !== free) setFree(lock.i);
  const level = lock ? lock.i : free;
  const shown = useMemo(() => emotions.filter((emotion) => emotion.i === level), [emotions, level]);

  return (
    <div
      className="relative isolate h-full w-full touch-none select-none"
      onWheel={(event) => {
        if (lock || event.buttons) return;
        const state = scroll.current;
        const delta = event.deltaY * (event.deltaMode ? 40 : 1);

        if (event.timeStamp - state.time > GAP) state.value = free;
        state.value = Math.min(LEVELS - 1, Math.max(0, state.value - delta / STEP));
        state.time = event.timeStamp;
        setFree(Math.round(state.value));
      }}
      onTouchStart={(event) => {
        if (event.touches.length !== 2) return;
        pinch.current = { value: free, dist: span(event.touches) };
      }}
      onTouchMove={(event) => {
        if (lock || event.touches.length !== 2) return;
        const state = pinch.current;
        const dist = span(event.touches);

        state.value = Math.min(LEVELS - 1, Math.max(0, state.value + (dist - state.dist) / PINCH));
        state.dist = dist;
        setFree(Math.round(state.value));
      }}
    >
      <Canvas flat dpr={[1, 2]} camera={{ position: [0, 0, CAM_DX], fov: 45 }}>
        <Fit />
        <View lock={lock} spin={spin} />
        <Surface palette={palette} level={level} />
        <Markers emotions={shown} labels={labels} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {browser && shown.map((emotion) => (
          <Label key={emotion.id} emotion={emotion} labels={labels} />
        ))}
      </div>
    </div>
  );
}
