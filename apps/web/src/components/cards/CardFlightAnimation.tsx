// ============================================================
// PANDU — Flying Card Motion Overlay System
// ============================================================
'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Card } from './Card';
import type { ClientCard } from '@pandu/shared';

export interface FlyingCardAnim {
  id: string;
  card?: ClientCard;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  duration?: number;
  scaleStart?: number;
  scaleEnd?: number;
  rotateStart?: number;
  rotateEnd?: number;
  arcHeight?: number;
  size?: 'sm' | 'md' | 'lg';
  highlighted?: boolean;
}

export function CardFlightAnimationOverlay({
  flights,
  onComplete,
}: {
  flights: FlyingCardAnim[];
  onComplete: (id: string) => void;
}) {
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      <AnimatePresence>
        {flights.map((flight) => {
          const cardToRender: ClientCard = flight.card || {
            id: flight.id,
            faceUp: false,
          };

          const startX = Number.isFinite(flight.startX) ? flight.startX : window.innerWidth / 2;
          const startY = Number.isFinite(flight.startY) ? flight.startY : window.innerHeight / 2;
          const endX = Number.isFinite(flight.endX) ? flight.endX : window.innerWidth / 2;
          const endY = Number.isFinite(flight.endY) ? flight.endY : window.innerHeight / 2;

          const arc = flight.arcHeight ?? 40;
          const midX = (startX + endX) / 2;
          const midY = Math.min(startY, endY) - arc;

          return (
            <motion.div
              key={flight.id}
              className="fixed top-0 left-0 pointer-events-none"
              initial={{
                x: startX,
                y: startY,
                scale: flight.scaleStart ?? 1,
                rotate: flight.rotateStart ?? 0,
                opacity: 1,
              }}
              animate={{
                x: [startX, midX, endX],
                y: [startY, midY, endY],
                scale: [flight.scaleStart ?? 1, 1.1, flight.scaleEnd ?? 1],
                rotate: [flight.rotateStart ?? 0, (flight.rotateStart ?? 0) * 0.4, flight.rotateEnd ?? 0],
                opacity: 1,
              }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{
                duration: flight.duration ?? 0.65,
                times: [0, 0.5, 1],
                ease: 'easeInOut',
              }}
              onAnimationComplete={() => onComplete(flight.id)}
            >
              <div className="shadow-[0_25px_50px_rgba(0,0,0,0.85)] filter drop-shadow-[0_20px_30px_rgba(0,0,0,0.7)]">
                <Card
                  card={cardToRender}
                  size={flight.size ?? 'md'}
                  highlighted={flight.highlighted}
                />
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export default CardFlightAnimationOverlay;
