// ============================================================
// PANDU — Fullscreen 3D Floating Interactive Cards (Three.js)
// ============================================================

'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface CardDef {
  rank: string;
  suit: string;
  isBack?: boolean;
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
    basePos: [-2.15, 1.45, 0.2],
    baseRot: [-0.06, 0.22, 0.42],
    speed: 1.1,
    phase: 0.0,
  },
  // 2: Ornate Blue Card Back (Top-Center Floating)
  {
    rank: 'BACK',
    suit: 'back',
    isBack: true,
    basePos: [0.5, 2.35, -0.2],
    baseRot: [-0.12, -0.16, -0.45],
    speed: 0.95,
    phase: 1.5,
  },
  // 3: Joker (Right)
  {
    rank: 'JOKER',
    suit: 'joker',
    basePos: [2.15, 0.9, 0.1],
    baseRot: [0.08, -0.25, 0.2],
    speed: 1.05,
    phase: 2.8,
  },
  // 4: Ornate Blue Card Back (Bottom-Right Floating)
  {
    rank: 'BACK',
    suit: 'back',
    isBack: true,
    basePos: [1.85, -1.35, 0.3],
    baseRot: [0.14, -0.18, -0.5],
    speed: 0.9,
    phase: 4.2,
  },
  // 5: Ace of Diamonds (Bottom-Center)
  {
    rank: 'A',
    suit: 'diamonds',
    basePos: [-0.05, -1.95, 0.4],
    baseRot: [0.18, 0.02, 0.06],
    speed: 1.2,
    phase: 3.1,
  },
  // 6: Ace of Spades (Bottom-Left)
  {
    rank: 'A',
    suit: 'spades',
    basePos: [-2.05, -0.9, 0.1],
    baseRot: [0.06, 0.2, -0.35],
    speed: 1.0,
    phase: 5.0,
  },
];

// High-resolution clean card texture without ugly borders
function createCardTexture(rank: string, suit: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 740;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Soft ivory card surface
  ctx.fillStyle = '#fafbfc';
  ctx.beginPath();
  ctx.roundRect(0, 0, 512, 740, 32);
  ctx.fill();

  const isRed = suit === 'hearts' || suit === 'diamonds';
  const suitColor = isRed ? '#e11d48' : '#0f172a';
  const suitChar = suit === 'hearts' ? '♥' : suit === 'diamonds' ? '♦' : suit === 'clubs' ? '♣' : suit === 'spades' ? '♠' : '★';

  if (suit === 'joker') {
    ctx.fillStyle = '#8b5cf6';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('J', 32, 60);
    ctx.fillText('O', 32, 100);
    ctx.fillText('K', 32, 140);
    ctx.fillText('E', 32, 180);
    ctx.fillText('R', 32, 220);

    ctx.save();
    ctx.translate(480, 680);
    ctx.rotate(Math.PI);
    ctx.fillText('J', 0, 0);
    ctx.fillText('O', 0, 40);
    ctx.fillText('K', 0, 80);
    ctx.fillText('E', 0, 120);
    ctx.fillText('R', 0, 160);
    ctx.restore();

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

    // Corner Bottom-Right
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

    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || window.innerHeight;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    
    // Adjust camera distance for mobile screens
    const isMobile = width < 640;
    camera.position.set(0, 0, isMobile ? 6.8 : 5.8);

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);

    // 3. Lighting with soft ambient and colorful bounce
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
    dirLight.position.set(3, 6, 5);
    scene.add(dirLight);

    const purpleGlow = new THREE.PointLight(0xa855f7, 2.5, 12);
    purpleGlow.position.set(0, 0, 3);
    scene.add(purpleGlow);

    const blueGlow = new THREE.PointLight(0x38bdf8, 1.8, 10);
    blueGlow.position.set(-3, 2, 2);
    scene.add(blueGlow);

    const pinkGlow = new THREE.PointLight(0xf43f5e, 1.8, 10);
    pinkGlow.position.set(3, -2, 2);
    scene.add(pinkGlow);

    // 4. Create Card Meshes
    const cardWidth = 1.22;
    const cardHeight = 1.78;
    const geometry = new THREE.PlaneGeometry(cardWidth, cardHeight, 1, 1);

    const cardGroup = new THREE.Group();
    scene.add(cardGroup);

    const textureLoader = new THREE.TextureLoader();
    const backTex = textureLoader.load('/cards/card_back.png');

    const cardMeshes: { mesh: THREE.Mesh; def: CardDef }[] = [];

    CARD_DATA.forEach((def) => {
      const tex = def.isBack ? backTex : createCardTexture(def.rank, def.suit);
      const material = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.3,
        metalness: 0.05,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geometry, material);
      // Scale positions slightly for mobile
      const scalePos = isMobile ? 0.92 : 1.0;
      mesh.position.set(def.basePos[0] * scalePos, def.basePos[1] * scalePos, def.basePos[2]);
      mesh.rotation.set(...def.baseRot);

      cardGroup.add(mesh);
      cardMeshes.push({ mesh, def });
    });

    // 5. Touch & Mouse Interactivity (Optimized for Android)
    let mouseX = 0;
    let mouseY = 0;
    let targetRotX = 0;
    let targetRotY = 0;
    let isTouching = false;
    let lastTouchX = 0;
    let lastTouchY = 0;

    const onMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) - 0.5;
      const y = (e.clientY / window.innerHeight) - 0.5;
      mouseX = x * 2;
      mouseY = y * 2;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        isTouching = true;
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const deltaX = touch.clientX - lastTouchX;
        const deltaY = touch.clientY - lastTouchY;
        lastTouchX = touch.clientX;
        lastTouchY = touch.clientY;

        mouseX += deltaX * 0.008;
        mouseY += deltaY * 0.008;

        // Clamp
        mouseX = Math.max(-1.5, Math.min(1.5, mouseX));
        mouseY = Math.max(-1.5, Math.min(1.5, mouseY));
      }
    };

    const onTouchEnd = () => {
      isTouching = false;
    };

    // Device orientation for Android / Mobile Gyroscope tilt
    const onDeviceOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma !== null && e.beta !== null && !isTouching) {
        mouseX = (e.gamma / 45) * 0.8;
        mouseY = ((e.beta - 45) / 45) * 0.8;
      }
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', onDeviceOrientation as any, { passive: true });
    }

    // 6. Resize Handler
    const onResize = () => {
      if (!container) return;
      width = container.clientWidth || window.innerWidth;
      height = container.clientHeight || window.innerHeight;
      camera.aspect = width / height;
      camera.position.z = width < 640 ? 6.8 : 5.8;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', onResize);

    // 7. Animation Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Return to center slowly if not touching
      if (!isTouching) {
        mouseX *= 0.97;
        mouseY *= 0.97;
      }

      // Smooth mouse / touch parallax on whole card group
      targetRotY += (mouseX * 0.22 - targetRotY) * 0.06;
      targetRotX += (-mouseY * 0.22 - targetRotX) * 0.06;
      cardGroup.rotation.y = targetRotY;
      cardGroup.rotation.x = targetRotX;

      // Individual Card Bobbing & Subtle Float Rotation
      cardMeshes.forEach(({ mesh, def }) => {
        const t = elapsed * def.speed + def.phase;
        mesh.position.y = def.basePos[1] + Math.sin(t) * 0.09;
        mesh.position.x = def.basePos[0] + Math.cos(t * 0.8) * 0.05;
        mesh.position.z = def.basePos[2] + Math.sin(t * 1.2) * 0.07;

        mesh.rotation.z = def.baseRot[2] + Math.sin(t * 0.9) * 0.06;
        mesh.rotation.x = def.baseRot[0] + Math.cos(t * 0.7) * 0.05;
      });

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('deviceorientation', onDeviceOrientation as any);
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
      className="absolute inset-0 w-full h-full pointer-events-auto select-none touch-none z-0"
    />
  );
}

export default ThreeHeroCards;
