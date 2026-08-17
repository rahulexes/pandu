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

          const arc = flight.arcHeight ?? 45;
          const midX = (flight.startX + flight.endX) / 2;
          const midY = Math.min(flight.startY, flight.endY) - arc;

          return (
            <motion.div
              key={flight.id}
              className="absolute top-0 left-0"
              initial={{
                x: flight.startX,
                y: flight.startY,
                scale: flight.scaleStart ?? 1,
                rotate: flight.rotateStart ?? 0,
                opacity: 1,
              }}
              animate={{
                x: [flight.startX, midX, flight.endX],
                y: [flight.startY, midY, flight.endY],
                scale: [flight.scaleStart ?? 1, 1.12, flight.scaleEnd ?? 1],
                rotate: [flight.rotateStart ?? 0, (flight.rotateStart ?? 0) * 0.3, flight.rotateEnd ?? 0],
                opacity: 1,
              }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{
                duration: flight.duration ?? 0.7,
                times: [0, 0.45, 1],
                ease: ['easeOut', 'easeInOut'],
              }}
              onAnimationComplete={() => onComplete(flight.id)}
            >
              <div className="shadow-[0_20px_40px_rgba(0,0,0,0.8)] filter drop-shadow-[0_15px_25px_rgba(0,0,0,0.6)]">
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
