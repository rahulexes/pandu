// ============================================================
// PANDU — 3D Floating Interactive Cards (Three.js WebGL)
// ============================================================

'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface CardDef {
  rank: string;
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades' | 'joker';
  basePos: [number, number, number];
  baseRot: [number, number, number]; // [x, y, z] in radians
  speed: number;
  phase: number;
}

const CARD_DATA: CardDef[] = [
  // 1: King of Hearts (Top-Left)
  {
    rank: 'K',
    suit: 'hearts',
    basePos: [-2.1, 1.4, 0.2],
    baseRot: [-0.05, 0.2, 0.38],
    speed: 1.2,
    phase: 0.0,
  },
  // 2: Queen of Spades (Top-Center)
  {
    rank: 'Q',
    suit: 'spades',
    basePos: [0.45, 2.3, -0.2],
    baseRot: [-0.1, -0.15, -0.45],
    speed: 1.0,
    phase: 1.5,
  },
  // 3: Joker (Right)
  {
    rank: 'JOKER',
    suit: 'joker',
    basePos: [2.05, 0.95, 0.1],
    baseRot: [0.08, -0.22, 0.18],
    speed: 1.1,
    phase: 2.8,
  },
  // 4: Queen of Spades (Bottom-Right)
  {
    rank: 'Q',
    suit: 'spades',
    basePos: [1.75, -1.3, 0.3],
    baseRot: [0.12, -0.15, -0.48],
    speed: 0.9,
    phase: 4.2,
  },
  // 5: Ace of Diamonds (Bottom-Center)
  {
    rank: 'A',
    suit: 'diamonds',
    basePos: [-0.05, -1.85, 0.4],
    baseRot: [0.18, 0.02, 0.05],
    speed: 1.3,
    phase: 3.1,
  },
  // 6: Ace of Spades (Bottom-Left)
  {
    rank: 'A',
    suit: 'spades',
    basePos: [-1.95, -0.85, 0.1],
    baseRot: [0.05, 0.18, -0.32],
    speed: 1.0,
    phase: 5.0,
  },
];

// Helper to generate high-resolution canvas texture for each playing card
function createCardTexture(rank: string, suit: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 740;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Background - Clean crisp card stock with subtle bevel
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(8, 8, 496, 724, 28);
  ctx.fill();

  // Subtle card border
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.lineWidth = 4;
  ctx.stroke();

  const isRed = suit === 'hearts' || suit === 'diamonds';
  const suitColor = isRed ? '#dc2626' : '#0f172a';
  const suitChar = suit === 'hearts' ? '♥' : suit === 'diamonds' ? '♦' : suit === 'clubs' ? '♣' : suit === 'spades' ? '♠' : '★';

  if (suit === 'joker') {
    // Joker Card Design
    ctx.fillStyle = '#7c3aed';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('J', 32, 60);
    ctx.fillText('O', 32, 100);
    ctx.fillText('K', 32, 140);
    ctx.fillText('E', 32, 180);
    ctx.fillText('R', 32, 220);

    // Inverted right side
    ctx.save();
    ctx.translate(480, 680);
    ctx.rotate(Math.PI);
    ctx.fillText('J', 0, 0);
    ctx.fillText('O', 0, 40);
    ctx.fillText('K', 0, 80);
    ctx.fillText('E', 0, 120);
    ctx.fillText('R', 0, 160);
    ctx.restore();

    // Center Joker Illustration
    ctx.font = '160px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🃏', 256, 370);
  } else {
    // Corner Top-Left
    ctx.fillStyle = suitColor;
    ctx.font = 'bold 64px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(rank, 58, 80);
    ctx.font = '52px sans-serif';
    ctx.fillText(suitChar, 58, 140);

    // Corner Bottom-Right (Rotated 180)
    ctx.save();
    ctx.translate(454, 660);
    ctx.rotate(Math.PI);
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText(rank, 0, 0);
    ctx.font = '52px sans-serif';
    ctx.fillText(suitChar, 0, 60);
    ctx.restore();

    // Center Graphic
    if (rank === 'A') {
      ctx.font = '220px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(suitChar, 256, 370);
    } else if (rank === 'K') {
      ctx.font = '180px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🤴', 256, 370);
    } else if (rank === 'Q') {
      ctx.font = '180px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('👸', 256, 370);
    } else {
      ctx.font = '160px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(suitChar, 256, 370);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

export function ThreeHeroCards() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 6.2);

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight.position.set(4, 8, 6);
    scene.add(dirLight);

    const purpleGlow = new THREE.PointLight(0x9b72cb, 3.5, 10);
    purpleGlow.position.set(0, 0, 2);
    scene.add(purpleGlow);

    const blueGlow = new THREE.PointLight(0x38bdf8, 2.0, 10);
    blueGlow.position.set(-3, 2, 1);
    scene.add(blueGlow);

    const pinkGlow = new THREE.PointLight(0xf43f5e, 2.0, 10);
    pinkGlow.position.set(3, -2, 1);
    scene.add(pinkGlow);

    // 4. Create Card Meshes
    const cardWidth = 1.25;
    const cardHeight = 1.82;
    const geometry = new THREE.PlaneGeometry(cardWidth, cardHeight, 4, 4);

    const cardGroup = new THREE.Group();
    scene.add(cardGroup);

    const cardMeshes: { mesh: THREE.Mesh; def: CardDef }[] = [];

    CARD_DATA.forEach((def) => {
      const frontTex = createCardTexture(def.rank, def.suit);
      const material = new THREE.MeshStandardMaterial({
        map: frontTex,
        roughness: 0.25,
        metalness: 0.05,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...def.basePos);
      mesh.rotation.set(...def.baseRot);

      cardGroup.add(mesh);
      cardMeshes.push({ mesh, def });
    });

    // 5. Mouse Interaction & Tilt
    let mouseX = 0;
    let mouseY = 0;
    let targetRotX = 0;
    let targetRotY = 0;

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      mouseX = x * 2;
      mouseY = y * 2;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const rect = container.getBoundingClientRect();
        const x = (touch.clientX - rect.left) / rect.width - 0.5;
        const y = (touch.clientY - rect.top) / rect.height - 0.5;
        mouseX = x * 2;
        mouseY = y * 2;
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove);

    // 6. Resize Handler
    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // 7. Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Smooth mouse parallax on whole card group
      targetRotY += (mouseX * 0.15 - targetRotY) * 0.05;
      targetRotX += (-mouseY * 0.15 - targetRotX) * 0.05;
      cardGroup.rotation.y = targetRotY;
      cardGroup.rotation.x = targetRotX;

      // Individual Card Bobbing & Subtle Float Rotation
      cardMeshes.forEach(({ mesh, def }) => {
        const t = elapsed * def.speed + def.phase;
        // Harmonic floating on Y and Z
        mesh.position.y = def.basePos[1] + Math.sin(t) * 0.08;
        mesh.position.x = def.basePos[0] + Math.cos(t * 0.8) * 0.04;
        mesh.position.z = def.basePos[2] + Math.sin(t * 1.2) * 0.06;

        // Gentle tilt oscillation
        mesh.rotation.z = def.baseRot[2] + Math.sin(t * 0.9) * 0.05;
        mesh.rotation.x = def.baseRot[0] + Math.cos(t * 0.7) * 0.04;
      });

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('resize', onResize);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      geometry.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-[360px] sm:h-[420px] relative pointer-events-auto select-none"
    />
  );
}

export default ThreeHeroCards;
