// ============================================================
// PANDU — Interactive 3D Physics Floating Deck Background
// Throw face-up cards in 3D with finger swipe / mouse drag
// ============================================================

'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface CardData {
  rank: string;
  suit: string;
  color: string;
  symbol: string;
}

const DECK_CARDS: CardData[] = [
  { rank: 'A', suit: 'diamonds', color: '#e11d48', symbol: '♦' },
  { rank: 'K', suit: 'hearts', color: '#f43f5e', symbol: '♥' },
  { rank: 'Q', suit: 'diamonds', color: '#e11d48', symbol: '♦' },
  { rank: 'J', suit: 'spades', color: '#38bdf8', symbol: '♠' },
  { rank: '10', suit: 'hearts', color: '#f43f5e', symbol: '♥' },
  { rank: 'A', suit: 'spades', color: '#c084fc', symbol: '♠' },
  { rank: 'K', suit: 'diamonds', color: '#e11d48', symbol: '♦' },
  { rank: '9', suit: 'clubs', color: '#38bdf8', symbol: '♣' },
  { rank: '8', suit: 'hearts', color: '#f43f5e', symbol: '♥' },
  { rank: 'A', suit: 'hearts', color: '#f43f5e', symbol: '♥' },
  { rank: 'Q', suit: 'spades', color: '#c084fc', symbol: '♠' },
  { rank: '7', suit: 'diamonds', color: '#e11d48', symbol: '♦' },
  { rank: 'K', suit: 'spades', color: '#38bdf8', symbol: '♠' },
  { rank: 'J', suit: 'hearts', color: '#f43f5e', symbol: '♥' },
  { rank: '10', suit: 'diamonds', color: '#e11d48', symbol: '♦' },
  { rank: 'A', suit: 'clubs', color: '#38bdf8', symbol: '♣' },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Generate luxury dark card texture matching reference image
function createLuxuryCardTexture(card: CardData): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 740;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Matte dark obsidian background
  ctx.fillStyle = '#141722';
  ctx.beginPath();
  ctx.roundRect(0, 0, 512, 740, 36);
  ctx.fill();

  // Subtle gradient overlay
  const grad = ctx.createLinearGradient(0, 0, 512, 740);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.07)');
  grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.1)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(0, 0, 512, 740, 36);
  ctx.fill();

  // Fine luxury metallic border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(10, 10, 492, 720, 28);
  ctx.stroke();

  // Corner Top-Left (Rank + Suit)
  ctx.fillStyle = card.color;
  ctx.font = 'bold 56px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(card.rank, 62, 82);
  ctx.font = '48px system-ui, -apple-system, sans-serif';
  ctx.fillText(card.symbol, 62, 140);

  // Corner Bottom-Right (Inverted)
  ctx.save();
  ctx.translate(450, 658);
  ctx.rotate(Math.PI);
  ctx.fillStyle = card.color;
  ctx.font = 'bold 56px system-ui, -apple-system, sans-serif';
  ctx.fillText(card.rank, 0, 0);
  ctx.font = '48px system-ui, -apple-system, sans-serif';
  ctx.fillText(card.symbol, 0, 58);
  ctx.restore();

  // Center Hero Graphic
  ctx.save();
  ctx.fillStyle = card.color;
  ctx.shadowColor = card.color;
  ctx.shadowBlur = 18;

  if (card.rank === 'A') {
    ctx.font = '220px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(card.symbol, 256, 370);
  } else if (card.rank === 'K' || card.rank === 'Q' || card.rank === 'J') {
    ctx.font = '160px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const icon = card.rank === 'K' ? '👑' : card.rank === 'Q' ? '👸' : '⚔️';
    ctx.fillText(icon, 256, 350);
    ctx.font = 'bold 44px system-ui, -apple-system, sans-serif';
    ctx.fillText(card.symbol, 256, 470);
  } else {
    ctx.font = '140px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(card.symbol, 256, 370);
  }
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

// Card Back Texture for underside
function createLuxuryBackTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 740;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = '#0f121d';
  ctx.beginPath();
  ctx.roundRect(0, 0, 512, 740, 36);
  ctx.fill();

  ctx.strokeStyle = 'rgba(192, 132, 252, 0.3)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(16, 16, 480, 708, 24);
  ctx.stroke();

  // Pattern
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 2;
  for (let x = 30; x < 480; x += 30) {
    ctx.beginPath();
    ctx.moveTo(x, 30);
    ctx.lineTo(x + 200, 710);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

interface PhysicsCard {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  isFloating: boolean;
  settled: boolean;
  floatPhase: number;
  basePos: THREE.Vector3;
}

export function InteractiveDeck3D() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Three.js Scene Setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, 7.5);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight.position.set(4, 8, 10);
    scene.add(dirLight);

    const purpleLight = new THREE.PointLight(0xc084fc, 3.5, 20);
    purpleLight.position.set(-4, -2, 5);
    scene.add(purpleLight);

    const blueLight = new THREE.PointLight(0x38bdf8, 3.0, 20);
    blueLight.position.set(4, 2, 4);
    scene.add(blueLight);

    // Shared Geometry
    const CARD_WIDTH = 2.1;
    const CARD_HEIGHT = 3.0;
    const cardGeometry = new THREE.PlaneGeometry(CARD_WIDTH, CARD_HEIGHT, 1, 1);
    const backTexture = createLuxuryBackTexture();
    const backMaterial = new THREE.MeshStandardMaterial({
      map: backTexture,
      roughness: 0.4,
      metalness: 0.2,
      side: THREE.BackSide,
    });

    // Deck Management
    let deckPool = shuffle([...DECK_CARDS]);
    let deckMeshes: { mesh: THREE.Mesh; data: CardData; baseOffset: THREE.Vector3; baseRotZ: number }[] = [];
    let thrownCards: PhysicsCard[] = [];

    const DECK_STACK_COUNT = 9;
    const DECK_CENTER = new THREE.Vector3(0, -0.3, 0);

    // Create a card mesh
    function buildCardMesh(cardData: CardData, stackIndex: number) {
      const frontTex = createLuxuryCardTexture(cardData);
      const frontMat = new THREE.MeshStandardMaterial({
        map: frontTex,
        roughness: 0.35,
        metalness: 0.25,
        side: THREE.FrontSide,
      });

      const cardGroup = new THREE.Group();
      const frontMesh = new THREE.Mesh(cardGeometry, frontMat);
      const backMesh = new THREE.Mesh(cardGeometry, backMaterial);
      cardGroup.add(frontMesh);
      cardGroup.add(backMesh);

      // Shuffled deck look: slight fanning offset and rotation
      const fanningAngle = (stackIndex - DECK_STACK_COUNT / 2) * 0.035 + (Math.random() - 0.5) * 0.02;
      const offsetX = (stackIndex - DECK_STACK_COUNT / 2) * 0.05 + (Math.random() - 0.5) * 0.03;
      const offsetY = (stackIndex - DECK_STACK_COUNT / 2) * 0.03;
      const offsetZ = stackIndex * 0.035;

      cardGroup.position.set(
        DECK_CENTER.x + offsetX,
        DECK_CENTER.y + offsetY,
        DECK_CENTER.z + offsetZ
      );
      cardGroup.rotation.set(-0.15, 0.1, fanningAngle);

      return {
        mesh: cardGroup as unknown as THREE.Mesh,
        data: cardData,
        baseOffset: new THREE.Vector3(offsetX, offsetY, offsetZ),
        baseRotZ: fanningAngle,
      };
    }

    // Populate initial deck
    function initDeck() {
      for (let i = 0; i < DECK_STACK_COUNT; i++) {
        if (deckPool.length === 0) deckPool = shuffle([...DECK_CARDS]);
        const cardData = deckPool.pop()!;
        const item = buildCardMesh(cardData, i);
        scene.add(item.mesh);
        deckMeshes.push(item);
      }
    }
    initDeck();

    // Interaction State
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let isDragging = false;
    let draggedCard: THREE.Mesh | null = null;
    let dragPlane = new THREE.Plane();
    let planeIntersect = new THREE.Vector3();
    let dragOffset = new THREE.Vector3();
    let dragHistory: { pos: THREE.Vector3; time: number }[] = [];

    // Helper: Top card in deck
    function getTopCard() {
      if (deckMeshes.length === 0) return null;
      return deckMeshes[deckMeshes.length - 1];
    }

    // Convert Screen to Raycast Normalized Device Coordinates
    function setMouseFromEvent(e: MouseEvent | Touch) {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    }

    function onPointerDown(clientX: number, clientY: number) {
      mouse.x = (clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      // 1. Check if user clicked on any floating/settled card on screen first
      const floatingMeshes = thrownCards.map((c) => c.mesh);
      if (floatingMeshes.length > 0) {
        const floatingIntersects = raycaster.intersectObjects(floatingMeshes, true);
        if (floatingIntersects.length > 0) {
          // Find the parent card group of the intersected mesh
          let hitMesh = floatingIntersects[0].object as THREE.Mesh;
          while (hitMesh.parent && hitMesh.parent !== scene && !(hitMesh.parent instanceof THREE.Scene)) {
            hitMesh = hitMesh.parent as unknown as THREE.Mesh;
          }

          // Remove from thrownCards while dragging so physics doesn't fight the drag
          thrownCards = thrownCards.filter((c) => c.mesh !== hitMesh);

          isDragging = true;
          draggedCard = hitMesh;

          const cameraDir = new THREE.Vector3();
          camera.getWorldDirection(cameraDir);
          dragPlane.setFromNormalAndCoplanarPoint(cameraDir.negate(), draggedCard.position);

          if (raycaster.ray.intersectPlane(dragPlane, planeIntersect)) {
            dragOffset.copy(draggedCard.position).sub(planeIntersect);
          }

          dragHistory = [{ pos: draggedCard.position.clone(), time: performance.now() }];
          return;
        }
      }

      // 2. Otherwise check if user clicked on top card of the deck
      const top = getTopCard();
      if (!top) return;

      const deckIntersects = raycaster.intersectObjects([top.mesh], true);
      if (deckIntersects.length > 0) {
        isDragging = true;
        draggedCard = top.mesh;

        // Remove from deck stack immediately so next card becomes top
        deckMeshes = deckMeshes.filter((item) => item.mesh !== draggedCard);

        // Refill deck if low
        if (deckMeshes.length < 5) {
          if (deckPool.length === 0) deckPool = shuffle([...DECK_CARDS]);
          const cardData = deckPool.pop()!;
          const newItem = buildCardMesh(cardData, 0);
          scene.add(newItem.mesh);
          deckMeshes.unshift(newItem); // Add at bottom of stack
        }

        const cameraDir = new THREE.Vector3();
        camera.getWorldDirection(cameraDir);
        dragPlane.setFromNormalAndCoplanarPoint(cameraDir.negate(), draggedCard.position);

        if (raycaster.ray.intersectPlane(dragPlane, planeIntersect)) {
          dragOffset.copy(draggedCard.position).sub(planeIntersect);
        }

        dragHistory = [{ pos: draggedCard.position.clone(), time: performance.now() }];
      }
    }

    function onPointerMove(clientX: number, clientY: number) {
      if (!isDragging || !draggedCard) return;

      mouse.x = (clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      if (raycaster.ray.intersectPlane(dragPlane, planeIntersect)) {
        const targetPos = planeIntersect.clone().add(dragOffset);
        targetPos.z = Math.max(targetPos.z, 0.5); // Lift toward user while dragging

        // Tilt card dynamically based on movement
        const deltaX = targetPos.x - draggedCard.position.x;
        const deltaY = targetPos.y - draggedCard.position.y;

        draggedCard.position.copy(targetPos);
        draggedCard.rotation.z = -deltaX * 0.8;
        draggedCard.rotation.x = -0.15 + deltaY * 0.6;
        draggedCard.rotation.y = 0.1 + deltaX * 0.4;

        const now = performance.now();
        dragHistory.push({ pos: targetPos.clone(), time: now });
        if (dragHistory.length > 5) dragHistory.shift();
      }
    }

    function onPointerUp() {
      if (!isDragging || !draggedCard) return;

      isDragging = false;
      const thrownMesh = draggedCard;
      draggedCard = null;

      // Calculate release velocity from gesture history
      let velocity = new THREE.Vector3(0, 0, 0);
      if (dragHistory.length >= 2) {
        const oldest = dragHistory[0];
        const newest = dragHistory[dragHistory.length - 1];
        const dt = Math.max(16, newest.time - oldest.time) / 1000;
        velocity = newest.pos.clone().sub(oldest.pos).divideScalar(dt);
      }

      const speed = velocity.length();

      // Spin proportional to throw velocity
      const angularVelocity = new THREE.Vector3(
        (Math.random() - 0.5) * 4 + velocity.y * 0.4,
        (Math.random() - 0.5) * 4 - velocity.x * 0.4,
        -velocity.x * 0.8 + (Math.random() - 0.5) * 2
      );

      // Add to physics loop
      thrownCards.push({
        mesh: thrownMesh,
        velocity: velocity.clone(),
        angularVelocity,
        isFloating: speed < 4.2, // Slow throws float on screen; fast throws fly away
        settled: false,
        floatPhase: Math.random() * Math.PI * 2,
        basePos: thrownMesh.position.clone(),
      });
    }

    // Event Listeners (Mouse & Touch)
    const handleMouseDown = (e: MouseEvent) => onPointerDown(e.clientX, e.clientY);
    const handleMouseMove = (e: MouseEvent) => onPointerMove(e.clientX, e.clientY);
    const handleMouseUp = () => onPointerUp();

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const handleTouchEnd = () => onPointerUp();

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);

    // Resize Handler
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // ── Animation & Physics Loop ──
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05);
      const time = clock.getElapsedTime();

      // Deck subtle breathing / levitation
      const deckHover = Math.sin(time * 1.4) * 0.08;
      const deckTilt = Math.cos(time * 1.0) * 0.03;

      deckMeshes.forEach((item, idx) => {
        if (item.mesh !== draggedCard) {
          item.mesh.position.y = DECK_CENTER.y + item.baseOffset.y + deckHover;
          item.mesh.position.x = DECK_CENTER.x + item.baseOffset.x;
          item.mesh.position.z = DECK_CENTER.z + item.baseOffset.z;
          item.mesh.rotation.z = item.baseRotZ + deckTilt * (idx / DECK_STACK_COUNT);
        }
      });

      // Physics for Thrown Cards
      for (let i = thrownCards.length - 1; i >= 0; i--) {
        const item = thrownCards[i];

        if (!item.settled) {
          // Linear motion
          item.mesh.position.addScaledVector(item.velocity, delta);

          // Angular motion
          item.mesh.rotation.x += item.angularVelocity.x * delta;
          item.mesh.rotation.y += item.angularVelocity.y * delta;
          item.mesh.rotation.z += item.angularVelocity.z * delta;

          // Air Drag / Damping
          const drag = item.isFloating ? 0.92 : 0.985;
          item.velocity.multiplyScalar(Math.pow(drag, delta * 60));
          item.angularVelocity.multiplyScalar(Math.pow(0.93, delta * 60));

          // If slow throw has stopped moving, transition to gentle floating hover
          if (item.isFloating && item.velocity.length() < 0.15) {
            item.settled = true;
            item.basePos.copy(item.mesh.position);
          }

          // If fast throw goes off-screen, remove and dispose
          if (
            Math.abs(item.mesh.position.x) > 12 ||
            Math.abs(item.mesh.position.y) > 12 ||
            Math.abs(item.mesh.position.z) > 18
          ) {
            scene.remove(item.mesh);
            thrownCards.splice(i, 1);
            continue;
          }
        } else {
          // Settled floating card idle bob
          const bobY = Math.sin(time * 1.5 + item.floatPhase) * 0.06;
          const bobRot = Math.cos(time * 1.2 + item.floatPhase) * 0.02;
          item.mesh.position.y = item.basePos.y + bobY;
          item.mesh.rotation.z += bobRot * delta;
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('resize', handleResize);

      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      cardGeometry.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-auto z-0 overflow-hidden"
      style={{ touchAction: 'none' }}
    />
  );
}
