/**
 * RobotCharacter3D.tsx
 *
 * A 3D animated robot character powered by Three.js + React Three Fiber.
 * Uses the "RobotExpressive" model from Three.js public CDN — a fully rigged
 * 3D character with morph-target facial expressions and named animations.
 *
 * Character states → robot behaviour:
 *   idle      → "Idle" animation  + neutral face
 *   listening → "Idle" animation  + wide-eyed Surprised expression
 *   thinking  → "Idle" animation  + Sleep (eyes closed) expression + head tilt
 *   speaking  → "Wave" animation  + Happy expression + mouth open proportional to volume
 */

import React, { useRef, useEffect, Suspense, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations, OrbitControls, Environment, Preload } from '@react-three/drei';
import * as THREE from 'three';
import type { CharacterState } from './AnimeCharacter';

// ─── Publicly hosted Three.js example model ─────────────────────────────────
const MODEL_URL = 'https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb';

// How fast to crossfade between animations (seconds)
const FADE_DURATION = 0.4;

// Morph target names baked into the RobotExpressive model
const EXPRESSIONS = {
  Angry: 0, Confused: 1, Crazy: 2, Default: 3,
  Happy: 4, Sad: 5, Sleep: 6, Surprised: 7,
} as const;

type ExpressionName = keyof typeof EXPRESSIONS;

// ─── Robot mesh inside the scene ─────────────────────────────────────────────
interface RobotModelProps {
  state: CharacterState;
  volume: number;     // 0-1 for mouth open during speaking
}

function RobotModel({ state, volume }: RobotModelProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const { scene, animations } = useGLTF(MODEL_URL);
  const { actions, mixer } = useAnimations(animations, groupRef);

  // Track what's currently playing so we only fade when state changes
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);
  const expressionMeshRef = useRef<THREE.SkinnedMesh | null>(null);

  // Find the mesh that has morph targets (facial expressions)
  useEffect(() => {
    scene.traverse((obj) => {
      if (
        obj instanceof THREE.SkinnedMesh &&
        obj.morphTargetDictionary &&
        'Surprised' in obj.morphTargetDictionary
      ) {
        expressionMeshRef.current = obj;
      }
    });
  }, [scene]);

  // ── Smooth morph-target setter ──────────────────────────────────────────────
  const setExpression = (name: ExpressionName, strength = 1) => {
    const mesh = expressionMeshRef.current;
    if (!mesh?.morphTargetInfluences || !mesh.morphTargetDictionary) return;
    // Reset all expression morphs first
    Object.values(EXPRESSIONS).forEach((idx) => {
      mesh.morphTargetInfluences![idx] = 0;
    });
    const idx = EXPRESSIONS[name];
    if (idx !== undefined) mesh.morphTargetInfluences[idx] = strength;
  };

  // ── Play animation by name with crossfade ──────────────────────────────────
  const playAnimation = (name: string) => {
    const next = actions[name];
    if (!next || currentActionRef.current === next) return;
    if (currentActionRef.current) {
      currentActionRef.current.fadeOut(FADE_DURATION);
    }
    next.reset().setLoop(
      name === 'Wave' || name === 'Jump' ? THREE.LoopRepeat : THREE.LoopRepeat,
      Infinity
    ).fadeIn(FADE_DURATION).play();
    currentActionRef.current = next;
  };

  // ── State → animation + expression ────────────────────────────────────────
  useEffect(() => {
    switch (state) {
      case 'idle':
        playAnimation('Idle');
        setExpression('Default');
        break;
      case 'listening':
        playAnimation('Idle');
        setExpression('Surprised', 0.85);
        break;
      case 'thinking':
        playAnimation('Idle');
        setExpression('Confused', 0.9);
        break;
      case 'speaking':
        playAnimation('Wave');
        setExpression('Happy', 0.8);
        break;
    }
  }, [state, actions]);

  // ── Per-frame: mouth open proportional to audio volume ────────────────────
  useFrame(() => {
    const mesh = expressionMeshRef.current;
    if (!mesh?.morphTargetInfluences || !mesh.morphTargetDictionary) return;

    if (state === 'speaking') {
      // Look for a mouth-open morph target — some models have one
      const mouthIdx = mesh.morphTargetDictionary['mouthOpen'] ??
                       mesh.morphTargetDictionary['MouthOpen'] ??
                       mesh.morphTargetDictionary['mouth_open'];
      if (mouthIdx !== undefined) {
        const current = mesh.morphTargetInfluences![mouthIdx] ?? 0;
        const target = volume * 0.9;
        // Lerp for smooth movement
        mesh.morphTargetInfluences![mouthIdx] = THREE.MathUtils.lerp(current, target, 0.25);
      }
    }
  });

  return (
    <primitive
      ref={groupRef}
      object={scene}
      scale={1.3}
      position={[0, -1.15, 0]}
      rotation={[0, 0.1, 0]}
    />
  );
}

// ─── Camera auto-orbits gently in idle/thinking ───────────────────────────
function AutoCamera({ state }: { state: CharacterState }) {
  const { camera } = useThree();
  const tRef = useRef(0);

  useFrame((_, delta) => {
    tRef.current += delta;
    if (state === 'idle' || state === 'thinking') {
      // Gentle horizontal drift
      camera.position.x = Math.sin(tRef.current * 0.2) * 0.3;
      camera.lookAt(0, 0.2, 0);
    } else {
      // Snap to front for active states
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, 0, 0.05);
      camera.lookAt(0, 0.2, 0);
    }
  });

  return null;
}

// ─── Loading fallback ────────────────────────────────────────────────────────
function LoadingRobot() {
  return (
    <mesh>
      <sphereGeometry args={[0.3, 16, 16]} />
      <meshStandardMaterial color="#6366f1" wireframe />
    </mesh>
  );
}

// ─── Status badge that overlays on the canvas ────────────────────────────────
const STATE_CONFIG: Record<CharacterState, { label: string; color: string; emoji: string }> = {
  idle:      { label: 'Standby',   color: '#94a3b8', emoji: '😴' },
  listening: { label: 'Listening', color: '#60a5fa', emoji: '👂' },
  thinking:  { label: 'Thinking',  color: '#a78bfa', emoji: '🤔' },
  speaking:  { label: 'Speaking',  color: '#34d399', emoji: '🗣️' },
};

// ─── Exported 3D character panel ─────────────────────────────────────────────
interface RobotCharacter3DProps {
  state: CharacterState;
  volume?: number;
}

const RobotCharacter3D: React.FC<RobotCharacter3DProps> = ({ state, volume = 0 }) => {
  const cfg = STATE_CONFIG[state];

  return (
    <div className="relative w-full h-full select-none">
      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 0.5, 2.8], fov: 45 }}
        shadows
        style={{ background: 'transparent' }}
        gl={{ antialias: true, alpha: true }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[3, 5, 5]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <directionalLight position={[-3, 3, -2]} intensity={0.4} color="#818cf8" />
        <pointLight position={[0, 3, 0]} intensity={0.5} color={
          state === 'listening' ? '#60a5fa' :
          state === 'thinking'  ? '#a78bfa' :
          state === 'speaking'  ? '#34d399' : '#ffffff'
        } distance={5} />

        {/* Auto-drifting camera */}
        <AutoCamera state={state} />

        {/* Environment map for reflections */}
        <Environment preset="city" />

        {/* Ground shadow */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.15, 0]} receiveShadow>
          <planeGeometry args={[4, 4]} />
          <shadowMaterial opacity={0.2} />
        </mesh>

        {/* The robot */}
        <Suspense fallback={<LoadingRobot />}>
          <RobotModel state={state} volume={volume} />
        </Suspense>

        <Preload all />
      </Canvas>

      {/* State badge overlay */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md bg-black/30 border border-white/10 pointer-events-none">
        <span className="text-sm">{cfg.emoji}</span>
        <span
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: cfg.color }}
        >
          {cfg.label}
        </span>
        {state !== 'idle' && (
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: cfg.color }}
          />
        )}
      </div>

      {/* Aura glow ring that pulses with state */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-4 rounded-full blur-xl pointer-events-none transition-all duration-700"
        style={{
          backgroundColor:
            state === 'listening' ? 'rgba(96,165,250,0.4)' :
            state === 'thinking'  ? 'rgba(167,139,250,0.4)' :
            state === 'speaking'  ? 'rgba(52,211,153,0.4)' :
            'rgba(148,163,184,0.15)',
          transform: `translateX(-50%) scaleX(${state !== 'idle' ? 1.5 : 1})`,
        }}
      />
    </div>
  );
};

// Preload the model for faster first display
useGLTF.preload(MODEL_URL);

export default RobotCharacter3D;
