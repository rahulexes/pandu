// ============================================================
// PANDU — Card Component
// ============================================================
// Premium 3D card with flip animation, suit icons, and rank display.

'use client';

import { motion } from 'motion/react';
import type { ClientCard } from '@pandu/shared';
import type { Rank, Suit } from '@pandu/shared';

interface CardProps {
  card: ClientCard;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  onDoubleClick?: () => void;
  selected?: boolean;
  highlighted?: boolean;
  disabled?: boolean;
  className?: string;
  index?: number;
  isPeeking?: boolean;
  peekLabel?: string;
  peekStyle?: 'self' | 'other' | 'being_viewed';
}

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const SUIT_COLORS: Record<string, string> = {
  hearts: '#dc2626',
  diamonds: '#dc2626',
  clubs: '#0f172a',
  spades: '#0f172a',
};

const SIZE_MAP = {
  sm: { width: 52, height: 76, fontSize: 12, suitSize: 14, radius: 6 },
  md: { width: 72, height: 104, fontSize: 16, suitSize: 20, radius: 8 },
  lg: { width: 96, height: 140, fontSize: 22, suitSize: 28, radius: 12 },
};

export function Card({
  card,
  size = 'md',
  onClick,
  onDoubleClick,
  selected,
  highlighted,
  disabled,
  className = '',
  index = 0,
  isPeeking = false,
  peekLabel,
  peekStyle = 'self',
}: CardProps) {
  const dims = SIZE_MAP[size];
  const isFaceUp = card.faceUp && card.rank && card.suit;

  const glowColor = peekStyle === 'being_viewed'
    ? 'rgba(244, 63, 94, 0.7)'
    : peekStyle === 'other'
    ? 'rgba(52, 211, 153, 0.7)'
    : 'rgba(245, 158, 11, 0.7)';

  return (
    <motion.div
      className={`relative cursor-pointer select-none ${className}`}
      style={{
        width: dims.width,
        height: dims.height,
        perspective: 1000,
        zIndex: isPeeking ? 40 : selected ? 20 : 1,
      }}
      onClick={disabled ? undefined : onClick}
      onDoubleClick={disabled ? undefined : onDoubleClick}
      whileHover={disabled ? undefined : { y: isPeeking ? -18 : -6, scale: isPeeking ? 1.4 : 1.05 }}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{
        opacity: 1,
        y: isPeeking ? -16 : selected ? -12 : 0,
        scale: isPeeking ? 1.35 : selected ? 1.08 : 1,
      }}
      transition={{ type: 'spring', stiffness: 350, damping: 22, delay: index * 0.05 }}
    >
      {/* Floating Peek Indicator Badge */}
      {isPeeking && (
        <motion.div
          className={`absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase whitespace-nowrap shadow-xl z-50 border ${
            peekStyle === 'being_viewed'
              ? 'bg-rose-600 text-white border-rose-300 animate-pulse shadow-rose-500/50'
              : peekStyle === 'other'
              ? 'bg-emerald-600 text-white border-emerald-300 shadow-emerald-500/50'
              : 'bg-amber-500 text-slate-950 border-amber-300 shadow-amber-500/50'
          }`}
          initial={{ opacity: 0, scale: 0.5, y: 5 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
        >
          {peekLabel || (peekStyle === 'being_viewed' ? '⚠️ BEING VIEWED' : '👁️ VIEWING')}
        </motion.div>
      )}

      {/* Peeking Intense Glow */}
      {isPeeking && (
        <motion.div
          className="absolute -inset-2 rounded-xl pointer-events-none"
          style={{ background: glowColor, filter: 'blur(10px)' }}
          animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.08, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
      )}

      {/* Selection glow */}
      {selected && !isPeeking && (
        <motion.div
          className="absolute -inset-1 rounded-xl"
          style={{ background: 'rgba(240, 192, 64, 0.4)', filter: 'blur(6px)' }}
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}

      {/* Highlight glow */}
      {highlighted && !isPeeking && (
        <motion.div
          className="absolute -inset-1 rounded-xl"
          style={{ background: 'rgba(16, 185, 129, 0.4)', filter: 'blur(6px)' }}
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      )}

      {/* Card body */}
      <div
        className={`relative w-full h-full rounded-lg overflow-hidden ${
          isPeeking
            ? peekStyle === 'being_viewed'
              ? 'ring-4 ring-rose-500 shadow-2xl'
              : peekStyle === 'other'
              ? 'ring-4 ring-emerald-400 shadow-2xl'
              : 'ring-4 ring-amber-400 shadow-2xl'
            : ''
        }`}
        style={{
          borderRadius: dims.radius,
          boxShadow: isPeeking
            ? `0 12px 30px ${glowColor}`
            : selected
            ? '0 8px 24px rgba(240, 192, 64, 0.3)'
            : '0 2px 8px rgba(0, 0, 0, 0.4)',
        }}
      >
        {isFaceUp ? (
          <CardFront rank={card.rank!} suit={card.suit!} dims={dims} />
        ) : (
          <CardBack dims={dims} />
        )}
      </div>
    </motion.div>
  );
}

function CardFront({ rank, suit, dims }: { rank: Rank; suit: Suit; dims: typeof SIZE_MAP.md }) {
  const color = SUIT_COLORS[suit] || '#0f172a';
  const symbol = SUIT_SYMBOLS[suit] || '★';

  return (
    <div
      className="w-full h-full flex flex-col relative"
      style={{
        background: 'linear-gradient(145deg, #ffffff 0%, #f1f5f9 50%, #e2e8f0 100%)',
        borderRadius: dims.radius,
        border: '1px solid rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* Top-left rank + suit */}
      <div className="absolute top-1 left-1.5 flex flex-col items-center leading-none">
        <span style={{ fontSize: dims.fontSize, fontWeight: 800, color, lineHeight: 1 }}>
          {rank}
        </span>
        <span style={{ fontSize: dims.suitSize * 0.7, color, lineHeight: 1 }}>
          {symbol}
        </span>
      </div>

      {/* Center suit */}
      <div className="flex-1 flex items-center justify-center">
        <span style={{ fontSize: dims.suitSize * 1.8, color, opacity: 0.9 }}>
          {symbol}
        </span>
      </div>

      {/* Bottom-right rank + suit (inverted) */}
      <div className="absolute bottom-1 right-1.5 flex flex-col items-center leading-none rotate-180">
        <span style={{ fontSize: dims.fontSize, fontWeight: 800, color, lineHeight: 1 }}>
          {rank}
        </span>
        <span style={{ fontSize: dims.suitSize * 0.7, color, lineHeight: 1 }}>
          {symbol}
        </span>
      </div>
    </div>
  );
}

function CardBack({ dims }: { dims: typeof SIZE_MAP.md }) {
  return (
    <div
      className="w-full h-full relative overflow-hidden flex items-center justify-center select-none bg-[#111318]"
      style={{
        borderRadius: dims.radius,
        boxShadow: 'inset 0 0 8px rgba(0, 0, 0, 0.7), 0 3px 10px rgba(0, 0, 0, 0.4)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
      }}
    >
      {/* Ornate Luxury Blue Filigree Card Back Design */}
      <img
        src="/cards/card_back.png"
        alt="Card Back"
        className="w-full h-full object-cover select-none pointer-events-none"
        style={{
          borderRadius: dims.radius,
        }}
        draggable={false}
      />
    </div>
  );
}

// ── Deck Stack Visual ───────────────────────────────

export function DeckStack({
  count,
  label,
  onClick,
  className = '',
}: {
  count: number;
  label: string;
  onClick?: () => void;
  className?: string;
}) {
  const stackCards = Math.min(count, 5);

  return (
    <motion.div
      className={`relative cursor-pointer ${className}`}
      onClick={onClick}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.95 }}
    >
      {/* Stacked ornate luxury card backs */}
      {Array.from({ length: stackCards }).map((_, i) => (
        <div
          key={i}
          className="absolute overflow-hidden"
          style={{
            width: 72,
            height: 104,
            top: -i * 2,
            left: i * 0.5,
            borderRadius: 8,
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.45)',
            background: '#111318',
          }}
        >
          <img
            src="/cards/card_back.png"
            alt="Deck Card"
            className="w-full h-full object-cover select-none pointer-events-none"
            draggable={false}
          />
        </div>
      ))}

      {/* Count badge */}
      <div
        className="absolute -top-2 -right-2 bg-gradient-to-r from-amber-500 to-amber-400 text-black text-xs font-black rounded-full flex items-center justify-center shadow-lg border border-amber-300"
        style={{ width: 24, height: 24, zIndex: 10 }}
      >
        {count}
      </div>

      {/* Label */}
      <div
        className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-slate-300 font-bold whitespace-nowrap drop-shadow"
      >
        {label}
      </div>

      {/* Spacer for stacked height */}
      <div style={{ width: 72, height: 104 }} />
    </motion.div>
  );
}

export default Card;
