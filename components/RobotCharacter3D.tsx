/**
 * RobotCharacter3D.tsx
 *
 * 3D animated robot using Three.js RobotExpressive model.
 * KEY FIX: Canvas uses absolute inset-0 to fill its parent,
 * with explicit width/height 100% so Three.js gets pixel dimensions.
 */

import React, { useRef, useEffect, Suspense, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations, Environment, Preload } from '@react-three/drei';
import * as THREE from 'three';
import type { CharacterState } from './AnimeCharacter';

const MODEL_URL = 'https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb';
const FADE = 0.35;

const EXPRESSIONS = {
  Angry: 0, Confused: 1, Crazy: 2, Default: 3,
  Happy: 4, Sad: 5, Sleep: 6, Surprised: 7,
} as const;
type ExpressionName = keyof typeof EXPRESSIONS;

// ── Robot mesh ──────────────────────────────────────────────────────────────
function RobotModel({ state, volume }: { state: CharacterState; volume: number }) {
  const groupRef = useRef<THREE.Group>(null!);
  const { scene, animations } = useGLTF(MODEL_URL);
  const { actions } = useAnimations(animations, groupRef);
  const curActionRef = useRef<THREE.AnimationAction | null>(null);
  const faceMeshRef = useRef<THREE.SkinnedMesh | null>(null);

  // Find the mesh with expression morph targets
  useEffect(() => {
    scene.traverse((obj) => {
      const mesh = obj as THREE.SkinnedMesh;
      if (mesh.isMesh && mesh.morphTargetDictionary && 'Surprised' in mesh.morphTargetDictionary) {
        faceMeshRef.current = mesh;
      }
    });
  }, [scene]);

  const setExpression = (name: ExpressionName, strength = 1) => {
    const m = faceMeshRef.current;
    if (!m?.morphTargetInfluences) return;
    Object.values(EXPRESSIONS).forEach(i => { m.morphTargetInfluences![i] = 0; });
    m.morphTargetInfluences[EXPRESSIONS[name]] = strength;
  };

  const play = (name: string) => {
    const next = actions[name];
    if (!next || curActionRef.current === next) return;
    curActionRef.current?.fadeOut(FADE);
    next.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(FADE).play();
    curActionRef.current = next;
  };

  useEffect(() => {
    switch (state) {
      case 'idle':
        play('Idle');
        setExpression('Default');
        break;
      case 'listening':
        play('Idle');
        setExpression('Surprised', 0.85);
        break;
      case 'thinking':
        play('Idle');
        setExpression('Sleep', 0.7); // eyes closed
        break;
      case 'speaking':
        play('Wave');
        setExpression('Happy', 0.9);
        break;
    }
  }, [state, actions]);

  // Lerp mouth open with volume
  useFrame(() => {
    const m = faceMeshRef.current;
    if (!m?.morphTargetInfluences || !m.morphTargetDictionary) return;
    if (state !== 'speaking') return;
    // Some builds of the model expose a "mouthOpen" morph
    const idx = m.morphTargetDictionary['mouthOpen'] ??
                m.morphTargetDictionary['MouthOpen'] ??
                m.morphTargetDictionary['mouth_open'];
    if (idx !== undefined) {
      const cur = m.morphTargetInfluences[idx] ?? 0;
      m.morphTargetInfluences[idx] = THREE.MathUtils.lerp(cur, volume * 0.85, 0.3);
    }
  });

  return <primitive ref={groupRef} object={scene} scale={1.25} position={[0, -1.1, 0]} rotation={[0, 0.08, 0]} />;
}

// ── Gentle camera drift ─────────────────────────────────────────────────────
function CameraDrift({ state }: { state: CharacterState }) {
  const { camera } = useThree();
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current += dt;
    if (state === 'idle' || state === 'thinking') {
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, Math.sin(t.current * 0.18) * 0.28, 0.03);
    } else {
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, 0, 0.06);
    }
    camera.lookAt(0, 0.15, 0);
  });
  return null;
}

// ── Spinning loader while model downloads ───────────────────────────────────
function Spinner() {
  const meshRef = useRef<THREE.Mesh>(null!);
  useFrame((_, dt) => {
    meshRef.current.rotation.y += dt * 2;
    meshRef.current.rotation.x += dt * 0.5;
  });
  return (
    <mesh ref={meshRef}>
      <octahedronGeometry args={[0.35, 0]} />
      <meshStandardMaterial color="#6366f1" wireframe />
    </mesh>
  );
}

// ── State overlay config ─────────────────────────────────────────────────────
const CFG: Record<CharacterState, { label: string; color: string; emoji: string }> = {
  idle:      { label: 'Standby',   color: '#94a3b8', emoji: '😴' },
  listening: { label: 'Listening', color: '#60a5fa', emoji: '👂' },
  thinking:  { label: 'Thinking',  color: '#a78bfa', emoji: '🤔' },
  speaking:  { label: 'Speaking',  color: '#34d399', emoji: '🗣️' },
};

// ── Main export ──────────────────────────────────────────────────────────────
export interface RobotCharacter3DProps {
  state: CharacterState;
  volume?: number;
}

const RobotCharacter3D: React.FC<RobotCharacter3DProps> = ({ state, volume = 0 }) => {
  const cfg = CFG[state];
  const [loaded, setLoaded] = useState(false);

  const stateColor =
    state === 'listening' ? '#60a5fa' :
    state === 'thinking'  ? '#a78bfa' :
    state === 'speaking'  ? '#34d399' : '#ffffff';

  return (
    // IMPORTANT: This div must fill 100% of its absolutely-positioned parent
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>

      {/* Three.js Canvas — explicit width/height 100% is REQUIRED */}
      <Canvas
        camera={{ position: [0, 0.45, 2.8], fov: 44 }}
        shadows
        gl={{ antialias: true, alpha: true }}
        style={{ width: '100%', height: '100%', display: 'block', background: 'transparent' }}
        onCreated={() => setLoaded(true)}
      >
        {/* Scene lighting */}
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 5, 4]} intensity={1.1} castShadow shadow-mapSize={[512, 512]} />
        <directionalLight position={[-2, 2, -2]} intensity={0.35} color="#818cf8" />
        <pointLight position={[0, 2.5, 1]} intensity={0.6} color={stateColor} distance={6} decay={2} />

        {/* Camera gentle drift */}
        <CameraDrift state={state} />

        {/* HDR environment for nice reflections */}
        <Environment preset="city" />

        {/* Shadow plane */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.1, 0]} receiveShadow>
          <planeGeometry args={[4, 4]} />
          <shadowMaterial opacity={0.15} />
        </mesh>

        {/* Robot — suspense shows spinner until loaded */}
        <Suspense fallback={<Spinner />}>
          <RobotModel state={state} volume={volume} />
        </Suspense>

        <Preload all />
      </Canvas>

      {/* State badge — on top of canvas */}
      <div style={{
        position: 'absolute',
        bottom: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 12px',
        borderRadius: 999,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.1)',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}>
        <span style={{ fontSize: 13 }}>{cfg.emoji}</span>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, color: cfg.color }}>
          {cfg.label}
        </span>
        {state !== 'idle' && (
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            backgroundColor: cfg.color,
            animation: 'pulse 1s ease-in-out infinite',
          }} />
        )}
      </div>

      {/* Aura glow at bottom */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: '50%',
        transform: `translateX(-50%) scaleX(${state !== 'idle' ? 1.8 : 1})`,
        width: 80,
        height: 16,
        borderRadius: '50%',
        filter: 'blur(12px)',
        background:
          state === 'listening' ? 'rgba(96,165,250,0.45)' :
          state === 'thinking'  ? 'rgba(167,139,250,0.45)' :
          state === 'speaking'  ? 'rgba(52,211,153,0.45)' :
          'rgba(148,163,184,0.1)',
        transition: 'all 0.6s ease',
        pointerEvents: 'none',
      }} />
    </div>
  );
};

// Kick off model download immediately on import
useGLTF.preload(MODEL_URL);

export default RobotCharacter3D;
