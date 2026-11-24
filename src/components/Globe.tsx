"use client";

import { useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { TrackballControls } from "@react-three/drei";
import * as THREE from "three";

import { Emotion } from "@/lib/emotion";


/** Config */
const FIT = 1.1;     // Screen fit
const SPIN = 0.2;    // Spin rad/s
const CAM_DX = 3.1;  // Camera distance px

const DROP = 12;     // Label dropoff px
const STEP = 50;     // Scroll/level px
const GAP = 100;     // Scroll pause ms
const PINCH = 40;    // Mobile zoom px


/** Marker normal, spin axis, and scratch vectors. */
const NORMAL = new THREE.Vector3(0, 0, 1);
const AXIS = new THREE.Vector3(0, 1, 0);
const SPOT = new THREE.Vector3();
const VIEW = new THREE.Vector3();

export const SPHERE = new THREE.SphereGeometry(1, 128, 64);


/** Fiber 9 clock warning... */
THREE.setConsoleFunction((type, message, ...params) => {
  if (!message.includes("Clock: This module has been deprecated")) console[type](message, ...params);
});


/** Label elements by marker key. */
type Labels = RefObject<Map<number, HTMLDivElement>>;


/** Surface ring and optional DOM label. */
export interface Marker {
  key: number;
  x: number;
  y: number;
  z: number;
  size: number;
  color: string;
  lx?: number;
  ly?: number;
  lz?: number;
  chip?: ReactNode;
}


/** Globe properties. */
interface Props {
  shades: () => Float32Array[];
  markers: () => Marker[][];
  alpha?: boolean;
  u?: number;
  lock?: Emotion;
  spin?: boolean;
  label?: boolean;
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


/** Sphere painted with the shade buffer of the current level. */
function Surface({ shades, alpha, level }: { shades: () => Float32Array[]; alpha: boolean; level: number }) {
  const painted = useRef(-1);

  const { geometry, buffers } = useMemo(() => {
    const geometry = SPHERE.clone();
    const buffers = shades();
    const stride = alpha ? 4 : 3;

    painted.current = -1;
    geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(SPHERE.attributes.position.count * stride), stride));
    return { geometry, buffers };
  }, [shades, alpha]);

  useFrame((_, delta) => {
    if (painted.current === level || !buffers[level]) return;
    const color = geometry.attributes.color;
    const step = Math.min(1, delta * 8);

    let far = 0;

    for (let k = 0; k < color.array.length; k++) {
      const gap = buffers[level][k] - color.array[k];
      far = Math.max(far, Math.abs(gap));
      color.array[k] += gap * step;
    }

    if (far < 0.002) painted.current = level;
    color.needsUpdate = true;
  });

  if (!alpha) {
    return (
      <mesh geometry={geometry}>
        <meshBasicMaterial vertexColors />
      </mesh>
    );
  }

  return (
    <group>
      <mesh geometry={geometry} renderOrder={1}>
        <meshBasicMaterial vertexColors transparent depthWrite={false} side={THREE.BackSide} />
      </mesh>
      <mesh geometry={geometry} renderOrder={2}>
        <meshBasicMaterial vertexColors transparent depthWrite={false} side={THREE.FrontSide} />
      </mesh>
    </group>
  );
}


/** Surface rings and projected DOM labels. */
function Markers({ markers, labels }: { markers: Marker[]; labels: Labels }) {
  useFrame(({ camera, size }) => {
    camera.updateMatrixWorld();

    for (const m of markers) {
      const el = labels.current.get(m.key);
      if (!el) continue;

      SPOT.set(m.lx ?? m.x, m.ly ?? m.y, m.lz ?? m.z);
      const facing = SPOT.dot(VIEW.subVectors(camera.position, SPOT).normalize());

      SPOT.project(camera);
      const x = (SPOT.x + 1) / 2 * size.width;
      const y = (1 - SPOT.y) / 2 * size.height + DROP;

      el.style.opacity = String(THREE.MathUtils.smoothstep(facing, 0, 0.65));
      el.style.zIndex = String(Math.round(Math.max(0, facing) * 100));
      el.style.transform = `translate(${x}px, ${y}px) translateX(-50%)`;
    }
  });

  return markers.map(({ key, x, y, z, size, color }) => {
    const spot = new THREE.Vector3(x, y, z);

    return (
      <mesh
        key={key}
        renderOrder={3}
        position={spot.clone().multiplyScalar(1.005)}
        quaternion={new THREE.Quaternion().setFromUnitVectors(NORMAL, spot)}
      >
        <ringGeometry args={[size * 0.65, size, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} />
      </mesh>
    );
  });
}


/** Camera controls. */
function View({ lock, spin }: { lock?: Emotion; spin: boolean }) {
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


/** Generic interactive 3D globe. */
export default function Globe({ shades, markers, alpha = false, u = 0, lock, spin = false, label = true }: Props) {
  const [free, setFree] = useState(u);
  const pinch = useRef({ value: u, dist: 0 });
  const scroll = useRef({ value: u, time: 0 });
  const labels = useRef(new Map<number, HTMLDivElement>());
  const browser = useSyncExternalStore(idle, () => true, () => false);

  const layers = useMemo(() => (browser ? markers() : []), [markers, browser]);
  if (lock && lock.u !== free) setFree(lock.u);
  const level = lock ? lock.u : free;
  const shown = label ? (layers[level] ?? []) : [];

  return (
    <div
      className="relative isolate h-full w-full touch-none select-none"
      onWheel={(event) => {
        if (lock || event.buttons || !layers.length) return;
        const state = scroll.current;
        const delta = event.deltaY * (event.deltaMode ? STEP : 1);
        const step = Math.sign(delta) * Math.min(1, Math.abs(delta) / STEP);

        if (event.timeStamp - state.time > GAP) state.value = free;
        state.value = Math.min(layers.length - 1, Math.max(0, state.value - step));
        state.time = event.timeStamp;
        setFree(Math.round(state.value));
      }}
      onTouchStart={(event) => {
        if (event.touches.length !== 2) return;
        pinch.current = { value: free, dist: span(event.touches) };
      }}
      onTouchMove={(event) => {
        if (lock || event.touches.length !== 2 || !layers.length) return;
        const state = pinch.current;
        const dist = span(event.touches);

        state.value = Math.min(layers.length - 1, Math.max(0, state.value + (dist - state.dist) / PINCH));
        state.dist = dist;
        setFree(Math.round(state.value));
      }}
    >
      <Canvas flat dpr={[1, 2]} camera={{ position: [0, 0, CAM_DX], fov: 45 }}>
        <Fit />
        <View lock={lock} spin={spin} />
        <Surface shades={shades} alpha={alpha} level={level} />
        <Markers markers={shown} labels={labels} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {shown.map((m) => m.chip && (
          <div
            key={m.key}
            ref={(el) => {
              if (el) labels.current.set(m.key, el);
              return () => { labels.current.delete(m.key); };
            }}
            className="absolute left-0 top-0 rounded border border-slate-800/60 bg-slate-950/75 px-2 py-1 whitespace-nowrap text-[10px] font-medium capitalize opacity-0"
          >
            {m.chip}
          </div>
        ))}
      </div>
    </div>
  );
}
