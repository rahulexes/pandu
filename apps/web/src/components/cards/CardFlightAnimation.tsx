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
                x: flight.endX,
                y: flight.endY,
                scale: flight.scaleEnd ?? 1,
                rotate: flight.rotateEnd ?? 0,
                opacity: 1,
              }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{
                duration: flight.duration ?? 0.65,
                ease: [0.25, 1, 0.5, 1], // Smooth cubic-bezier spring
              }}
              onAnimationComplete={() => onComplete(flight.id)}
            >
              <div className="shadow-2xl filter drop-shadow-[0_15px_25px_rgba(0,0,0,0.6)]">
                <Card card={cardToRender} size="md" highlighted={flight.highlighted} />
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export default CardFlightAnimationOverlay;
